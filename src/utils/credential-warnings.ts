const warningCopy: Record<string, string> = {
  NoValidCredentials:
    "No current credential satisfies this account policy. Stage the required password and MFA changes before committing.",
  MfaRequired: "This account policy requires MFA before changes can be committed.",
  PasskeyRequired: "A passkey is required before changes can be committed.",
  AttestedPasskeyRequired: "An attested passkey is required before changes can be committed.",
  AttestedResidentKeyRequired:
    "An attested resident key is required before changes can be committed.",
  WebauthnAttestationUnsatisfiable:
    "The current WebAuthn attestation cannot satisfy this account policy.",
  WebauthnUserVerificationRequired:
    "This account policy requires WebAuthn user verification before committing.",
  Unsatisfiable:
    "The current token cannot satisfy this account policy. An administrator may need to adjust policy or issue a different reset.",
};

export function credentialWarningMessage(code: string) {
  return warningCopy[code] ?? "Kanidm returned a credential policy warning.";
}

export function warningsRequirePasskey(warnings: string[]) {
  return warnings.some(
    (warning) =>
      warning === "PasskeyRequired" ||
      warning === "AttestedPasskeyRequired" ||
      warning === "AttestedResidentKeyRequired" ||
      warning === "WebauthnAttestationUnsatisfiable" ||
      warning === "WebauthnUserVerificationRequired",
  );
}

export function warningsRequireTotp(warnings: string[]) {
  return warnings.some((warning) => warning === "MfaRequired" || warning === "NoValidCredentials");
}
