import http from "node:http";
import https from "node:https";
import { chromium } from "playwright";
import { envValue } from "./kanidm-script-env.mjs";

const dashboardUrl = envValue("KANIDM_DASHBOARD_URL", "https://localhost:9443");
const mailpitUrl = envValue("MAILPIT_API_URL", "http://localhost:18025");
const username = envValue("KANIDM_USERNAME", "idm_admin");
const password = envValue("KANIDM_PASSWORD");
const timeoutMs = Number(envValue("KANIDM_RECOVERY_MAIL_TIMEOUT_MS", "45000"));
const screenshotDir = envValue("E2E_SCREENSHOT_DIR", "/tmp");
const stamp = Date.now().toString().slice(-8);
const personName = `ui_recovery_mail_${stamp}`;
const personEmail = `${personName}@example.test`;
const screenshotPath = `${screenshotDir}/kanidm-dashboard-add-user-recovery-mail.png`;
const failurePath = `${screenshotDir}/kanidm-dashboard-add-user-recovery-mail-failure.png`;
const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const apiResponses = [];
const failedResponses = [];
const logs = [];
const cleanupResults = [];

if (!password) {
  console.error(
    "Set KANIDM_PASSWORD in the environment or .env.local to run the dashboard add-user recovery mail E2E test.",
  );
  process.exit(2);
}

function appUrl(path) {
  return new URL(path, dashboardUrl).href;
}

function parseJson(body, fallback = null) {
  return body ? JSON.parse(body) : fallback;
}

async function request(urlBase, path, options = {}) {
  const url = new URL(path, urlBase);
  const body = options.body === undefined ? undefined : JSON.stringify(options.body);
  const transport = url.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    const req = transport.request(
      url,
      {
        agent: url.protocol === "https:" ? httpsAgent : undefined,
        method: options.method ?? "GET",
        headers: {
          accept: "application/json",
          ...(body
            ? { "content-type": "application/json", "content-length": Buffer.byteLength(body) }
            : {}),
          ...options.headers,
        },
      },
      (res) => {
        let text = "";
        res.on("data", (chunk) => {
          text += chunk;
        });
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: text }));
      },
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function mailpit(path, options = {}) {
  return request(mailpitUrl, path, options);
}

function messageList(body) {
  const parsed = parseJson(body, {});
  return parsed.messages ?? parsed.Messages ?? [];
}

function messageId(message) {
  return message.ID ?? message.Id ?? message.id;
}

function messageMatchesRecipient(message, recipient) {
  return JSON.stringify(message).includes(recipient);
}

async function findRecoveryMessage() {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const listed = await mailpit("/api/v1/messages");
    if (listed.status !== 200) {
      throw new Error(`Mailpit messages returned ${listed.status}: ${listed.body}`);
    }

    const messages = messageList(listed.body);
    const match = messages.find(
      (message) =>
        messageMatchesRecipient(message, personEmail) &&
        JSON.stringify(message).includes("Credential Reset Link"),
    );
    if (match) return match;

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(
    `No dashboard add-user recovery email for ${personEmail} appeared in Mailpit within ${timeoutMs}ms.`,
  );
}

async function deleteFixture(adminToken) {
  if (!adminToken) return;
  const result = await request(dashboardUrl, `/v1/person/${encodeURIComponent(personName)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  cleanupResults.push({
    path: `/v1/person/${personName}`,
    status: result.status,
    ok: result.status >= 200 && result.status < 300,
    body: result.body,
  });
}

async function fillText(page, label, value) {
  await page.getByLabel(label, { exact: true }).fill(value);
}

async function selectInternalLink(page, name, urlPattern) {
  await page.getByRole("link", { name }).click();
  await page.waitForURL(urlPattern, { timeout: 10000 });
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  ignoreHTTPSErrors: true,
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
let adminToken = "";

page.on("console", (message) => {
  if (message.type() === "error") logs.push(`${message.type()}: ${message.text()}`);
});
page.on("pageerror", (error) => logs.push(`pageerror: ${error.message}`));
page.on("response", (response) => {
  const url = response.url();
  if (url.includes("/v1/") || url.includes("/oauth2/")) {
    apiResponses.push(`${response.status()} ${url}`);
  }
  if (response.status() >= 400 && (url.includes("/v1/") || url.includes("/oauth2/"))) {
    failedResponses.push(`${response.status()} ${url}`);
  }
});

try {
  await mailpit("/api/v1/messages", { method: "DELETE" }).catch(() => {});

  await page.goto(appUrl("/login"), { waitUntil: "domcontentloaded" });
  await page.getByText("Session scope").waitFor({ timeout: 10000 });
  await fillText(page, "Username", username);
  await fillText(page, "Password", password);
  await page.getByRole("button", { name: /Continue/ }).click();
  await page.waitForURL(/\/portal$/, { timeout: 20000 });

  adminToken =
    (await page.evaluate(() => sessionStorage.getItem("kanidm-dashboard-kanidm-token"))) ?? "";
  if (!adminToken) throw new Error("Admin login did not store a bearer token for cleanup.");

  await selectInternalLink(page, /Admin console/, /\/admin$/);
  await selectInternalLink(page, /^People$/, /\/admin\/people$/);
  await selectInternalLink(page, /Add user/, /\/admin\/people\/new$/);

  await fillText(page, "Username", personName);
  await fillText(page, "Display name", `Recovery Mail UI ${stamp}`);
  await fillText(page, "Legal name", `Recovery Mail Legal ${stamp}`);
  await fillText(page, "Email", personEmail);
  await page.getByLabel("Credential path").selectOption("recovery-only");
  await page.getByRole("button", { name: /Review user/ }).click();
  await page.getByRole("button", { name: /^Create user$/ }).click();

  await page
    .getByText("Kanidm accepted the recovery email request for this account.")
    .waitFor({ timeout: 20000 });
  if ((await page.getByLabel("Credential setup URL").count()) !== 0) {
    throw new Error("Recovery-email add-user flow rendered a direct credential setup URL.");
  }

  const message = await findRecoveryMessage();
  const id = messageId(message);
  if (!id) throw new Error(`Mailpit message did not include an ID: ${JSON.stringify(message)}`);

  const detail = await mailpit(`/api/v1/message/${encodeURIComponent(id)}`);
  if (detail.status !== 200) {
    throw new Error(`Mailpit message detail returned ${detail.status}: ${detail.body}`);
  }

  const detailText = JSON.stringify(parseJson(detail.body, detail.body));
  if (!detailText.includes("/ui/reset") || !detailText.includes("token=")) {
    throw new Error(`Recovery email did not include a reset link: ${detail.body}`);
  }

  await page.screenshot({ path: screenshotPath, fullPage: true });
  await deleteFixture(adminToken);
  await browser.close();

  console.log(
    JSON.stringify(
      {
        ok: true,
        dashboardUrl,
        mailpitUrl,
        personName,
        recipient: personEmail,
        addUserRecoveryEmailVerified: true,
        resetLinkVerified: true,
        cleanupResults,
        screenshot: screenshotPath,
        messageId: id,
        subject: message.Subject ?? message.subject,
      },
      null,
      2,
    ),
  );
} catch (error) {
  await page.screenshot({ path: failurePath, fullPage: true }).catch(() => {});
  await deleteFixture(adminToken).catch((cleanupError) => {
    logs.push(
      `cleanup failed: ${cleanupError instanceof Error ? cleanupError.message : cleanupError}`,
    );
  });
  await browser.close();

  console.error(
    JSON.stringify(
      {
        ok: false,
        dashboardUrl,
        mailpitUrl,
        personName,
        recipient: personEmail,
        error: error instanceof Error ? error.message : String(error),
        apiResponses,
        failedResponses,
        logs,
        cleanupResults,
        screenshot: failurePath,
      },
      null,
      2,
    ),
  );
  process.exit(1);
}
