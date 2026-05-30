import { createHmac } from "node:crypto";
import { chromium } from "playwright";
import { envValue } from "./kanidm-script-env.mjs";

const dashboardUrl = envValue(
  "KANIDM_DASHBOARD_URL",
  envValue("DASHBOARD_URL", "http://localhost:5173"),
);
const orbChrysaUrl = envValue("ORB_CHRYSA_URL", "http://localhost:5050");
const orbClientId = envValue("ORB_CHRYSA_CLIENT_ID", "orb-chrysa");
const username = envValue("KANIDM_USERNAME", "idm_admin");
const password = envValue("KANIDM_PASSWORD");
const screenshotDir = envValue("E2E_SCREENSHOT_DIR", "/tmp");

if (!password) {
  console.error(
    "Set KANIDM_PASSWORD in the environment or .env.local to run the Orb Chrysa live OAuth E2E test.",
  );
  process.exit(2);
}

const stamp = Date.now().toString().slice(-6);
const userPersonName = `orbuser_${stamp}`;
const userPassword = `OrbLive-${stamp}-Credential!`;
const screenshotPath = `${screenshotDir}/kanidm-dashboard-orb-chrysa-live-oauth.png`;
const failurePath = `${screenshotDir}/kanidm-dashboard-orb-chrysa-live-oauth-failure.png`;

const logs = [];
const apiResponses = [];
const failedResponses = [];
let userTotpSecret = "";

let orbSessionResult = {
  orbSessionVerified: false,
  orbSessionIdentity: null,
};

function appUrl(path) {
  return new URL(path, dashboardUrl).href;
}

function orbUrl(path) {
  return new URL(path, orbChrysaUrl).href;
}

async function selectInternalLink(page, name, urlPattern) {
  await page.getByRole("link", { name }).click();
  await page.waitForURL(urlPattern, { timeout: 10000 });
}

async function fillText(page, label, value) {
  await page.getByLabel(label, { exact: true }).fill(value);
}

async function clickNativeButtonIfVisible(page, name) {
  const button = page.getByRole("button", { name });
  try {
    await button.waitFor({ state: "visible", timeout: 3000 });
    await button.click();
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes("Timeout")) return false;
    throw error;
  }
}

async function submitNativeTotpIfVisible(page, totpSecret) {
  if (!totpSecret) return false;
  await clickNativeButtonIfVisible(page, /TOTP|Authenticator/i);
  const totpField = page.getByLabel(/Two-factor authentication code|TOTP|code|token/i);
  try {
    await totpField.waitFor({ timeout: 3000 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Timeout")) return false;
    throw error;
  }
  await totpField.fill(totpCode(totpSecret));
  await page.getByRole("button", { name: /Submit|Continue|Verify/i }).click();
  return true;
}

async function fillNativeKanidmLogin(page, loginName, loginPassword, totpSecret = "") {
  await page.getByRole("textbox", { name: "Username" }).fill(loginName);
  await page.getByRole("button", { name: /Begin/i }).click();
  await clickNativeButtonIfVisible(page, totpSecret ? /^TOTP and Password$/i : /^Password$/i);
  await submitNativeTotpIfVisible(page, totpSecret);
  const passwordField = page.getByLabel("Password");
  try {
    await passwordField.waitFor({ timeout: 5000 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Timeout")) {
      const text = await page
        .locator("body")
        .innerText()
        .catch(() => "");
      throw new Error(`Native Kanidm password field did not render. Page text: ${text}`);
    }
    throw error;
  }
  await passwordField.fill(loginPassword);
  await page.getByRole("button", { name: /Submit/i }).click();
  await submitNativeTotpIfVisible(page, totpSecret);
}

async function createPerson(page) {
  await selectInternalLink(page, /^People$/, /\/admin\/people$/);
  await selectInternalLink(page, /Add user/, /\/admin\/people\/new$/);

  await fillText(page, "Username", userPersonName);
  await fillText(page, "Display name", `Orb User ${stamp}`);
  await fillText(page, "Email", `${userPersonName}@example.test`);
  await page.getByRole("button", { name: /registry_developers/i }).click();
  await page.getByRole("button", { name: /Review user/ }).click();
  await page.getByRole("button", { name: /^Create user$/ }).click();
  await page.getByLabel("Credential setup URL").waitFor({ timeout: 20000 });
  const resetUrl = await page.getByLabel("Credential setup URL").inputValue();
  if (!resetUrl.includes("/reset?token=")) {
    throw new Error(`Initial credential setup URL was invalid: ${JSON.stringify(resetUrl)}`);
  }
  await page.getByRole("button", { name: /Open people/ }).click();
  await page.waitForURL(/\/admin\/people$/, { timeout: 25000 });
  await page.getByText(`Orb User ${stamp}`).waitFor({ timeout: 20000 });
  return resetUrl;
}

async function setUserCredentials(page, resetUrl) {
  await page.goto(resetUrl, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Reset token").waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: "Verify token" }).click();
  await page.getByText(`Orb User ${stamp}`).waitFor({ timeout: 15000 });

  await page.getByLabel("New password").fill(userPassword);
  await page.getByLabel("Confirm password").fill(userPassword);
  await page.getByRole("button", { name: "Stage password" }).click();
  await page.getByText("Password staged. Review the credential status, then commit.").waitFor({
    timeout: 15000,
  });

  await page.getByRole("button", { name: "Start TOTP setup" }).click();
  await page
    .getByText("TOTP setup started. Verify the authenticator code before commit.")
    .waitFor({ timeout: 15000 });
  userTotpSecret = await page
    .getByLabel("TOTP registration details")
    .locator(".key-value")
    .filter({ hasText: "Secret" })
    .locator("strong")
    .innerText();
  await page.getByLabel("TOTP code").fill(totpCode(userTotpSecret));
  await page.getByRole("button", { name: "Verify TOTP" }).click();
  await page.getByText("TOTP staged. Review the credential status, then commit.").waitFor({
    timeout: 15000,
  });

  await page.getByRole("button", { name: "Commit update" }).click();
  await page.getByText("Credential update committed.").waitFor({ timeout: 20000 });
}

async function verifyOrbChrysaAppInAdmin(page) {
  await selectInternalLink(page, /^Applications$/, /\/admin\/apps$/);

  const appRow = page.locator("tr").filter({ hasText: /Orb Chrysa/ });
  try {
    await appRow.waitFor({ timeout: 10000 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Timeout")) {
      throw new Error(
        `Orb Chrysa OAuth2 client "${orbClientId}" was not found in the application catalog. ` +
          `It should be created by Orb Chrysa's kanidm-setup.sh. Ensure the dashboard is proxying to the same Kanidm instance that Orb Chrysa uses.`,
      );
    }
    throw error;
  }
  await appRow.getByText("Ready").waitFor({ timeout: 20000 });
  const landingCell = appRow.getByText("http://localhost:5050");
  await landingCell.waitFor({ timeout: 5000 });
}

async function verifyLiveOrbChrysaOAuthFlow(browser) {
  const flowContext = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1280, height: 900 },
  });
  const flowPage = await flowContext.newPage();

  try {
    await flowPage.goto(orbUrl("/oauth2/start"), { waitUntil: "domcontentloaded" });

    if (!flowPage.url().includes("/ui/oauth2")) {
      throw new Error(
        `Orb Chrysa /oauth2/start did not redirect to Kanidm OAuth. Current URL: ${flowPage.url()}`,
      );
    }

    const redirectParams = new URL(flowPage.url()).searchParams;
    if (redirectParams.get("client_id") !== orbClientId) {
      throw new Error(
        `OAuth redirect had unexpected client_id: ${redirectParams.get("client_id")}`,
      );
    }
    const redirectUri = redirectParams.get("redirect_uri");
    if (!redirectUri || !redirectUri.includes("/oauth2/callback")) {
      throw new Error(`OAuth redirect had unexpected redirect_uri: ${redirectUri}`);
    }

    await fillNativeKanidmLogin(flowPage, userPersonName, userPassword, userTotpSecret);

    await flowPage
      .getByRole("heading", { name: /Consent to Proceed to/i })
      .waitFor({ timeout: 20000 });

    const pageText = await flowPage.locator("body").innerText();
    if (!pageText.includes(orbClientId) && !pageText.includes("Orb Chrysa")) {
      throw new Error(`Consent page did not reference the Orb Chrysa application.`);
    }

    const callbackRequestPromise = flowPage.waitForRequest(
      (request) => request.url().startsWith(orbUrl("/oauth2/callback")),
      { timeout: 20000 },
    );
    await flowPage.getByRole("button", { name: /Proceed/i }).click();

    const callbackRequest = await callbackRequestPromise;
    const callbackUrl = new URL(callbackRequest.url());
    if (!callbackUrl.searchParams.get("code")) {
      throw new Error(`Orb Chrysa OAuth callback did not include a code: ${callbackUrl.href}`);
    }
    if (!callbackUrl.searchParams.get("state")) {
      throw new Error(`Orb Chrysa OAuth callback did not include state: ${callbackUrl.href}`);
    }

    await flowPage.waitForURL(orbUrl("/"), { timeout: 20000 }).catch(() => {});
    await flowPage.waitForTimeout(1000);

    const sessionResponse = await flowPage.evaluate(async (apiBase) => {
      const response = await fetch(`${apiBase}/api/v1/session`, {
        headers: { Accept: "application/json" },
      });
      const body = await response.text();
      return { status: response.status, ok: response.ok, body };
    }, orbChrysaUrl);

    if (!sessionResponse.ok) {
      throw new Error(
        `Orb Chrysa /api/v1/session returned HTTP ${sessionResponse.status}: ${sessionResponse.body}`,
      );
    }

    let sessionData;
    try {
      sessionData = JSON.parse(sessionResponse.body);
    } catch {
      throw new Error(
        `Orb Chrysa /api/v1/session did not return valid JSON: ${sessionResponse.body}`,
      );
    }

    if (!sessionData.authenticated && !sessionData.username && !sessionData.name) {
      throw new Error(
        `Orb Chrysa /api/v1/session did not report an authenticated identity: ${sessionResponse.body}`,
      );
    }

    return {
      orbSessionVerified: true,
      orbSessionIdentity: sessionData,
    };
  } finally {
    await flowContext.close();
  }
}

async function verifyAccessDeniedFlow(browser) {
  const deniedContext = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1280, height: 900 },
  });
  const deniedPage = await deniedContext.newPage();

  try {
    await deniedPage.goto(orbUrl("/oauth2/start"), { waitUntil: "domcontentloaded" });

    if (!deniedPage.url().includes("/ui/oauth2")) {
      throw new Error(
        `Orb Chrysa /oauth2/start did not redirect to Kanidm OAuth for access-denied check.`,
      );
    }

    await fillNativeKanidmLogin(deniedPage, username, password);

    await deniedPage.getByRole("heading", { name: "Access Denied" }).waitFor({ timeout: 20000 });
    if (!deniedPage.url().includes("/ui/oauth2/resume")) {
      throw new Error(`Access-denied page had unexpected URL: ${deniedPage.url()}`);
    }

    return true;
  } finally {
    await deniedContext.close();
  }
}

async function deletePerson(page, adminToken) {
  const result = await page.evaluate(
    async ({ token, personName }) => {
      const response = await fetch(`/v1/person/${encodeURIComponent(personName)}`, {
        method: "DELETE",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const body = await response.text().catch(() => "");
      return {
        path: `/v1/person/${personName}`,
        status: response.status,
        ok: response.ok || response.status === 404,
        body,
      };
    },
    { token: adminToken, personName: userPersonName },
  );

  if (!result.ok) {
    throw new Error(
      `Fixture cleanup failed: HTTP ${result.status}${result.body ? ` ${result.body}` : ""}`,
    );
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();

  page.on("console", (message) => {
    if (message.type() === "error") {
      logs.push(`${message.type()}: ${message.text()}`);
    }
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

  let adminToken = "";

  try {
    await page.goto(appUrl("/login"), { waitUntil: "domcontentloaded" });
    await page.getByText("Session scope").waitFor({ timeout: 10000 });

    await fillText(page, "Username", username);
    await fillText(page, "Password", password);
    await page.waitForFunction(() => {
      const button = [...document.querySelectorAll("button")].find((candidate) =>
        candidate.textContent?.includes("Continue"),
      );
      return button && !button.disabled;
    });

    await page.getByRole("button", { name: /Continue/ }).click();
    await page.waitForURL(/\/portal$/, { timeout: 20000 });
    adminToken =
      (await page.evaluate(() => sessionStorage.getItem("kanidm-dashboard-kanidm-token"))) ?? "";
    if (!adminToken) {
      throw new Error("Admin login did not store a bearer token for fixture cleanup.");
    }

    await selectInternalLink(page, /Admin console/, /\/admin$/);

    await verifyOrbChrysaAppInAdmin(page);

    const resetUrl = await createPerson(page);
    await setUserCredentials(page, resetUrl);

    orbSessionResult = await verifyLiveOrbChrysaOAuthFlow(browser);
    const accessDeniedVerified = await verifyAccessDeniedFlow(browser);

    await page.screenshot({ path: screenshotPath, fullPage: true });

    await deletePerson(page, adminToken);
    await browser.close();

    console.log(
      JSON.stringify(
        {
          ok: true,
          dashboardUrl,
          orbChrysaUrl,
          orbClientId,
          userPersonName,
          orbAppVerified: true,
          orbSessionVerified: orbSessionResult.orbSessionVerified,
          orbSessionIdentity: orbSessionResult.orbSessionIdentity,
          orbAccessDeniedVerified: accessDeniedVerified,
          screenshot: screenshotPath,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await page.screenshot({ path: failurePath, fullPage: true }).catch(() => {});
    if (adminToken) {
      await deletePerson(page, adminToken).catch(() => {});
    }
    await browser.close();
    console.error(
      JSON.stringify(
        {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
          dashboardUrl,
          orbChrysaUrl,
          orbClientId,
          userPersonName,
          apiResponses,
          failedResponses,
          logs,
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
