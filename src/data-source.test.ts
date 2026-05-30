import { describe, expect, it } from "vite-plus/test";
import { MockDataSource, KanidmDataSource } from "./data-source";

describe("MockDataSource", () => {
  const ds = new MockDataSource("test-storage");

  it("load returns the initial state", async () => {
    const state = await ds.load();
    expect(state.people.length).toBeGreaterThan(0);
    expect(state.groups.length).toBeGreaterThan(0);
    expect(state.branding.companyName).toBe("Kanidm Dashboard");
  });

  it("radiusPassword returns password for a person with radius enabled", async () => {
    const pw = await ds.radiusPassword("u-ava");
    expect(pw).toBeTruthy();
  });

  it("generateRadiusPassword creates and returns a password", async () => {
    const pw = await ds.generateRadiusPassword("u-ava");
    expect(pw).toMatch(/^rad-demo-/);
    const pw2 = await ds.radiusPassword("u-ava");
    expect(pw2).toBe(pw);
  });

  it("deleteRadiusPassword removes password and updates state", async () => {
    await ds.deleteRadiusPassword("u-ava");
    const pw = await ds.radiusPassword("u-ava");
    expect(pw).toBeNull();
  });

  it("setDomainDisplayName updates branding", async () => {
    await ds.setDomainDisplayName("Test Corp");
    const state = await ds.load();
    expect(state.branding.companyName).toBe("Test Corp");
  });

  it("uploadDomainImage sets logoUrl", async () => {
    await ds.uploadDomainImage(new File([], "test.png"));
    const state = await ds.load();
    expect(state.branding.logoUrl).toBe("/ui/images/domain");
  });

  it("deleteDomainImage clears logoUrl", async () => {
    await ds.deleteDomainImage();
    const state = await ds.load();
    expect(state.branding.logoUrl).toBe("");
  });
});

describe("KanidmDataSource", () => {
  it("constructor builds Configuration with correct basePath", () => {
    const ds = new KanidmDataSource({
      mode: "kanidm",
      apiBasePath: "/api/",
      openApiPath: "/docs/v1/openapi.json",
    });
    expect(ds.config.basePath).toBe("/api");
  });

  it("constructor strips trailing slash from basePath", () => {
    const ds = new KanidmDataSource({
      mode: "kanidm",
      apiBasePath: "/api/",
      openApiPath: "/docs/v1/openapi.json",
    });
    expect(ds.config.basePath).toBe("/api");
  });

  it("load fetches and maps Kanidm state", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url) => {
      const u = url as string;
      if (u.includes("/v1/auth")) {
        return new Response(JSON.stringify({ sessionid: "s1", state: { success: "token" } }), {
          status: 200,
        });
      }
      if (u.includes("/v1/self")) {
        return new Response(
          JSON.stringify({ youare: { attrs: { name: ["admin"], displayname: ["Admin"] } } }),
          { status: 200 },
        );
      }
      if (u.includes("/v1/person")) {
        return new Response(
          JSON.stringify([{ attrs: { name: ["admin"], displayname: ["Admin"] } }]),
          { status: 200 },
        );
      }
      if (u.includes("/v1/group")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (u.includes("/v1/oauth2")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (u.includes("/v1/self/_applinks")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (u.includes("/v1/domain/_attr/domain_display_name")) {
        return new Response(JSON.stringify(["Test"]), { status: 200 });
      }
      if (u.includes("/v1/domain")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      return new Response(null, { status: 404 });
    }) as typeof fetch;

    try {
      const ds = new KanidmDataSource(
        {
          mode: "kanidm",
          apiBasePath: "",
          openApiPath: "/docs/v1/openapi.json",
        },
        "test-token",
      );
      const state = await ds.load();
      expect(state.people).toBeDefined();
      expect(state.groups).toBeDefined();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
