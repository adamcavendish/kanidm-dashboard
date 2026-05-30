import { describe, expect, it } from "vite-plus/test";
import { defaultDashboardConfig } from "./domain";
import { mapKanidmState } from "./kanidm-mappers";
import {
  contrastRatio,
  createUnauthenticatedState,
  getPresetTheme,
  mergeDashboardConfig,
  resolveGroupClosure,
} from "./store";
import { seedGroups } from "./seed";

describe("theme helpers", () => {
  it("returns a valid built-in preset", () => {
    const theme = getPresetTheme("forest");

    expect(theme.preset).toBe("forest");
    expect(theme.accentColor).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("calculates readable accent contrast against the dark shell", () => {
    expect(contrastRatio("#007aff", "#0b0f14")).toBeGreaterThan(3);
  });

  it("keeps the default accent readable in light mode", () => {
    expect(contrastRatio("#007aff", "#ffffff")).toBeGreaterThan(3);
  });

  it("merges static dashboard config without dropping defaults", () => {
    const config = mergeDashboardConfig({
      logoUrl: "/brand.svg",
      loginMessage: "Welcome to Example Corp.",
      theme: { mode: "light", accentColor: "#0057d8" },
      dataSource: { mode: "kanidm" },
    });

    expect(config.logoUrl).toBe("/brand.svg");
    expect(config.loginMessage).toBe("Welcome to Example Corp.");
    expect(config.theme.mode).toBe("light");
    expect(config.theme.accentColor).toBe("#0057d8");
    expect(config.theme.logoTreatment).toBe(defaultDashboardConfig.theme.logoTreatment);
    expect(config.dataSource.mode).toBe("kanidm");
    expect(config.dataSource.openApiPath).toBe(defaultDashboardConfig.dataSource.openApiPath);
  });

  it("allows mock data source outside production builds", () => {
    const config = mergeDashboardConfig(
      {
        dataSource: { mode: "mock" },
      },
      { production: false, allowMockData: false },
    );

    expect(config.dataSource.mode).toBe("mock");
  });

  it("rejects accidental mock data source in production builds", () => {
    const config = mergeDashboardConfig(
      {
        dataSource: { mode: "mock" },
      },
      { production: true, allowMockData: false },
    );

    expect(config.dataSource.mode).toBe("kanidm");
    expect(config.dataSource.openApiPath).toBe(defaultDashboardConfig.dataSource.openApiPath);
  });

  it("allows explicit demo production artifacts only with a build flag", () => {
    const config = mergeDashboardConfig(
      {
        dataSource: { mode: "mock" },
      },
      { production: true, allowMockData: true },
    );

    expect(config.dataSource.mode).toBe("mock");
  });
});

describe("relationship helpers", () => {
  it("resolves parent group access relationships", () => {
    expect(resolveGroupClosure(["g-grafana"], seedGroups)).toContain("g-engineering");
  });

  it("resolves Kanidm nested group refs after mapping", () => {
    const state = mapKanidmState(
      {
        attrs: {
          displayname: ["UI User"],
          directmemberof: ["registry_child@localhost"],
          name: ["uiuser"],
          spn: ["uiuser@localhost"],
        },
      },
      [],
      [
        {
          attrs: {
            name: ["registry_parent"],
            spn: ["registry_parent@localhost"],
            uuid: ["group-parent"],
          },
        },
        {
          attrs: {
            directmemberof: ["registry_parent@localhost"],
            memberof: ["registry_parent@localhost"],
            name: ["registry_child"],
            spn: ["registry_child@localhost"],
            uuid: ["group-child"],
          },
        },
      ],
      [
        {
          attrs: {
            name: ["orb-chrysa"],
            displayname: ["Orb Chrysa"],
            oauth2_rs_origin_landing: ["http://localhost:5050/"],
            oauth2_rs_scope_map: ['registry_parent@localhost: {"openid", "oci_pull"}'],
          },
        },
      ],
    );

    const child = state.groups.find((group) => group.name === "registry_child");
    expect(child?.parentGroups).toEqual(["group-parent"]);
    expect(resolveGroupClosure(state.people[0]?.groups ?? [], state.groups)).toContain(
      "group-parent",
    );
    expect(state.apps[0]?.allowedGroups).toEqual(["group-parent"]);
  });
});

describe("startup state", () => {
  it("does not seed real-mode unauthenticated state with demo people or apps", () => {
    const state = createUnauthenticatedState({
      ...defaultDashboardConfig,
      siteName: "Example Corp",
    });

    expect(state.branding.companyName).toBe("Example Corp");
    expect(state.branding.logoUrl).toBe("");
    expect(state.branding.loginMessage).toBe(
      "Sign in to continue to your company applications and identity settings.",
    );
    expect(state.role).toBe("user");
    expect(state.currentUserId).toBe("anonymous");
    expect(state.people).toHaveLength(1);
    expect(state.people[0]?.displayName).toBe("Not signed in");
    expect(state.people.some((person) => person.displayName === "Ava Chen")).toBe(false);
    expect(state.groups).toHaveLength(0);
    expect(state.apps).toHaveLength(0);
  });

  it("applies static unauthenticated branding from dashboard config", () => {
    const state = createUnauthenticatedState({
      ...defaultDashboardConfig,
      siteName: "Example Corp",
      logoUrl: "/example-logo.svg",
      loginMessage: "Use your Example identity.",
    });

    expect(state.branding.companyName).toBe("Example Corp");
    expect(state.branding.logoUrl).toBe("/example-logo.svg");
    expect(state.branding.loginMessage).toBe("Use your Example identity.");
  });
});
