import { describe, expect, it } from "vite-plus/test";
import { latestSessionLabel } from "./format";

describe("latestSessionLabel", () => {
  it("uses the newest issued session even when it is revoked", () => {
    const label = latestSessionLabel([
      {
        accountId: "adam",
        sessionId: "older-active",
        issuedAt: "2026-06-15T10:00:00.000Z",
        purpose: "ui",
        state: "neverexpires",
      },
      {
        accountId: "adam",
        sessionId: "newer-revoked",
        issuedAt: "2026-06-16T10:00:00.000Z",
        purpose: "ui",
        state: "revoked",
      },
    ]);

    expect(label).not.toBe("No sessions");
    expect(label).toContain("2026");
  });
});
