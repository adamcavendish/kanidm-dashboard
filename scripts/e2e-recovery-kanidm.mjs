import { chromium } from "playwright";
import { envValue } from "./kanidm-script-env.mjs";

const baseUrl = envValue("KANIDM_DASHBOARD_URL", "https://localhost:9443");
const screenshotDir = envValue("E2E_SCREENSHOT_DIR", "/tmp");
const screenshotPath = `${screenshotDir}/kanidm-dashboard-recovery-handoff.png`;
const failurePath = `${screenshotDir}/kanidm-dashboard-recovery-handoff-failure.png`;

const logs = [];

function appUrl(path) {
  return new URL(path, baseUrl).href;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    ignoreHTTPSErrors: true,
    viewport: { width: 1280, height: 900 },
  });

  page.on("console", (message) => {
    if (message.type() === "error") {
      logs.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => logs.push(`pageerror: ${error.message}`));

  try {
    await page.goto(appUrl("/recover"), { waitUntil: "domcontentloaded" });
    await page.getByText("Account recovery").waitFor({ timeout: 10000 });
    await page
      .getByText("Continue through Kanidm's protected recovery form.")
      .waitFor({ timeout: 10000 });

    const recoveryLink = page.getByRole("link", { name: /Open recovery/ });
    const href = await recoveryLink.getAttribute("href");
    if (href !== "/ui/recover") {
      throw new Error(`Recovery handoff link should target /ui/recover, got ${href ?? "null"}.`);
    }

    await recoveryLink.click();
    await page.waitForURL(/\/ui\/recover$/, { timeout: 10000 });
    await page.waitForLoadState("domcontentloaded");

    const bodyText = await page.locator("body").innerText();
    const recoveryEnabled = bodyText.includes("Enter your email to recover your account");
    const recoveryDisabled = bodyText.includes(
      "Account recovery has been disabled by your system administrator.",
    );

    if (!recoveryEnabled && !recoveryDisabled) {
      throw new Error(`Native recovery page did not show a known enabled or disabled state.`);
    }

    if (recoveryEnabled && !(await page.locator("input#email").count())) {
      throw new Error("Native recovery form is enabled but the email input is missing.");
    }

    await page.screenshot({ path: screenshotPath, fullPage: true });
    await browser.close();

    console.log(
      JSON.stringify(
        {
          ok: true,
          baseUrl,
          nativeRecoveryState: recoveryEnabled ? "enabled" : "disabled",
          handoffVerified: true,
          emailDeliveryVerified: false,
          screenshot: screenshotPath,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await page.screenshot({ path: failurePath, fullPage: true }).catch(() => {});
    await browser.close();
    console.error(
      JSON.stringify(
        {
          ok: false,
          baseUrl,
          error: error instanceof Error ? error.message : String(error),
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
