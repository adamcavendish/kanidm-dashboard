import { createHmac } from "node:crypto";
import { chromium } from "playwright";
import { envValue } from "./kanidm-script-env.mjs";

const baseUrl = envValue("KANIDM_DASHBOARD_URL", "https://localhost:9443");
const username = envValue("KANIDM_USERNAME", "idm_admin");
const password = envValue("KANIDM_PASSWORD");
const screenshotDir = envValue("E2E_SCREENSHOT_DIR", "/tmp");

if (!password) {
  console.error(
    "Set KANIDM_PASSWORD in the environment or .env.local to run the real Kanidm WebAuthn E2E test.",
  );
  process.exit(2);
}

const stamp = Date.now().toString().slice(-6);
const personName = `webauthn_${stamp}`;
const displayName = `WebAuthn User ${stamp}`;
const resetPassword = `Passkey-${stamp}-Credential!`;
const passkeyLabel = `virtual-passkey-${stamp}`;
const screenshotPath = `${screenshotDir}/kanidm-dashboard-webauthn-real.png`;
const failurePath = `${screenshotDir}/kanidm-dashboard-webauthn-failure.png`;
const logs = [];
const failedResponses = [];
const cleanupResults = [];

function appUrl(path) {
  return new URL(path, baseUrl).href;
}

async function selectInternalLink(page, name, urlPattern) {
  await page.getByRole("link", { name }).click();
  await page.waitForURL(urlPattern, { timeout: 10000 });
}

async function fillText(page, label, value) {
  await page.getByLabel(label).fill(value);
}

async function addVirtualAuthenticator(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  const result = await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "usb",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  return { cdp, authenticatorId: result.authenticatorId };
}

async function loginAdmin(page) {
  await page.goto(appUrl("/login"), { waitUntil: "domcontentloaded" });
  await page.getByText("Session scope").waitFor({ timeout: 10000 });
  await fillText(page, "Username", username);
  await fillText(page, "Password", password);
  await page.getByRole("button", { name: /Continue/ }).click();
  await page.waitForURL(/\/portal$/, { timeout: 20000 });
  await selectInternalLink(page, /Admin console/, /\/admin$/);
}

async function adminTokenFromPage(page) {
  return (await page.evaluate(() => sessionStorage.getItem("kanidm-dashboard-kanidm-token"))) ?? "";
}

async function createPerson(page) {
  await selectInternalLink(page, /^People$/, /\/admin\/people$/);
  await selectInternalLink(page, /Add user/, /\/admin\/people\/new$/);

  await fillText(page, "Username", personName);
  await fillText(page, "Display name", displayName);
  await page
    .getByRole("textbox", { name: "Email", exact: true })
    .fill(`${personName}@example.test`);
  await page.getByRole("button", { name: /Review user/ }).click();
  await page.getByRole("button", { name: /^Create user$/ }).click();

  await page.getByText("User created").waitFor({ timeout: 25000 });
  await page.getByRole("button", { name: /^Open people$/ }).click();
  await page.waitForURL(/\/admin\/people$/, { timeout: 25000 });
  await page.getByText(displayName).waitFor({ timeout: 20000 });
}

async function issueResetUrl(page) {
  await selectInternalLink(page, /^People$/, /\/admin\/people$/);
  await page.getByPlaceholder("Search people").fill(personName);
  // Select the person in the side list to open the detail panel
  const personButton = page.getByRole("button", { name: new RegExp(personName) });
  await personButton.waitFor({ timeout: 10000 });
  await personButton.click();
  await page.getByRole("button", { name: /Issue reset/ }).click();
  await page.getByLabel("Reset URL").waitFor({ timeout: 20000 });
  return page.getByLabel("Reset URL").inputValue();
}

async function registerPasskeyWithReset(page, resetUrl) {
  await page.goto(resetUrl, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Reset token").waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: "Verify token" }).click();
  await page.getByText(displayName).waitFor({ timeout: 15000 });

  await page.getByLabel("New password").fill(resetPassword);
  await page.getByLabel("Confirm password").fill(resetPassword);
  await page.getByRole("button", { name: "Stage password" }).click();
  await page.getByText("Password staged. Review the credential status, then commit.").waitFor({
    timeout: 15000,
  });

  await page.getByRole("button", { name: "Start TOTP setup" }).click();
  await page
    .getByText("TOTP setup started. Verify the authenticator code before commit.")
    .waitFor({ timeout: 15000 });
  const secret = await page
    .getByLabel("TOTP registration details")
    .locator(".key-value")
    .filter({ hasText: "Secret" })
    .locator("strong")
    .innerText();
  await page.getByLabel("TOTP code").fill(totpCode(secret));
  await page.getByRole("button", { name: "Verify TOTP" }).click();
  await page.getByText("TOTP staged. Review the credential status, then commit.").waitFor({
    timeout: 15000,
  });

  const passkeysSection = page.getByRole("button", { name: /^Passkeys/ });
  if ((await passkeysSection.count()) > 0 && (await passkeysSection.isVisible())) {
    await passkeysSection.click();
  }
  await page.getByRole("button", { name: "Start passkey setup" }).click();
  await page
    .getByText("Passkey setup started. Complete browser registration before commit.")
    .waitFor({ timeout: 15000 });
  await page.getByLabel("Passkey label").fill(passkeyLabel);
  await page.getByRole("button", { name: /^Register passkey$/ }).click();
  await page.getByText("Passkey staged. Review the credential status, then commit.").waitFor({
    timeout: 20000,
  });

  await page.getByRole("button", { name: "Commit update" }).click();
  await page.getByText("Credential update committed.").waitFor({ timeout: 20000 });
}

async function loginWithPasskey(page) {
  await page.goto(appUrl("/login"), { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Passkey" }).click();
  await page.getByLabel("Username").fill(personName);
  await page.getByLabel("Session scope").selectOption("user");
  await page.getByRole("button", { name: /Continue/ }).click();
  await page.waitForURL(/\/portal$/, { timeout: 20000 });
  await page.getByRole("heading", { name: `Welcome, ${displayName}` }).waitFor({
    timeout: 15000,
  });
  if ((await page.locator(".admin-rail").count()) !== 0) {
    throw new Error("Admin rail rendered for non-admin passkey login.");
  }
}

async function deleteFixture(page, adminToken) {
  if (!adminToken) {
    cleanupResults.push({ path: "admin-token", status: 0, ok: false, body: "No admin token" });
    return;
  }

  const path = `/v1/person/${encodeURIComponent(personName)}`;
  const result = await page.evaluate(
    async ({ token, requestPath }) => {
      const response = await fetch(requestPath, {
        method: "DELETE",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const body = await response.text().catch(() => "");
      return {
        path: requestPath,
        status: response.status,
        ok: response.ok || response.status === 404,
        body,
      };
    },
    { token: adminToken, requestPath: path },
  );

  cleanupResults.push(result);
  if (!result.ok) {
    throw new Error(
      `Fixture cleanup failed for ${path}: HTTP ${result.status}${result.body ? ` ${result.body}` : ""}`,
    );
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 1000 },
  });

  page.on("console", (message) => {
    if (message.type() === "error") logs.push(`${message.type()}: ${message.text()}`);
  });
  page.on("pageerror", (error) => logs.push(`pageerror: ${error.message}`));
  page.on("response", (response) => {
    const url = response.url();
    if (response.status() >= 400 && (url.includes("/v1/") || url.includes("/oauth2/"))) {
      failedResponses.push(`${response.status()} ${url}`);
    }
  });

  const { authenticatorId } = await addVirtualAuthenticator(page);
  let adminToken = "";

  try {
    await loginAdmin(page);
    adminToken = await adminTokenFromPage(page);
    if (!adminToken) throw new Error("Admin bearer token was not stored after login.");
    await createPerson(page);
    const resetUrl = await issueResetUrl(page);
    await registerPasskeyWithReset(page, resetUrl);
    await loginWithPasskey(page);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    await deleteFixture(page, adminToken);
    await browser.close();

    console.log(
      JSON.stringify(
        {
          ok: true,
          baseUrl,
          personName,
          displayName,
          passkeyLabel,
          authenticatorId,
          resetRegistrationVerified: true,
          passkeyLoginVerified: true,
          fixtureCleanupVerified: cleanupResults.every((result) => result.ok),
          cleanupResults,
          screenshot: screenshotPath,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await deleteFixture(page, adminToken).catch((cleanupError) => {
      cleanupResults.push({
        path: "cleanup-error",
        status: 0,
        ok: false,
        body: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
      });
    });
    await page.screenshot({ path: failurePath, fullPage: true }).catch(() => {});
    await browser.close();
    console.error(
      JSON.stringify(
        {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
          baseUrl,
          personName,
          displayName,
          passkeyLabel,
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
}

await main();

function totpCode(secret) {
  const key = base32Decode(secret);
  const counter = Math.floor(Date.now() / 1000 / 30);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  counterBuffer.writeUInt32BE(counter >>> 0, 4);
  const digest = createHmac("sha256", key).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const value =
    (((digest[offset] & 0x7f) << 24) |
      ((digest[offset + 1] & 0xff) << 16) |
      ((digest[offset + 2] & 0xff) << 8) |
      (digest[offset + 3] & 0xff)) %
    1_000_000;
  return value.toString().padStart(6, "0");
}

function base32Decode(value) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of value.toUpperCase().replace(/=+$/g, "")) {
    const index = alphabet.indexOf(char);
    if (index < 0) continue;
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}
