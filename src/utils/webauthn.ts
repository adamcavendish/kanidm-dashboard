import type { CredentialUpdateStatus } from "../domain";

export function passkeyRegistrationHint(registration: CredentialUpdateStatus["pendingPasskey"]) {
  if (!registration) {
    return "Start passkey setup to ask Kanidm for a browser registration challenge. Commit only after the registered key is staged.";
  }
  if (registration.kind === "attested-passkey") {
    return "Attested passkey setup is pending. Use a compatible hardware authenticator to complete browser registration.";
  }
  return "Passkey setup is pending. Complete the browser WebAuthn ceremony to stage the new passkey.";
}

export function mockPasskeyRegistration() {
  return {
    id: "mock-passkey-credential",
    rawId: "bW9jay1wYXNza2V5LWNyZWRlbnRpYWw",
    response: {
      attestationObject: "bW9jay1hdHRlc3RhdGlvbg",
      clientDataJSON: "bW9jay1jbGllbnQtZGF0YQ",
    },
    type: "public-key",
    extensions: {},
  };
}

export function mockPasskeyAssertion() {
  return {
    id: "mock-passkey-login",
    rawId: "bW9jay1wYXNza2V5LWxvZ2lu",
    type: "public-key",
    response: {
      authenticatorData: "bW9jay1hdXRoLWRhdGE",
      clientDataJSON: "bW9jay1jbGllbnQtZGF0YQ",
      signature: "bW9jay1zaWduYXR1cmU",
      userHandle: "bW9jay11c2Vy",
    },
  };
}

export async function createPasskeyRegistration(challenge: unknown) {
  if (!browserSupportsPasskeys()) {
    throw new Error("This browser does not support passkey registration.");
  }

  const publicKey = publicKeyCreationOptionsFromChallenge(challenge);
  const credential = await navigator.credentials.create({ publicKey });
  if (!credential || !(credential instanceof PublicKeyCredential)) {
    throw new Error("Passkey registration was cancelled or returned an unsupported credential.");
  }

  const response = credential.response as AuthenticatorAttestationResponse;
  if (!("attestationObject" in response)) {
    throw new Error("Passkey registration did not return attestation data.");
  }

  return {
    id: credential.id,
    rawId: arrayBufferToBase64Url(credential.rawId),
    response: {
      attestationObject: arrayBufferToBase64Url(response.attestationObject),
      clientDataJSON: arrayBufferToBase64Url(response.clientDataJSON),
    },
    type: credential.type,
    extensions: credential.getClientExtensionResults(),
  };
}

export async function createPasskeyAssertion(challenge: unknown) {
  if (!browserSupportsPasskeys()) {
    throw new Error("This browser does not support passkey authentication.");
  }

  const publicKey = publicKeyRequestOptionsFromChallenge(challenge);
  const credential = await navigator.credentials.get({ publicKey });
  if (!credential || !(credential instanceof PublicKeyCredential)) {
    throw new Error("Passkey authentication was cancelled or returned an unsupported credential.");
  }

  const response = credential.response as AuthenticatorAssertionResponse;
  if (!("authenticatorData" in response)) {
    throw new Error("Passkey authentication did not return assertion data.");
  }

  return {
    id: credential.id,
    rawId: arrayBufferToBase64Url(credential.rawId),
    type: credential.type,
    response: {
      authenticatorData: arrayBufferToBase64Url(response.authenticatorData),
      clientDataJSON: arrayBufferToBase64Url(response.clientDataJSON),
      signature: arrayBufferToBase64Url(response.signature),
      userHandle: response.userHandle ? arrayBufferToBase64Url(response.userHandle) : null,
    },
  };
}

function browserSupportsPasskeys() {
  return (
    typeof navigator !== "undefined" &&
    typeof PublicKeyCredential !== "undefined" &&
    Boolean(navigator.credentials)
  );
}

function publicKeyCreationOptionsFromChallenge(
  challenge: unknown,
): PublicKeyCredentialCreationOptions {
  if (!isRecord(challenge) || !isRecord(challenge.publicKey)) {
    throw new Error("Kanidm passkey challenge is missing publicKey options.");
  }

  const publicKey = { ...challenge.publicKey } as Record<string, unknown>;
  if (typeof publicKey.challenge !== "string") {
    throw new Error("Kanidm passkey challenge is missing a string challenge.");
  }
  publicKey.challenge = base64UrlToUint8Array(publicKey.challenge as string);

  if (!isRecord(publicKey.user) || typeof publicKey.user.id !== "string") {
    throw new Error("Kanidm passkey challenge is missing a string user id.");
  }
  publicKey.user = {
    ...(publicKey.user as Record<string, unknown>),
    id: base64UrlToUint8Array((publicKey.user as Record<string, string>).id),
  };

  if (Array.isArray(publicKey.excludeCredentials)) {
    publicKey.excludeCredentials = (
      publicKey.excludeCredentials as Array<Record<string, unknown>>
    ).map((credential) => {
      if (!isRecord(credential) || typeof credential.id !== "string") return credential;
      return {
        ...credential,
        id: base64UrlToUint8Array(credential.id),
      };
    });
  }

  return publicKey as unknown as PublicKeyCredentialCreationOptions;
}

function publicKeyRequestOptionsFromChallenge(
  challenge: unknown,
): PublicKeyCredentialRequestOptions {
  if (!isRecord(challenge) || !isRecord(challenge.publicKey)) {
    throw new Error("Kanidm passkey challenge is missing publicKey options.");
  }

  const publicKey = { ...challenge.publicKey } as Record<string, unknown>;
  if (typeof publicKey.challenge !== "string") {
    throw new Error("Kanidm passkey challenge is missing a string challenge.");
  }
  publicKey.challenge = base64UrlToUint8Array(publicKey.challenge as string);

  if (Array.isArray(publicKey.allowCredentials)) {
    publicKey.allowCredentials = (publicKey.allowCredentials as Array<Record<string, unknown>>).map(
      (credential) => {
        if (!isRecord(credential) || typeof credential.id !== "string") return credential;
        return {
          ...credential,
          id: base64UrlToUint8Array(credential.id),
        };
      },
    );
  }

  return publicKey as unknown as PublicKeyCredentialRequestOptions;
}

function base64UrlToUint8Array(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = 4 - (base64.length % 4);
  const padded = padding < 4 ? base64 + "=".repeat(padding) : base64;
  const bytes = atob(padded)
    .split("")
    .map((char) => char.charCodeAt(0));
  return new Uint8Array(bytes);
}

function arrayBufferToBase64Url(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const binary = bytes.reduce((accumulator, byte) => accumulator + String.fromCharCode(byte), "");
  const base64 = btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
