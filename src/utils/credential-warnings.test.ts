import { describe, expect, it } from "vite-plus/test";
import {
  credentialWarningMessage,
  warningsRequirePasskey,
  warningsRequireTotp,
} from "./credential-warnings";

describe("credentialWarningMessage", () => {
  it("explains NoValidCredentials while preserving the raw warning separately", () => {
    expect(credentialWarningMessage("NoValidCredentials")).toContain(
      "No current credential satisfies this account policy",
    );
  });

  it("classifies warnings that should expand required sections", () => {
    expect(warningsRequireTotp(["NoValidCredentials"])).toBe(true);
    expect(warningsRequireTotp(["MfaRequired"])).toBe(true);
    expect(warningsRequirePasskey(["PasskeyRequired"])).toBe(true);
    expect(warningsRequirePasskey(["WebauthnUserVerificationRequired"])).toBe(true);
  });
});
