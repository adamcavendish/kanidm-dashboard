import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl = process.env.DASHBOARD_URL ?? "http://localhost:5173";
const screenshotDir = process.env.E2E_SCREENSHOT_DIR ?? "/tmp";
const screenshotPath = `${screenshotDir}/kanidm-dashboard-mock-e2e.png`;
const mockConfig = JSON.parse(
  await readFile(new URL("./fixtures/dashboard.config.mock.json", import.meta.url), "utf8"),
);

function appUrl(path) {
  return new URL(path, baseUrl).href;
}

async function useMockConfig(page) {
  await page.route("**/dashboard.config.json", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockConfig),
    }),
  );
}

async function login(page) {
  await page.goto(appUrl("/login"), { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  if (!(await page.getByRole("button", { name: "Password" }).count())) {
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});
  }
  if (!(await page.getByRole("button", { name: "Password" }).count())) {
    throw new Error(
      `Login page did not render mechanisms at ${page.url()}: ${await page.locator("body").innerText()}`,
    );
  }
  await page.getByRole("button", { name: "Password" }).click();
  await page.getByLabel("Username").fill("ava");
  await page.getByLabel("Password").fill("correct horse battery staple");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL("**/portal");
}

async function verifyMfaLoginMethods(page) {
  await page.goto(appUrl("/login"));
  await page.getByRole("button", { name: "TOTP" }).click();
  await page.getByLabel("Username").fill("ava");
  await page.getByLabel("Password").fill("correct horse battery staple");
  await page.getByLabel("TOTP code").fill("123456");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL("**/portal");

  await page.goto(appUrl("/logout"));
  await page.getByRole("link", { name: "Sign in again" }).click();
  await page.waitForURL("**/login");
  await page.getByRole("button", { name: "Backup" }).click();
  await page.getByLabel("Username").fill("ava");
  await page.getByLabel("Password").fill("correct horse battery staple");
  await page.getByLabel("Backup code").fill("backup-1-ci");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL("**/portal");
  await page.goto(appUrl("/logout"));
  await page.getByRole("link", { name: "Sign in again" }).click();
  await page.waitForURL("**/login");

  await page.getByRole("button", { name: "Passkey" }).click();
  await page.getByLabel("Username").fill("ava");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL("**/portal");
  await page.goto(appUrl("/logout"));
  await page.getByRole("link", { name: "Sign in again" }).click();
  await page.waitForURL("**/login");

  await page.getByRole("button", { name: "Security key" }).click();
  await page.getByLabel("Username").fill("ava");
  await page.getByLabel("Password").fill("correct horse battery staple");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL("**/portal");
  await page.goto(appUrl("/logout"));
  await page.getByRole("link", { name: "Sign in again" }).click();
  await page.waitForURL("**/login");
}

async function verifyOAuthSurfaces(page) {
  const query =
    "client_id=orb-registry&scope=openid%20email%20oci_pull&redirect_uri=http%3A%2F%2Flocalhost%3A5050%2Foauth2%2Fcallback&state=ci-state";

  await page.goto(appUrl(`/oauth/resume?${query}`));
  await page.getByText("Resume sign-in").waitFor();
  await page.getByText("orb-registry").waitFor();
  await page.getByRole("link", { name: "Review access" }).click();
  await page.waitForURL("**/oauth/consent?**");
  await page.getByText("oci_pull").waitFor();
  await page.getByRole("link", { name: "Deny" }).click();
  await page.waitForURL("**/oauth/access-denied?**");
  await page.getByText("Access denied").waitFor();
  const returnHref = await page
    .getByRole("link", { name: "Return to application" })
    .getAttribute("href");
  if (!returnHref?.includes("error=access_denied") || !returnHref.includes("state=ci-state")) {
    throw new Error("OAuth access-denied return link did not preserve error and state.");
  }

  await page.goto(appUrl(`/oauth/consent?${query}`));
  const allowHref = await page.getByRole("link", { name: "Allow access" }).getAttribute("href");
  if (
    !allowHref?.includes("code=dashboard-preview-orb-registry") ||
    !allowHref.includes("state=ci-state")
  ) {
    throw new Error("OAuth consent allow link did not preserve code and state.");
  }
}

async function verifyRecovery(page) {
  await page.goto(appUrl("/recover"));
  await page.getByLabel("Username or email").fill("ava@aster.example");
  await page.getByRole("button", { name: "Send recovery instructions" }).click();
  await page
    .getByText("If that account can recover credentials, instructions have been sent.")
    .waitFor();
  await page.getByRole("link", { name: "Return to login" }).click();
  await page.waitForURL("**/login");
}

async function openCredentials(page) {
  await page.getByLabel("Primary").getByRole("link", { name: "Credentials", exact: true }).click();
  await page.waitForURL("**/credentials");
}

async function openAdminPeople(page) {
  await page.getByRole("link", { name: "Admin", exact: true }).click();
  await page.waitForURL("**/admin");
  await page.getByRole("link", { name: "People", exact: true }).click();
  await page.waitForURL("**/admin/people");
}

async function verifyRadius(page) {
  await openCredentials(page);
  await page.getByRole("link", { name: "Manage RADIUS" }).click();
  await page.waitForURL("**/radius");

  const deleteButton = page.getByRole("button", { name: "Delete password" });
  if (await deleteButton.isEnabled()) {
    await deleteButton.click();
  }

  await page.getByText("Not generated").waitFor();
  await page.getByRole("button", { name: "Generate new password" }).click();
  await page.getByText(/^rad-demo-/).waitFor();

  const generated = await page.locator(".secret-display span").innerText();
  if (generated === "rad-demo-2a7c-9e4f") {
    throw new Error("RADIUS generated value reused the seed value.");
  }
}

async function verifySessionRevocation(page) {
  await openCredentials(page);
  const revokeButtons = page.getByRole("button", { name: "Revoke session" });
  const revokeCount = await revokeButtons.count();
  if (!revokeCount) throw new Error("No session revoke buttons were found.");
  await revokeButtons.first().click();
  await page.getByText("Revoked").waitFor();
}

async function verifyReauth(page) {
  await openCredentials(page);
  await page.getByRole("button", { name: "Reauth" }).click();
  await page.waitForURL("**/login");
  await page.getByRole("button", { name: "Password" }).click();
  await page.getByLabel("Username").fill("ava");
  await page.getByLabel("Password").fill("correct horse battery staple");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL("**/credentials");
  await page.getByRole("heading", { name: "Credentials" }).waitFor();
}

async function verifySshKeys(page) {
  await openCredentials(page);
  await page.getByRole("link", { name: "Manage keys" }).click();
  await page.waitForURL("**/ssh-keys");

  await page.getByLabel("Key tag").fill("ci-test");
  await page.getByLabel("Public key").fill("ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAITestKey ci-test");
  await page.getByRole("button", { name: "Add key" }).click();
  await page.getByRole("button", { name: "Delete ci-test" }).waitFor();
  await page.getByRole("button", { name: "Delete ci-test" }).click();
  await page.waitForTimeout(250);

  if ((await page.getByText("ci-test").count()) !== 0) {
    throw new Error("SSH key delete did not remove the tagged key.");
  }
}

async function verifyUnixCredential(page) {
  await openCredentials(page);
  await page.getByRole("link", { name: "Manage Unix" }).click();
  await page.waitForURL("**/unix-credential");

  await page.getByLabel("GID number").fill("12001");
  await page.getByLabel("Login shell").fill("/bin/fish");
  await page.getByRole("button", { name: "Save Unix account" }).click();
  await page.getByText("12001").waitFor();
  await page.getByText("/bin/fish").waitFor();

  await page.getByLabel("New Unix password").fill("mock-unix-password");
  await page.getByRole("button", { name: "Set Unix credential" }).click();
  await page.getByRole("button", { name: "Delete Unix credential" }).waitFor();
  await page.getByRole("button", { name: "Delete Unix credential" }).click();
  await page.getByText("Not set").waitFor();
}

async function verifyCredentialIntent(page) {
  await openAdminPeople(page);
  const issueButtons = page.getByRole("button", { name: "Issue reset" });
  const issueCount = await issueButtons.count();
  if (!issueCount) throw new Error("No Issue reset buttons were found.");

  await issueButtons.first().click();
  await page.getByRole("button", { name: "Issue token" }).click();
  await page.getByLabel("Token").waitFor();
  const adminToken = await page.getByLabel("Token").inputValue();
  const resetUrl = await page.getByLabel("Reset URL").inputValue();
  if (!adminToken.startsWith("kc_demo_") || !resetUrl.includes(encodeURIComponent(adminToken))) {
    throw new Error("Credential intent did not create a usable reset URL.");
  }

  await page.goto(resetUrl);
  await page.getByLabel("Reset token").waitFor();
  if ((await page.getByLabel("Reset token").inputValue()) !== adminToken) {
    throw new Error("Reset page did not prefill the credential intent token.");
  }
  await page.getByRole("button", { name: "Verify token" }).click();
  await page.getByText("Ava Chen").waitFor();
  await page.getByLabel("New password").fill("mock-updated-password");
  await page.getByLabel("Confirm password").fill("mock-updated-password");
  await page.getByRole("button", { name: "Stage password" }).click();
  await page.getByText("Password staged. Review the credential status, then commit.").waitFor();
  await page.getByLabel("New Unix password").fill("mock-unix-reset-password");
  await page.getByLabel("Confirm Unix password").fill("mock-unix-reset-password");
  await page.getByRole("button", { name: "Stage Unix credential" }).click();
  await page
    .getByText("Unix credential staged. Review the credential status, then commit.")
    .waitFor();
  await page.getByRole("button", { name: "Remove Unix credential" }).click();
  await page
    .getByText("Unix credential removal staged. Review the credential status, then commit.")
    .waitFor();
  await page.getByRole("button", { name: "Start passkey setup" }).click();
  await page
    .getByText("Passkey setup started. Complete browser registration before commit.")
    .waitFor();
  await page.getByLabel("Passkey label").fill("CI platform passkey");
  await page.getByRole("button", { name: /^Register passkey$/ }).click();
  await page.getByText("Passkey staged. Review the credential status, then commit.").waitFor();
  await page.locator("select").filter({ hasText: "Laptop passkey" }).selectOption({
    label: "Laptop passkey",
  });
  await page.getByRole("button", { name: "Remove passkey" }).click();
  await page
    .getByText("Passkey removal staged. Review the credential status, then commit.")
    .waitFor();
  await page.getByLabel("SSH key label").fill("ci-reset-key");
  await page
    .getByLabel("SSH public key", { exact: true })
    .fill("ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAITestKey ci-reset");
  await page.getByRole("button", { name: "Add SSH key" }).click();
  await page
    .getByText("SSH public key staged. Review the credential status, then commit.")
    .waitFor();
  await page.getByLabel("Registered SSH public key").selectOption("work-laptop");
  await page.getByRole("button", { name: "Remove SSH key" }).click();
  await page
    .getByText("SSH public key removal staged. Review the credential status, then commit.")
    .waitFor();
  await page.getByRole("button", { name: "Generate backup codes" }).click();
  await page.getByText("Backup codes staged. Store them securely, then commit.").waitFor();
  await page
    .locator('[aria-label="Generated backup codes"]')
    .getByText(/^backup-1-/)
    .waitFor();
  await page.getByRole("button", { name: "Remove backup codes" }).click();
  await page
    .getByText("Backup code removal staged. Review the credential status, then commit.")
    .waitFor();
  await page.getByRole("button", { name: "Start TOTP setup" }).click();
  await page
    .getByText("TOTP setup started. Verify the authenticator code before commit.")
    .waitFor();
  await page.getByLabel("TOTP registration details").getByText("otpauth://totp/").waitFor();
  await page.getByLabel("TOTP code").fill("000000");
  await page.getByRole("button", { name: "Verify TOTP" }).click();
  await page.getByText("The TOTP code did not verify.").waitFor();
  await page.getByLabel("TOTP code").fill("123456");
  await page.getByRole("button", { name: "Verify TOTP" }).click();
  await page.getByText("TOTP staged. Review the credential status, then commit.").waitFor();
  await page.getByRole("button", { name: "Remove TOTP" }).click();
  await page.getByText("TOTP removal staged. Review the credential status, then commit.").waitFor();
  await page.getByRole("button", { name: "Cancel update" }).click();
  await page.getByText("Credential update cancelled.").waitFor();

  await login(page);
  await openCredentials(page);
  await page.getByRole("link", { name: "Enrol device" }).click();
  await page.waitForURL("**/enrol");
  await page.getByRole("button", { name: "Generate intent" }).click();
  await page.getByLabel("Reset URL").waitFor();
  const enrolUrl = await page.getByLabel("Reset URL").inputValue();
  if (!enrolUrl.includes("kc_demo_")) {
    throw new Error("Self-service enrol did not generate a mock credential intent URL.");
  }
}

const browser = await chromium.launch({ headless: true });
try {
  let page = await browser.newPage();
  await useMockConfig(page);
  await page.goto(appUrl("/login"));
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  await verifyOAuthSurfaces(page);
  await verifyRecovery(page);
  await page.close();

  page = await browser.newPage();
  await useMockConfig(page);
  await page.goto(appUrl("/login"));
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await verifyMfaLoginMethods(page);
  await login(page);
  await verifySessionRevocation(page);
  await verifyReauth(page);
  await verifyRadius(page);
  await verifyUnixCredential(page);
  await verifySshKeys(page);
  await verifyCredentialIntent(page);
  await page.screenshot({ path: screenshotPath, fullPage: false });

  console.log(
    JSON.stringify({
      ok: true,
      baseUrl,
      screenshot: screenshotPath,
    }),
  );
} finally {
  await browser.close();
}
