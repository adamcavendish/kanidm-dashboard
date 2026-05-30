import { describe, expect, it } from "vite-plus/test";
import {
  loginWithPassword,
  loginWithPasswordTotp,
  loginWithPasswordBackupCode,
} from "./kanidm-auth";

describe("kanidm-auth", () => {
  it("loginWithPassword calls the auth API and returns a bearer token", async () => {
    const originalFetch = globalThis.fetch;
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = (async (url, init) => {
      calls.push({ url: url as string, init });
      if (calls.length === 1) {
        return new Response(
          JSON.stringify({
            sessionid: "s1",
            state: { choose: ["password"] },
          }),
          { status: 200, headers: { "X-KANIDM-AUTH-SESSION-ID": "auth-session-1" } },
        );
      }
      if (calls.length === 2) {
        return new Response(
          JSON.stringify({ sessionid: "s2", state: { continue: ["password"] } }),
          { status: 200, headers: { "X-KANIDM-AUTH-SESSION-ID": "auth-session-2" } },
        );
      }
      return new Response(
        JSON.stringify({ sessionid: "s3", state: { success: "bearer-token-123" } }),
        { status: 200 },
      );
    }) as typeof fetch;

    try {
      const token = await loginWithPassword("", "testuser", "testpass");
      expect(token).toBe("bearer-token-123");
      expect(calls.length).toBe(3);
      expect(calls[0]?.url).toBe("/v1/auth");
      const initBody = JSON.parse((calls[0]?.init?.body as string) ?? "{}");
      expect(initBody.step.init2.username).toBe("testuser");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("loginWithPassword throws on auth denial", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({ sessionid: "s1", state: { choose: ["password"] } }), {
        status: 200,
        headers: { "X-KANIDM-AUTH-SESSION-ID": "s1" },
      });
    }) as typeof fetch;

    try {
      await loginWithPassword("", "baduser", "badpass");
      throw new Error("Expected login to fail");
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("loginWithPasswordTotp submits TOTP then password", async () => {
    const originalFetch = globalThis.fetch;
    const steps: string[] = [];
    globalThis.fetch = (async (url, init) => {
      const body = JSON.parse((init?.body as string) ?? "{}");
      if (body.step?.cred?.totp) steps.push("totp");
      if (body.step?.cred?.password) steps.push("password");
      if (body.step?.init2)
        return new Response(
          JSON.stringify({ sessionid: "s1", state: { choose: ["passwordmfa"] } }),
          { status: 200, headers: { "X-KANIDM-AUTH-SESSION-ID": "s1" } },
        );
      if (body.step?.begin === "passwordmfa")
        return new Response(
          JSON.stringify({ sessionid: "s2", state: { continue: ["totp", "password"] } }),
          { status: 200 },
        );
      if (body.step?.cred?.totp)
        return new Response(
          JSON.stringify({ sessionid: "s3", state: { continue: ["password"] } }),
          { status: 200 },
        );
      return new Response(JSON.stringify({ sessionid: "s4", state: { success: "mfa-token" } }), {
        status: 200,
      });
    }) as typeof fetch;

    try {
      const token = await loginWithPasswordTotp("", "testuser", "testpass", 123456);
      expect(token).toBe("mfa-token");
      expect(steps).toEqual(["totp", "password"]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("loginWithPasswordBackupCode submits backup code then password", async () => {
    const originalFetch = globalThis.fetch;
    const steps: string[] = [];
    globalThis.fetch = (async (url, init) => {
      const body = JSON.parse((init?.body as string) ?? "{}");
      if (body.step?.cred?.backupcode) steps.push("backupcode");
      if (body.step?.cred?.password) steps.push("password");
      if (body.step?.init2)
        return new Response(
          JSON.stringify({ sessionid: "s1", state: { choose: ["passwordbackupcode"] } }),
          { status: 200, headers: { "X-KANIDM-AUTH-SESSION-ID": "s1" } },
        );
      if (body.step?.begin === "passwordbackupcode")
        return new Response(
          JSON.stringify({ sessionid: "s2", state: { continue: ["backupcode", "password"] } }),
          { status: 200 },
        );
      if (body.step?.cred?.backupcode)
        return new Response(
          JSON.stringify({ sessionid: "s3", state: { continue: ["password"] } }),
          { status: 200 },
        );
      return new Response(JSON.stringify({ sessionid: "s4", state: { success: "bc-token" } }), {
        status: 200,
      });
    }) as typeof fetch;

    try {
      const token = await loginWithPasswordBackupCode("", "testuser", "testpass", "abc123");
      expect(token).toBe("bc-token");
      expect(steps).toEqual(["backupcode", "password"]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
