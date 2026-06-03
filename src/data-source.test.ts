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

  it("updates person status and deletes people", async () => {
    await ds.updatePersonStatus("u-ava", {
      status: "locked",
      validFrom: "",
      expireAt: "",
      softLockExpire: "",
    });
    let state = await ds.load();
    const updated = state.people.find((person) => person.id === "u-ava");
    expect(updated?.status).toBe("locked");
    expect(updated?.validFrom).toBe("");

    await ds.deletePerson("u-ava");
    state = await ds.load();
    expect(state.people.some((person) => person.id === "u-ava")).toBe(false);
  });

  it("stores mock person certificates", async () => {
    await ds.addPersonCertificate(
      "u-mika",
      "-----BEGIN CERTIFICATE-----\\nmock\\n-----END CERTIFICATE-----",
    );
    const certificates = await ds.personCertificates("u-mika");
    expect(certificates).toHaveLength(1);
    expect(certificates[0]?.pem).toContain("BEGIN CERTIFICATE");
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
          JSON.stringify([
            {
              attrs: {
                name: ["admin"],
                displayname: ["Admin"],
                nsaccountlock: ["true"],
                accountvalidfrom: ["2026-06-04T00:00:00Z"],
                accountexpire: ["2026-07-04T00:00:00Z"],
                accountsoftlockexpire: ["2026-06-20T00:00:00Z"],
                sshpublickey: ["ssh-ed25519 AAAA..."],
                totpimport: ["totp"],
                radiussecret: ["secret"],
              },
            },
          ]),
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
      expect(state.people[0]?.status).toBe("locked");
      expect(state.people[0]?.credential.sshKeys).toBe(1);
      expect(state.people[0]?.credential.totp).toBe(true);
      expect(state.people[0]?.credential.radiusPassword).toBe(true);
      expect(state.people[0]?.validFrom).toBe("2026-06-04T00:00:00Z");
      expect(state.people[0]?.expireAt).toBe("2026-07-04T00:00:00Z");
      expect(state.people[0]?.softLockExpire).toBe("2026-06-20T00:00:00Z");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("uses canonical person attrs for status updates", async () => {
    const originalFetch = globalThis.fetch;
    const calls: Array<{ url: string; method: string; body: string }> = [];
    globalThis.fetch = (async (url, init) => {
      const requestUrl = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
      calls.push({
        url: requestUrl,
        method: init?.method ?? "GET",
        body: typeof init?.body === "string" ? init.body : "",
      });
      return new Response(null, { status: 200 });
    }) as typeof fetch;

    try {
      const ds = new KanidmDataSource({
        mode: "kanidm",
        apiBasePath: "",
        openApiPath: "/docs/v1/openapi.json",
      });
      await ds.updatePersonStatus("admin", {
        status: "expiring",
        validFrom: "2026-06-04T00:00:00Z",
        expireAt: "2026-07-04T00:00:00Z",
        softLockExpire: "2026-06-20T00:00:00Z",
      });
      expect(calls.some((call) => call.url.includes("/_attr/accountexpire"))).toBe(true);
      expect(calls.some((call) => call.url.includes("/_attr/accountvalidfrom"))).toBe(true);
      expect(calls.some((call) => call.url.includes("/_attr/accountsoftlockexpire"))).toBe(true);
      expect(calls.some((call) => call.url.includes("/_attr/nsaccountlock"))).toBe(true);
      expect(calls.every((call) => !call.url.includes("account_expire"))).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("propagates denied status attr deletes", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response(null, { status: 403 })) as typeof fetch;

    try {
      const ds = new KanidmDataSource({
        mode: "kanidm",
        apiBasePath: "",
        openApiPath: "/docs/v1/openapi.json",
      });
      await expect(ds.updatePersonStatus("admin", { status: "active" })).rejects.toThrow();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
