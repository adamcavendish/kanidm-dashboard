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

  it("mirrors service account vault operations", async () => {
    const vault = new MockDataSource("service-account-storage");
    const serviceAccount = await vault.createServiceAccount({
      name: "ci_runner",
      displayName: "CI Runner",
      description: "Runs deployment automation.",
      managedBy: "g-admins",
      groups: ["g-engineering"],
    });

    expect(serviceAccount.name).toBe("ci_runner");
    expect((await vault.load()).serviceAccounts.some((item) => item.id === serviceAccount.id)).toBe(
      true,
    );

    await vault.updateServiceAccount(serviceAccount.id, {
      displayName: "CI Runner Updated",
      description: "Runs release automation.",
      managedBy: "g-engineering",
    });
    expect(
      (await vault.load()).serviceAccounts.find((item) => item.id === serviceAccount.id)
        ?.displayName,
    ).toBe("CI Runner Updated");

    const secret = await vault.generateServiceAccountApiToken(serviceAccount.id, {
      label: "release token",
      readWrite: true,
      compact: false,
    });
    expect(secret).toMatch(/^svctok_/);
    let tokens = await vault.serviceAccountApiTokens(serviceAccount.id);
    expect(tokens).toHaveLength(1);
    await vault.deleteServiceAccountApiToken(serviceAccount.id, tokens[0]!.tokenId);
    tokens = await vault.serviceAccountApiTokens(serviceAccount.id);
    expect(tokens).toHaveLength(0);

    await vault.addServiceAccountSshPublicKey(
      serviceAccount.id,
      "deploy-host",
      "ssh-ed25519 AAAA... ci-runner",
    );
    expect(await vault.serviceAccountSshPublicKeys(serviceAccount.id)).toHaveLength(1);
    await vault.deleteServiceAccountSshPublicKey(serviceAccount.id, "deploy-host");
    expect(await vault.serviceAccountSshPublicKeys(serviceAccount.id)).toHaveLength(0);

    const status = await vault.generateServiceAccountPassword(serviceAccount.id);
    expect(status.reachable).toBe(true);
    await vault.extendServiceAccountUnixAccount(serviceAccount.id, {
      gidNumber: 22001,
      shell: "/usr/sbin/nologin",
    });
    const unix = (await vault.load()).serviceAccounts.find(
      (item) => item.id === serviceAccount.id,
    )?.unix;
    expect(unix?.gidNumber).toBe(22001);
    expect(unix?.credentialSet).toBe(true);

    await vault.deleteServiceAccount(serviceAccount.id);
    expect((await vault.load()).serviceAccounts.some((item) => item.id === serviceAccount.id)).toBe(
      false,
    );
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
      if (u.includes("/v1/service_account")) {
        return new Response(
          JSON.stringify([
            {
              attrs: {
                name: ["mail_sender"],
                displayname: ["Mail Sender"],
                description: ["Sends recovery mail"],
                memberof: ["idm_admins@localhost"],
                sshpublickey: ["ssh-ed25519 AAAA..."],
                gidnumber: ["21001"],
                loginshell: ["/usr/sbin/nologin"],
              },
            },
          ]),
          { status: 200 },
        );
      }
      if (u.includes("/v1/group")) {
        return new Response(
          JSON.stringify([
            {
              attrs: {
                name: ["idm_admins"],
                displayname: ["Identity admins"],
                uuid: ["group-admins"],
              },
            },
          ]),
          { status: 200 },
        );
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
      expect(state.serviceAccounts[0]?.name).toBe("mail_sender");
      expect(state.serviceAccounts[0]?.groups).toEqual(["group-admins"]);
      expect(state.serviceAccounts[0]?.credential.sshKeys).toBe(1);
      expect(state.serviceAccounts[0]?.unix.gidNumber).toBe(21001);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("uses Kanidm service account API token wire fields", async () => {
    const originalFetch = globalThis.fetch;
    const calls: Array<{ url: string; method: string; body: string }> = [];
    globalThis.fetch = (async (url, init) => {
      const requestUrl = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
      calls.push({
        url: requestUrl,
        method: init?.method ?? "GET",
        body: typeof init?.body === "string" ? init.body : "",
      });
      return new Response(JSON.stringify("svctok_test"), { status: 200 });
    }) as typeof fetch;

    try {
      const ds = new KanidmDataSource({
        mode: "kanidm",
        apiBasePath: "",
        openApiPath: "/docs/v1/openapi.json",
      });
      const token = await ds.generateServiceAccountApiToken("mail_sender", {
        label: "mail sender token",
        expiry: "2026-07-04T00:00:00Z",
        readWrite: true,
        compact: false,
      });
      expect(token).toBe("svctok_test");
      expect(calls[0]?.url).toContain("/v1/service_account/mail_sender/_api_token");
      expect(JSON.parse(calls[0]?.body ?? "{}")).toEqual({
        label: "mail sender token",
        expiry: "2026-07-04T00:00:00Z",
        read_write: true,
        compact: false,
      });

      await ds.generateServiceAccountApiToken("mail_sender", {
        label: "no expiry token",
        readWrite: false,
        compact: true,
      });
      expect(JSON.parse(calls[1]?.body ?? "{}")).toEqual({
        label: "no expiry token",
        expiry: null,
        read_write: false,
        compact: true,
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("reads Kanidm service account SSH key labels from entry attrs", async () => {
    const originalFetch = globalThis.fetch;
    const calls: string[] = [];
    globalThis.fetch = (async (url) => {
      const requestUrl = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
      calls.push(requestUrl);
      if (
        requestUrl.includes("/v1/service_account/mail_sender") &&
        !requestUrl.includes("_ssh_pubkeys")
      ) {
        return new Response(
          JSON.stringify({
            attrs: {
              ssh_publickey: ["deploy-host: ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAITest deploy"],
            },
          }),
          { status: 200 },
        );
      }
      return new Response(null, { status: 404 });
    }) as typeof fetch;

    try {
      const ds = new KanidmDataSource({
        mode: "kanidm",
        apiBasePath: "",
        openApiPath: "/docs/v1/openapi.json",
      });
      const keys = await ds.serviceAccountSshPublicKeys("mail_sender");
      expect(keys).toEqual([
        { tag: "deploy-host", key: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAITest deploy" },
      ]);
      expect(calls.every((call) => !call.includes("_ssh_pubkeys"))).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("keeps raw Kanidm service account SSH keys when attrs are unavailable", async () => {
    const originalFetch = globalThis.fetch;
    const calls: string[] = [];
    globalThis.fetch = (async (url) => {
      const requestUrl = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
      calls.push(requestUrl);
      if (
        requestUrl.includes("/v1/service_account/mail_sender") &&
        !requestUrl.includes("_ssh_pubkeys")
      ) {
        return new Response(null, { status: 403 });
      }
      if (requestUrl.endsWith("/v1/service_account/mail_sender/_ssh_pubkeys")) {
        return new Response(JSON.stringify(["ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAITest deploy"]), {
          status: 200,
        });
      }
      return new Response(null, { status: 404 });
    }) as typeof fetch;

    try {
      const ds = new KanidmDataSource({
        mode: "kanidm",
        apiBasePath: "",
        openApiPath: "/docs/v1/openapi.json",
      });
      const keys = await ds.serviceAccountSshPublicKeys("mail_sender");
      expect(keys).toEqual([
        { tag: "key-1", key: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAITest deploy" },
      ]);
      expect(calls.every((call) => !call.includes("_ssh_pubkeys/ssh-ed25519"))).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("uses Kanidm OAuth2 policy endpoints", async () => {
    const originalFetch = globalThis.fetch;
    const calls: Array<{ url: string; method: string; body: string }> = [];
    globalThis.fetch = (async (url, init) => {
      const requestUrl = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
      calls.push({
        url: requestUrl,
        method: init?.method ?? "GET",
        body: typeof init?.body === "string" ? init.body : "",
      });
      if (requestUrl.endsWith("/v1/oauth2/grafana") && (init?.method ?? "GET") === "GET") {
        return new Response(
          JSON.stringify({
            attrs: {
              oauth2_rs_scope_map: ['old_group@localhost: {"openid"}'],
              oauth2_rs_sup_scope_map: ['old_group@localhost: {"legacy"}'],
              oauth2_rs_claim_map: ['roles:old_group@localhost:;:"legacy"'],
            },
          }),
          { status: 200 },
        );
      }
      if (requestUrl.endsWith("/v1/oauth2/grafana/_basic_secret")) {
        return new Response(JSON.stringify("secret-test"), { status: 200 });
      }
      return new Response(null, { status: 200 });
    }) as typeof fetch;

    try {
      const ds = new KanidmDataSource({
        mode: "kanidm",
        apiBasePath: "",
        openApiPath: "/docs/v1/openapi.json",
      });
      await expect(ds.getOAuth2ApplicationClientSecret("grafana")).resolves.toBe("secret-test");
      await ds.updateOAuth2ApplicationPolicy("grafana", {
        scopeMaps: [{ groupId: "idm_admins", scopes: ["openid", "profile"] }],
        supplementalScopeMaps: [{ groupId: "idm_admins", scopes: ["audit"] }],
        claimMaps: [
          {
            claimName: "roles",
            join: "array",
            rules: [{ groupId: "idm_admins", values: ["admin", "owner"] }],
          },
          {
            claimName: "teams",
            join: "csv",
            rules: [{ groupId: "idm_oauth2_admins", values: ["dev", "ops"] }],
          },
          {
            claimName: "permissions",
            join: "ssv",
            rules: [{ groupId: "idm_group_admins", values: ["read", "write"] }],
          },
        ],
      });

      const findCall = (method: string, path: string) =>
        calls.find((call) => call.method === method && call.url.endsWith(path));

      expect(calls.some((call) => call.url.endsWith("/_basic_secret"))).toBe(true);
      expect(
        calls.some((call) => call.method === "DELETE" && call.url.includes("_scopemap/old_group")),
      ).toBe(true);
      expect(findCall("POST", "/v1/oauth2/grafana/_scopemap/idm_admins")?.body).toBe(
        JSON.stringify(["openid", "profile"]),
      );
      expect(
        calls.some(
          (call) => call.method === "DELETE" && call.url.includes("_sup_scopemap/old_group"),
        ),
      ).toBe(true);
      expect(findCall("POST", "/v1/oauth2/grafana/_sup_scopemap/idm_admins")?.body).toBe(
        JSON.stringify(["audit"]),
      );
      expect(
        calls.some(
          (call) => call.method === "DELETE" && call.url.includes("_claimmap/roles/old_group"),
        ),
      ).toBe(true);
      expect(findCall("POST", "/v1/oauth2/grafana/_claimmap/roles")?.body).toBe(
        JSON.stringify("array"),
      );
      expect(findCall("POST", "/v1/oauth2/grafana/_claimmap/roles/idm_admins")?.body).toBe(
        JSON.stringify(["admin", "owner"]),
      );
      expect(findCall("POST", "/v1/oauth2/grafana/_claimmap/teams")?.body).toBe(
        JSON.stringify("csv"),
      );
      expect(findCall("POST", "/v1/oauth2/grafana/_claimmap/teams/idm_oauth2_admins")?.body).toBe(
        JSON.stringify(["dev", "ops"]),
      );
      expect(findCall("POST", "/v1/oauth2/grafana/_claimmap/permissions")?.body).toBe(
        JSON.stringify("ssv"),
      );
      expect(
        findCall("POST", "/v1/oauth2/grafana/_claimmap/permissions/idm_group_admins")?.body,
      ).toBe(JSON.stringify(["read", "write"]));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("does not fail global load when service account list is denied", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url) => {
      const u = url as string;
      if (u.includes("/v1/self")) {
        return new Response(
          JSON.stringify({ youare: { attrs: { name: ["admin"], displayname: ["Admin"] } } }),
          { status: 200 },
        );
      }
      if (u.includes("/v1/person")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (u.includes("/v1/service_account")) {
        return new Response(null, { status: 403 });
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
      expect(state.serviceAccounts).toEqual([]);
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
