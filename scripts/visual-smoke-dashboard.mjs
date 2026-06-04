import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.DASHBOARD_URL ?? "http://localhost:5173";
const screenshotDir = process.env.E2E_SCREENSHOT_DIR ?? "/tmp/kanidm-dashboard-visual-smoke";
const mockConfig = JSON.parse(
  await readFile(new URL("./fixtures/dashboard.config.mock.json", import.meta.url), "utf8"),
);

const longCompanyName = "Kanidm Dashboard Identity Operations And Orb Chrysa Registry Console";
const longLoginMessage =
  "Sign in to review applications, credentials, recovery settings, and administrator access relationships.";

const viewports = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
];

const modes = ["light", "dark"];

const publicRoutes = [
  { path: "/login", readyText: "Username" },
  { path: "/recover", readyText: "Account recovery" },
  { path: "/reset", readyText: "Reset credentials" },
  { path: "/logout", readyText: "Signed out" },
];

const privateRoutes = [
  { path: "/portal", readyText: "Application portal" },
  { path: "/profile", readyText: "Profile" },
  { path: "/credentials", readyText: "Credentials" },
  { path: "/admin", readyText: "Operations overview" },
  { path: "/admin/people", readyText: "People" },
  { path: "/admin/people/new", readyText: "Add user" },
  { path: "/admin/service-accounts", readyText: "Service accounts" },
  { path: "/admin/service-accounts/new", readyText: "Add service account" },
  { path: "/admin/groups", readyText: "Groups" },
  { path: "/admin/groups/new", readyText: "Add group" },
  { path: "/admin/apps", readyText: "Applications" },
  { path: "/admin/apps/new", readyText: "Add application" },
  { path: "/admin/relationships", readyText: "Relationships" },
  { path: "/admin/branding", readyText: "Branding" },
];

const storageKey = "kanidm-dashboard-state-v2";

function appUrl(path) {
  return new URL(path, baseUrl).href;
}

function visualConfig(mode, dataSourceMode) {
  return {
    ...mockConfig,
    siteName: longCompanyName,
    logoUrl: "",
    loginMessage: longLoginMessage,
    dataSource: {
      ...mockConfig.dataSource,
      mode: dataSourceMode,
    },
    theme: {
      ...mockConfig.theme,
      mode,
    },
  };
}

async function useConfig(page, config) {
  await page.route("**/dashboard.config.json", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(config),
    }),
  );
}

async function seedMockStateBeforeLoad(page, state) {
  await page.addInitScript(
    ({ key, value }) => {
      window.localStorage.setItem(key, JSON.stringify(value));
    },
    { key: storageKey, value: state },
  );
}

async function clearStorage(page) {
  await page.goto(appUrl("/login"), { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

async function login(page) {
  await page.goto(appUrl("/login"), { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.getByRole("button", { name: "Password" }).click();
  await page.getByLabel("Username").fill("ava");
  await page.getByLabel("Password").fill("correct horse battery staple");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL("**/portal");
}

async function navigateSpa(page, path) {
  await page.evaluate((nextPath) => {
    window.history.pushState({}, "", nextPath);
    window.dispatchEvent(new PopStateEvent("popstate"));
    window.scrollTo(0, 0);
  }, path);
}

async function applyLongBranding(page) {
  await navigateSpa(page, "/admin/branding");
  await page.getByRole("heading", { name: "Branding", exact: true }).waitFor();
  await page.getByLabel("Kanidm domain display name").fill(longCompanyName);
  await page.getByRole("button", { name: "Save domain display name" }).click();
  await page.getByText(longCompanyName).first().waitFor();
}

async function assertNoRootOverflow(page, label) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
    bodyClientWidth: document.body.clientWidth,
  }));
  const tolerance = 2;
  if (overflow.scrollWidth > overflow.clientWidth + tolerance) {
    throw new Error(`${label} root overflows horizontally: ${JSON.stringify(overflow)}`);
  }
}

async function assertPageHasContent(page, label) {
  const textLength = await page
    .locator("body")
    .innerText()
    .then((text) => text.trim().length);
  if (textLength < 40) {
    throw new Error(`${label} rendered too little visible text.`);
  }
}

async function assertBasicAccessibility(page, label) {
  const violations = await page.evaluate(() => {
    function isVisible(element) {
      if (element.hidden || element.closest("[hidden], [aria-hidden='true']")) return false;
      return element.getClientRects().length > 0;
    }

    function referencedText(element, attr) {
      return (element.getAttribute(attr) ?? "")
        .split(/\s+/)
        .filter(Boolean)
        .map((id) => document.getElementById(id)?.textContent ?? "")
        .join(" ")
        .trim();
    }

    function controlName(element) {
      const labelledBy = referencedText(element, "aria-labelledby");
      if (labelledBy) return labelledBy;
      if (element.getAttribute("aria-label")) return element.getAttribute("aria-label").trim();
      if (element.getAttribute("title")) return element.getAttribute("title").trim();
      if ("labels" in element && element.labels?.length) {
        return Array.from(element.labels)
          .map((labelElement) => labelElement.textContent ?? "")
          .join(" ")
          .trim();
      }
      if (
        element instanceof HTMLInputElement &&
        ["button", "submit", "reset"].includes(element.type)
      ) {
        return element.value.trim();
      }
      if (element instanceof HTMLImageElement) return element.alt.trim();
      return (element.textContent ?? "").trim();
    }

    const issues = [];
    const ids = new Map();

    for (const element of document.querySelectorAll("[id]")) {
      const id = element.id;
      ids.set(id, (ids.get(id) ?? 0) + 1);
    }
    for (const [id, count] of ids) {
      if (count > 1) issues.push(`duplicate id "${id}" appears ${count} times`);
    }

    for (const image of document.querySelectorAll("img")) {
      if (isVisible(image) && !image.alt.trim()) {
        issues.push(`visible image missing alt text: ${image.outerHTML.slice(0, 120)}`);
      }
    }

    for (const field of document.querySelectorAll("input, select, textarea")) {
      if (field instanceof HTMLInputElement && field.type === "hidden") continue;
      if (isVisible(field) && !controlName(field)) {
        issues.push(`visible form field missing accessible name: ${field.outerHTML.slice(0, 120)}`);
      }
    }

    for (const control of document.querySelectorAll(
      "button, a[href], [role='button'], [role='link']",
    )) {
      if (isVisible(control) && !controlName(control)) {
        issues.push(
          `visible interactive control missing accessible name: ${control.outerHTML.slice(0, 120)}`,
        );
      }
    }

    return issues;
  });

  if (violations.length) {
    throw new Error(`${label} has basic accessibility issues:\n${violations.join("\n")}`);
  }
}

async function capture(page, viewportName, mode, route, kind) {
  const routeName = route.path.replaceAll("/", "_").replace(/^_$/, "root") || "root";
  const path = join(screenshotDir, `${kind}-${viewportName}-${mode}-${routeName}.png`);
  await page.getByText(route.readyText).first().waitFor();
  await assertPageHasContent(page, `${kind} ${viewportName} ${mode} ${route.path}`);
  await assertNoRootOverflow(page, `${kind} ${viewportName} ${mode} ${route.path}`);
  await assertBasicAccessibility(page, `${kind} ${viewportName} ${mode} ${route.path}`);
  await page.screenshot({ path, fullPage: true });
  return path;
}

function personFixture(overrides = {}) {
  return {
    id: "u-ava",
    username: "ava",
    displayName: "Ava Chen",
    legalName: "Ava Chen",
    email: "ava@aster.example",
    status: "active",
    groups: ["g-admins"],
    credential: {
      password: "healthy",
      passkeys: 2,
      totp: true,
      backupCodes: 8,
      unixCredential: true,
      sshKeys: 3,
      radiusPassword: true,
    },
    unix: {
      gidNumber: 10001,
      shell: "/bin/zsh",
      credentialSet: true,
    },
    lastAuth: "2026-05-29 09:12",
    ...overrides,
  };
}

function emptyPortalState() {
  return {
    role: "admin",
    currentUserId: "u-ava",
    branding: {
      companyName: longCompanyName,
      logoUrl: "",
      loginMessage: longLoginMessage,
      poweredBy: true,
    },
    people: [personFixture({ groups: ["g-admins"] })],
    groups: [
      {
        id: "g-admins",
        name: "idm_admins",
        displayName: "Identity administrators",
        description: "Admin group with no linked application access for this empty-state fixture.",
        members: ["u-ava"],
        parentGroups: [],
        managedBy: "g-admins",
      },
    ],
    apps: [],
  };
}

function largeRelationshipState() {
  const groups = [
    {
      id: "g-admins",
      name: "idm_admins",
      displayName: "Identity administrators with a deliberately long display label",
      description: "Admin operators who manage the identity plane.",
      members: ["u-ava"],
      parentGroups: [],
      managedBy: "g-admins",
    },
  ];
  const apps = [];
  const avaGroups = ["g-admins"];
  const people = [personFixture()];

  for (let index = 0; index < 18; index += 1) {
    const teamId = `g-team-${index}`;
    const appGroupId = `g-app-${index}`;
    groups.push(
      {
        id: teamId,
        name: `engineering_platform_operations_team_${index}`,
        displayName: `Engineering Platform Operations Team ${index} With A Long Name`,
        description:
          "Nested source group used to verify dense group tables and relationship views.",
        members: ["u-ava", `u-user-${index}`],
        parentGroups: [appGroupId],
        managedBy: "g-admins",
      },
      {
        id: appGroupId,
        name: `app_access_long_named_service_${index}`,
        displayName: `Access group for a very long Orb Chrysa service name ${index}`,
        description:
          "Parent application access group used to verify nested relationship rendering.",
        members: [],
        parentGroups: [],
        managedBy: "g-admins",
      },
    );
    avaGroups.push(teamId);
    people.push(
      personFixture({
        id: `u-user-${index}`,
        username: `long.user.${index}`,
        displayName: `Long Named Contributor ${index} For Identity Operations`,
        legalName: `Long Named Contributor ${index}`,
        email: `long.user.${index}@aster.example`,
        status: index % 5 === 0 ? "expiring" : "active",
        groups: [teamId],
        lastAuth: `2026-05-${String(10 + (index % 18)).padStart(2, "0")} 10:15`,
      }),
    );
    apps.push({
      id: `app-long-${index}`,
      name: `orb_chrysa_registry_and_deployment_service_${index}`,
      displayName: `Orb Chrysa Registry Deployment Control Plane ${index} With Long Name`,
      landingUrl: `https://orb-chrysa-${index}.very-long-subdomain.aster.example/applications/launch`,
      imageUrl: "",
      clientType: index % 2 === 0 ? "confidential" : "public",
      redirectUris: [
        `https://orb-chrysa-${index}.very-long-subdomain.aster.example/oauth/callback`,
      ],
      allowedGroups: [appGroupId],
      scopes: ["openid", "profile", "email", "groups", "oci_pull", "oci_push"],
      status: index % 4 === 0 ? "attention" : "ready",
    });
  }

  people[0] = personFixture({ groups: avaGroups });

  return {
    role: "admin",
    currentUserId: "u-ava",
    branding: {
      companyName: longCompanyName,
      logoUrl: "",
      loginMessage: longLoginMessage,
      poweredBy: true,
    },
    people,
    groups,
    apps,
  };
}

function orbChrysaScopeMapState() {
  return {
    role: "admin",
    currentUserId: "u-ava",
    branding: {
      companyName: longCompanyName,
      logoUrl: "",
      loginMessage: longLoginMessage,
      poweredBy: true,
    },
    people: [
      personFixture({
        groups: ["g-admins", "g-registry-admins", "g-registry-developers"],
      }),
    ],
    groups: [
      {
        id: "g-admins",
        name: "idm_admins",
        displayName: "Identity administrators",
        description: "Admin operators who manage the identity plane.",
        members: ["u-ava"],
        parentGroups: [],
        managedBy: "g-admins",
      },
      {
        id: "g-registry-admins",
        name: "registry_admins",
        displayName: "registry_admins",
        description: "Orb Chrysa administrators receive the oci_admin scope.",
        members: ["u-ava"],
        parentGroups: [],
        managedBy: "g-admins",
      },
      {
        id: "g-registry-developers",
        name: "registry_developers",
        displayName: "registry_developers",
        description: "Orb Chrysa developers receive push and pull scopes.",
        members: ["u-ava"],
        parentGroups: [],
        managedBy: "g-admins",
      },
    ],
    apps: [],
  };
}

async function runStressScenario(browser, scenario) {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await useConfig(page, visualConfig("dark", "mock"));
  await seedMockStateBeforeLoad(page, scenario.state);
  await login(page);

  for (const route of scenario.routes) {
    await navigateSpa(page, route.path);
    if (route.prepare) await route.prepare(page);
    screenshots.push(await capture(page, "mobile", "dark", route, scenario.name));
  }

  if (errors.length) {
    throw new Error(`${scenario.name} visual stress page errors: ${errors.join("; ")}`);
  }

  await page.close();
}

const screenshots = [];
const browser = await chromium.launch({ headless: true });

try {
  await mkdir(screenshotDir, { recursive: true });

  for (const viewport of viewports) {
    for (const mode of modes) {
      const publicPage = await browser.newPage({
        viewport: { width: viewport.width, height: viewport.height },
      });
      const pageErrors = [];
      publicPage.on("pageerror", (error) => pageErrors.push(error.message));
      await useConfig(publicPage, visualConfig(mode, "kanidm"));
      await clearStorage(publicPage);

      for (const route of publicRoutes) {
        await publicPage.goto(appUrl(route.path), { waitUntil: "domcontentloaded" });
        await publicPage.waitForLoadState("networkidle").catch(() => {});
        screenshots.push(await capture(publicPage, viewport.name, mode, route, "public"));
      }

      if (pageErrors.length) {
        throw new Error(`Public visual smoke page errors: ${pageErrors.join("; ")}`);
      }
      await publicPage.close();

      const privatePage = await browser.newPage({
        viewport: { width: viewport.width, height: viewport.height },
      });
      const privateErrors = [];
      privatePage.on("pageerror", (error) => privateErrors.push(error.message));
      await useConfig(privatePage, visualConfig(mode, "mock"));
      await clearStorage(privatePage);
      await login(privatePage);
      await applyLongBranding(privatePage);

      for (const route of privateRoutes) {
        await navigateSpa(privatePage, route.path);
        screenshots.push(await capture(privatePage, viewport.name, mode, route, "private"));
      }

      if (privateErrors.length) {
        throw new Error(`Private visual smoke page errors: ${privateErrors.join("; ")}`);
      }
      await privatePage.close();
    }
  }

  await runStressScenario(browser, {
    name: "stress-empty",
    state: emptyPortalState(),
    routes: [{ path: "/portal", readyText: "No linked applications" }],
  });

  await runStressScenario(browser, {
    name: "stress-large",
    state: largeRelationshipState(),
    routes: [
      { path: "/portal", readyText: "Orb Chrysa Registry Deployment Control Plane" },
      { path: "/admin/groups", readyText: "Engineering Platform Operations Team" },
      { path: "/admin/apps", readyText: "Orb Chrysa Registry Deployment Control Plane" },
      { path: "/admin/relationships", readyText: "Effective access" },
    ],
  });

  await runStressScenario(browser, {
    name: "stress-orb-scope-map",
    state: orbChrysaScopeMapState(),
    routes: [
      {
        path: "/admin/apps/new",
        readyText: "registry_developers",
        prepare: async (page) => {
          await page.getByRole("button", { name: "Use Orb Chrysa defaults" }).click();
          const adminScopes = page.locator(".scope-map-row").filter({ hasText: "registry_admins" });
          await adminScopes.getByText("oci_admin").waitFor();
          const developerScopes = page
            .locator(".scope-map-row")
            .filter({ hasText: "registry_developers" });
          await developerScopes.getByText("oci_push").waitFor();
          await developerScopes.getByText("oci_pull").waitFor();
        },
      },
    ],
  });

  console.log(
    JSON.stringify({
      ok: true,
      baseUrl,
      screenshots,
    }),
  );
} finally {
  await browser.close();
}
