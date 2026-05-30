import { describe, expect, it } from "vite-plus/test";
import { createGroup, createOAuth2Application } from "./kanidm-composite";
import { Configuration } from "./generated/kanidm-sdk/runtime/runtime";

function requestUrl(url: URL | RequestInfo) {
  if (typeof url === "string") return url;
  if (url instanceof URL) return url.href;
  return url.url;
}

describe("kanidm-composite", () => {
  const config = new Configuration({ basePath: "", headers: { Accept: "application/json" } });

  it("createGroup posts group and follows up with metadata writes", async () => {
    const originalFetch = globalThis.fetch;
    const calls: string[] = [];
    globalThis.fetch = (async (url, init) => {
      calls.push(`${init?.method ?? "GET"} ${requestUrl(url)}`);
      return new Response(null, { status: 200 });
    }) as typeof fetch;

    try {
      const result = await createGroup(config, {
        name: "test_group",
        displayName: "Test Group",
        description: "A test group",
        members: [],
        parentGroups: [],
        managedBy: "idm_admins",
      });
      expect(result.metadataWarnings).toEqual([]);
      expect(calls).toContain("POST /v1/group");
      expect(calls).toContain("PUT /v1/group/test_group/_attr/displayname");
      expect(calls).toContain("PUT /v1/group/test_group/_attr/description");
      expect(calls).toContain("PUT /v1/group/test_group/_attr/entry_managed_by");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("createGroup returns warnings when metadata writes are denied", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url) => {
      const urlStr = requestUrl(url);
      if (urlStr.includes("/_attr/displayname")) {
        return new Response("accessdenied", { status: 403 });
      }
      if (urlStr.includes("/_attr/entry_managed_by")) {
        return new Response("invalid attribute", { status: 400 });
      }
      return new Response(null, { status: 200 });
    }) as typeof fetch;

    try {
      const result = await createGroup(config, {
        name: "test_group",
        displayName: "Different Name",
        description: "",
        members: [],
        parentGroups: [],
        managedBy: "idm_admins",
      });
      expect(result.metadataWarnings.length).toBe(2);
      expect(result.metadataWarnings[0]).toContain("displayname");
      expect(result.metadataWarnings[1]).toContain("entry_managed_by");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("createGroup skips metadata writes when values are empty or match name", async () => {
    const originalFetch = globalThis.fetch;
    const calls: string[] = [];
    globalThis.fetch = (async (url, init) => {
      calls.push((init?.method ?? "GET") + " " + requestUrl(url));
      return new Response(null, { status: 200 });
    }) as typeof fetch;

    try {
      await createGroup(config, {
        name: "mygroup",
        displayName: "mygroup", // same as name, skip
        description: "",
        members: [],
        parentGroups: [],
        managedBy: "",
      });
      // Only the group creation POST, no metadata writes
      expect(calls.length).toBe(1);
      expect(calls[0]).toContain("POST");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("createOAuth2Application posts confidential app with scope maps", async () => {
    const originalFetch = globalThis.fetch;
    const calls: string[] = [];
    globalThis.fetch = (async (url, init) => {
      calls.push(`${init?.method ?? "GET"} ${requestUrl(url)}`);
      if (requestUrl(url).includes("_basic_secret")) {
        return new Response(JSON.stringify("test-secret-123"), { status: 200 });
      }
      return new Response(null, { status: 200 });
    }) as typeof fetch;

    try {
      const result = await createOAuth2Application(config, {
        name: "my-app",
        displayName: "My App",
        landingUrl: "http://localhost:3000",
        imageUrl: "",
        clientType: "confidential",
        redirectUris: ["http://localhost:3000/callback"],
        allowedGroups: ["group1", "group2"],
        scopes: ["openid", "profile"],
        scopeMaps: [],
      });
      expect(result.clientSecret).toBe("test-secret-123");
      expect(calls.some((c) => c.includes("_basic"))).toBe(true);
      expect(calls.some((c) => c.includes("_basic_secret"))).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
