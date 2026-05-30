import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const distDir = fileURLToPath(new URL("../dist", import.meta.url));

async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(path)));
    } else {
      files.push(path);
    }
  }

  return files;
}

function fail(message) {
  throw new Error(`Production artifact audit failed: ${message}`);
}

if (!(await pathExists(distDir))) {
  fail("dist/ does not exist. Run `vp build` before this audit.");
}

const indexPath = join(distDir, "index.html");
const configPath = join(distDir, "dashboard.config.json");
const mockConfigPath = join(distDir, "dashboard.config.mock.json");

if (!(await pathExists(indexPath))) fail("dist/index.html is missing.");
if (!(await pathExists(configPath))) fail("dist/dashboard.config.json is missing.");
if (await pathExists(mockConfigPath))
  fail("dist/dashboard.config.mock.json must not be published.");

const config = JSON.parse(await readFile(configPath, "utf8"));
if (config.dataSource?.mode !== "kanidm") {
  fail('dist/dashboard.config.json must use dataSource.mode "kanidm".');
}

for (const field of ["siteName", "logoUrl", "loginMessage"]) {
  if (typeof config[field] !== "string") {
    fail(`dist/dashboard.config.json must define string field ${field}.`);
  }
}

const files = await listFiles(distDir);
const forbiddenPatterns = ["dashboard.config.mock.json", "scripts/fixtures"];

for (const file of files) {
  const relativePath = relative(root, file);
  if (forbiddenPatterns.some((pattern) => relativePath.includes(pattern))) {
    fail(`forbidden mock fixture path published: ${relativePath}`);
  }
}

console.log(
  JSON.stringify({
    ok: true,
    dist: distDir,
    checkedFiles: files.length,
    configMode: config.dataSource.mode,
  }),
);
