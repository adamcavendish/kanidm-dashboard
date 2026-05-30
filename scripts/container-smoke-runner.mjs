import { spawn } from "node:child_process";
import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

export const rootDir = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const distDir = join(rootDir, "dist");

export async function runContainerSmoke({
  composeFile,
  projectNamePrefix,
  image,
  pullImage = false,
  build = false,
}) {
  const port = process.env.CONTAINER_SMOKE_PORT ?? "18080";
  const projectName = `${projectNamePrefix}-${Date.now()}`;
  const baseUrl = `http://127.0.0.1:${port}`;
  const tempDir = await mkdtemp(join(tmpdir(), `${projectNamePrefix}-`));
  const injectedConfigPath = join(tempDir, "dashboard.config.json");

  if (build) {
    await access(join(distDir, "index.html")).catch(() => {
      throw new Error("dist/index.html is missing. Run `vp build` before this smoke task.");
    });
  }

  await writeSmokeConfig(injectedConfigPath);

  async function docker(args, options = {}) {
    const child = spawn("docker", args, {
      cwd: rootDir,
      env: {
        ...process.env,
        CONTAINER_SMOKE_PORT: port,
        CONTAINER_SMOKE_IMAGE: image ?? process.env.CONTAINER_SMOKE_IMAGE ?? "",
        DASHBOARD_CONFIG_SMOKE_PATH: injectedConfigPath,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      if (options.stream) process.stdout.write(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      if (options.stream) process.stderr.write(chunk);
    });

    const code = await new Promise((resolve, reject) => {
      child.on("error", reject);
      child.on("close", resolve);
    });

    if (code !== 0) {
      throw new Error(`docker ${args.join(" ")} failed with ${code}\n${stdout}\n${stderr}`.trim());
    }

    return { stdout, stderr };
  }

  async function dockerCompose(args, options = {}) {
    return docker(["compose", "-f", composeFile, "-p", projectName, ...args], options);
  }

  try {
    if (pullImage) {
      if (!image) throw new Error("CONTAINER_SMOKE_IMAGE is required for registry image smoke.");
      await docker(["pull", image], { stream: true });
    }

    await dockerCompose(["up", ...(build ? ["--build"] : []), "-d"], { stream: true });
    await waitForReady(baseUrl);

    const result = await verifyRuntime(baseUrl);
    const browserResult = await verifyBrowserRuntime(baseUrl);
    console.log(
      JSON.stringify({
        ok: true,
        image: image ?? "local build",
        baseUrl,
        ...result,
        ...browserResult,
      }),
    );
  } finally {
    await dockerCompose(["down", "--volumes", "--remove-orphans"]).catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
    });
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function writeSmokeConfig(path) {
  await writeFile(
    path,
    JSON.stringify(
      {
        siteName: "Container Smoke Corp",
        logoUrl: "/logo.svg",
        loginMessage: "Container smoke configuration loaded.",
        adminGroup: "idm_admins",
        theme: {
          mode: "dark",
          accent: "#007aff",
          surface: "frosted",
          logoTreatment: "mark",
        },
        dataSource: {
          mode: "kanidm",
          apiBasePath: "",
          openApiPath: "/docs/v1/openapi.json",
        },
      },
      null,
      2,
    ),
  );
}

async function request(baseUrl, path) {
  const response = await fetch(`${baseUrl}${path}`);
  const text = await response.text();
  return {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    text,
  };
}

async function waitForReady(baseUrl) {
  const deadline = Date.now() + 30_000;
  let lastError = "";
  while (Date.now() < deadline) {
    try {
      const response = await request(baseUrl, "/dashboard.config.json");
      if (response.status === 200) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Container did not serve dashboard config within 30s: ${lastError}`);
}

async function verifyRuntime(baseUrl) {
  const config = await request(baseUrl, "/dashboard.config.json");
  assertStatus(config, "/dashboard.config.json");
  assertHeaderIncludes(config, "cache-control", "no-store");
  assertSecurityHeaders(config);
  const parsedConfig = JSON.parse(config.text);
  if (parsedConfig.dataSource?.mode !== "kanidm") {
    throw new Error(`/dashboard.config.json was not Kanidm mode: ${config.text}`);
  }
  if (parsedConfig.siteName !== "Container Smoke Corp") {
    throw new Error(`/dashboard.config.json did not use injected runtime config: ${config.text}`);
  }

  const root = await request(baseUrl, "/");
  assertStatus(root, "/");
  assertSecurityHeaders(root);
  if (!root.text.includes('<div id="root">')) {
    throw new Error("Root route did not return the dashboard SPA shell.");
  }

  const assetPath = firstBuiltAsset(root.text);
  const asset = await request(baseUrl, assetPath);
  assertStatus(asset, assetPath);
  assertHeaderIncludes(asset, "cache-control", "public");
  assertHeaderIncludes(asset, "cache-control", "immutable");
  assertSecurityHeaders(asset);

  const deepLink = await request(baseUrl, "/portal");
  assertStatus(deepLink, "/portal");
  assertSecurityHeaders(deepLink);
  if (!deepLink.text.includes('<div id="root">')) {
    throw new Error("SPA deep link did not return the dashboard shell.");
  }

  const status = await request(baseUrl, "/status");
  assertStatus(status, "/status");
  if (!status.text.includes("healthy")) {
    throw new Error(`/status did not return the mock upstream response: ${status.text}`);
  }

  const openApi = await request(baseUrl, "/docs/v1/openapi.json");
  assertStatus(openApi, "/docs/v1/openapi.json");
  const parsedOpenApi = JSON.parse(openApi.text);
  if (parsedOpenApi.info?.version !== "container-smoke") {
    throw new Error(`/docs/v1/openapi.json did not come from mock upstream: ${openApi.text}`);
  }

  return {
    configMode: parsedConfig.dataSource.mode,
    siteName: parsedConfig.siteName,
    assetPath,
    upstreamStatus: status.text.trim(),
    upstreamOpenApiVersion: parsedOpenApi.info.version,
    securityHeadersVerified: true,
  };
}

function assertSecurityHeaders(response) {
  assertHeaderIncludes(response, "content-security-policy", "default-src 'self'");
  assertHeaderIncludes(response, "content-security-policy", "frame-ancestors 'none'");
  assertHeaderIncludes(response, "content-security-policy", "object-src 'none'");
  assertHeaderIncludes(response, "content-security-policy", "script-src 'self'");
  assertHeaderIncludes(response, "content-security-policy", "style-src 'self'");
  assertHeaderIncludes(response, "referrer-policy", "same-origin");
  assertHeaderIncludes(response, "x-content-type-options", "nosniff");
  assertHeaderIncludes(response, "x-frame-options", "DENY");
}

async function verifyBrowserRuntime(baseUrl) {
  const browser = await chromium.launch({ headless: true });
  const pageErrors = [];
  try {
    const page = await browser.newPage();
    page.on("console", (message) => {
      if (message.type() === "error") pageErrors.push(`console error: ${message.text()}`);
    });
    page.on("pageerror", (error) => pageErrors.push(`pageerror: ${error.message}`));

    await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Password" }).waitFor({ timeout: 10_000 });

    await page.goto(`${baseUrl}/portal`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Password" }).waitFor({ timeout: 10_000 });

    const cspErrors = pageErrors.filter((message) =>
      message.toLowerCase().includes("content security policy"),
    );
    if (cspErrors.length) {
      throw new Error(`Container browser smoke hit CSP errors:\n${cspErrors.join("\n")}`);
    }
    if (pageErrors.length) {
      throw new Error(`Container browser smoke hit page errors:\n${pageErrors.join("\n")}`);
    }
  } finally {
    await browser.close();
  }

  return { browserRuntimeVerified: true };
}

function assertHeaderIncludes(response, header, expected) {
  const actual = response.headers[header.toLowerCase()] ?? "";
  if (!actual.includes(expected)) {
    throw new Error(`Expected ${header} to include ${expected}, got ${JSON.stringify(actual)}.`);
  }
}

function assertStatus(response, path) {
  if (response.status !== 200) {
    throw new Error(`${path} returned ${response.status}: ${response.text.slice(0, 200)}`);
  }
}

function firstBuiltAsset(indexHtml) {
  const match = indexHtml.match(/\/assets\/[^"' ]+\.(?:js|css)/);
  if (!match) throw new Error("Served index.html does not reference a built asset.");
  return match[0];
}
