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
            name: ["layerhouse"],
            displayname: ["Layerhouse"],
            oauth2_rs_origin_landing: ["http://localhost:5050/"],
            oauth2_rs_scope_map: ['registry_parent@localhost: {"openid", "oci_pull"}'],
            oauth2_rs_sup_scope_map: ['registry_child@localhost: {"oci_push"}'],
            oauth2_rs_claim_map: [
              'roles:registry_child@localhost:;:"admin,owner"',
              'teams:registry_parent@localhost:,:"dev,ops"',
              'permissions:registry_child@localhost: :"read,write"',
            ],
            oauth2_prefer_short_username: ["true"],
            oauth2_consent_prompt_enable: ["true"],
            oauth2_jwt_legacy_crypto_enable: ["false"],
            oauth2_strict_redirect_uri: ["true"],
            oauth2_device_flow_enable: ["true"],
            oauth2_allow_insecure_client_disable_pkce: ["true"],
            oauth2_allow_localhost_redirect: ["true"],
            oauth2_refresh_token_expiry: ["3600"],
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
    expect(state.apps[0]?.supplementalScopeMaps).toEqual([
      { groupId: "group-child", scopes: ["oci_push"] },
    ]);
    expect(state.apps[0]?.claimMaps).toEqual([
      {
        claimName: "roles",
        join: "array",
        rules: [{ groupId: "group-child", values: ["admin", "owner"] }],
      },
      {
        claimName: "teams",
        join: "csv",
        rules: [{ groupId: "group-parent", values: ["dev", "ops"] }],
      },
      {
        claimName: "permissions",
        join: "ssv",
        rules: [{ groupId: "group-child", values: ["read", "write"] }],
      },
    ]);
    expect(state.apps[0]?.policyToggles).toEqual({
      preferShortUsername: true,
      consentPrompt: true,
      jwtLegacyCrypto: false,
      strictRedirectUri: true,
      deviceFlow: true,
      allowInsecureClientDisablePkce: true,
      allowLocalhostRedirect: true,
      refreshTokenExpiry: "3600",
    });
  });

  it("maps direct memberships without treating every available group as selected", () => {
    const state = mapKanidmState(
      {
        attrs: {
          displayname: ["UI User"],
          directmemberof: ["registry_child@localhost"],
          memberof: ["registry_child@localhost", "registry_parent@localhost"],
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
            member: ["ci_runner@localhost"],
            memberof: ["registry_parent@localhost"],
            name: ["registry_child"],
            spn: ["registry_child@localhost"],
            uuid: ["group-child"],
          },
        },
      ],
      [],
      {
        serviceAccounts: [
          {
            attrs: {
              name: ["ci_runner"],
              spn: ["ci_runner@localhost"],
            },
          },
        ],
      },
    );

    expect(state.groups.map((group) => group.id)).toEqual(["group-parent", "group-child"]);
    expect(state.people[0]?.groups).toEqual(["group-child"]);
    expect(resolveGroupClosure(state.people[0]?.groups ?? [], state.groups)).toContain(
      "group-parent",
    );
    expect(state.serviceAccounts[0]?.groups).toEqual(["group-child"]);
  });

  it("maps live service account SSH key attrs into summary state", () => {
    const state = mapKanidmState(
      { attrs: { name: ["admin"], spn: ["admin@localhost"] } },
      [],
      [],
      [],
      {
        serviceAccounts: [
          {
            attrs: {
              name: ["mail_sender"],
              spn: ["mail_sender@localhost"],
              ssh_publickey: ["deploy-host: ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAITest deploy"],
            },
          },
        ],
      },
    );

    expect(state.serviceAccounts[0]?.credential.sshKeys).toBe(1);
    expect(state.serviceAccounts[0]?.status).toBe("ready");
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
    expect(state.serviceAccounts).toHaveLength(0);
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
