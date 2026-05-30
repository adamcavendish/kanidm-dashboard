import type { PasskeyLoginChallenge } from "./domain";
import { kanidmHttpError } from "./kanidm-error";
import {
  authMechanismLabel,
  assertAllowedCredential,
  passkeyAuthChallengeFromState,
  securityKeyAuthChallengeFromState,
} from "./kanidm-mappers";
export type AuthIssueSession = "token" | "cookie";
export type AuthMechanism =
  | "anonymous"
  | "password"
  | "passwordbackupcode"
  | "passwordmfa"
  | "passwordsecuritykey"
  | "passkey"
  | "oauth2trust";

export interface AuthResponse {
  sessionid: string;
  state:
    | { choose: AuthMechanism[] }
    | { continue: unknown[] }
    | { success: string }
    | { denied: string };
}

export interface AuthStepResult {
  response: AuthResponse;
  authSessionId?: string;
}

async function authStep(
  basePath: string,
  body: unknown,
  authSessionId?: string,
): Promise<AuthStepResult> {
  const response = await fetch(`${basePath}/v1/auth`, {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(authSessionId ? { "X-KANIDM-AUTH-SESSION-ID": authSessionId } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw await kanidmHttpError("/v1/auth", response);
  return {
    response: (await response.json()) as AuthResponse,
    authSessionId: response.headers.get("X-KANIDM-AUTH-SESSION-ID") ?? undefined,
  };
}

export async function startPasswordAuth(
  basePath: string,
  username: string,
  issue: AuthIssueSession,
  privileged = false,
) {
  return authStep(basePath, { step: { init2: { username, issue, privileged } } });
}

async function beginAuth(basePath: string, mechanism: AuthMechanism, authSessionId: string) {
  return authStep(basePath, { step: { begin: mechanism } }, authSessionId);
}

async function submitPassword(basePath: string, password: string, authSessionId: string) {
  return authStep(basePath, { step: { cred: { password } } }, authSessionId);
}

async function submitTotp(basePath: string, code: number, authSessionId: string) {
  return authStep(basePath, { step: { cred: { totp: code } } }, authSessionId);
}

async function submitBackupCode(basePath: string, backupCode: string, authSessionId: string) {
  return authStep(basePath, { step: { cred: { backupcode: backupCode.trim() } } }, authSessionId);
}

async function loginWithMechanism(
  basePath: string,
  username: string,
  mechanism: AuthMechanism,
  privileged: boolean,
  credentials: Array<{ kind: "password" | "totp" | "backupcode"; value: string | number }>,
): Promise<string> {
  const init = await startPasswordAuth(basePath, username, "token", privileged);
  if (!("choose" in init.response.state) || !init.response.state.choose.includes(mechanism)) {
    throw new Error(`${authMechanismLabel(mechanism)} authentication is not available.`);
  }
  if (!init.authSessionId) throw new Error("Kanidm did not return an auth-session header.");
  let step = await beginAuth(basePath, mechanism, init.authSessionId);
  let sid = step.authSessionId ?? init.authSessionId;
  for (const cred of credentials) {
    assertAllowedCredential(step.response.state, cred.kind);
    step =
      cred.kind === "password"
        ? await submitPassword(basePath, cred.value as string, sid)
        : cred.kind === "totp"
          ? await submitTotp(basePath, cred.value as number, sid)
          : await submitBackupCode(basePath, cred.value as string, sid);
    sid = step.authSessionId ?? sid;
    if ("denied" in step.response.state) throw new Error(step.response.state.denied);
  }
  if (!("success" in step.response.state))
    throw new Error("Kanidm authentication did not issue a bearer token.");
  return step.response.state.success;
}

export async function loginWithPassword(
  basePath: string,
  username: string,
  password: string,
  privileged = false,
) {
  return loginWithMechanism(basePath, username, "password", privileged, [
    { kind: "password", value: password },
  ]);
}

export async function loginWithPasswordTotp(
  basePath: string,
  username: string,
  password: string,
  totpCode: number,
  privileged = false,
) {
  return loginWithMechanism(basePath, username, "passwordmfa", privileged, [
    { kind: "totp", value: totpCode },
    { kind: "password", value: password },
  ]);
}

export async function loginWithPasswordBackupCode(
  basePath: string,
  username: string,
  password: string,
  backupCode: string,
  privileged = false,
) {
  return loginWithMechanism(basePath, username, "passwordbackupcode", privileged, [
    { kind: "backupcode", value: backupCode },
    { kind: "password", value: password },
  ]);
}

export async function startPasskeyLogin(
  basePath: string,
  username: string,
  privileged = false,
): Promise<PasskeyLoginChallenge> {
  const u = username.trim();
  const init = await startPasswordAuth(basePath, u, "token", privileged);
  if (!("choose" in init.response.state) || !init.response.state.choose.includes("passkey"))
    throw new Error("Passkey auth not available.");
  if (!init.authSessionId) throw new Error("Kanidm did not return an auth-session header.");
  const step = await beginAuth(basePath, "passkey", init.authSessionId);
  return {
    authSessionId: step.authSessionId ?? init.authSessionId,
    kind: "passkey",
    challenge: passkeyAuthChallengeFromState(step.response.state),
    username: u,
    privileged,
  };
}

export async function finishPasskeyLogin(
  basePath: string,
  challenge: PasskeyLoginChallenge,
  assertion: unknown,
): Promise<string> {
  const step = await authStep(
    basePath,
    { step: { cred: { passkey: assertion } } },
    challenge.authSessionId,
  );
  if ("denied" in step.response.state) throw new Error(step.response.state.denied);
  if (!("success" in step.response.state))
    throw new Error("Kanidm passkey auth did not issue a bearer token.");
  return step.response.state.success;
}

export async function startSecurityKeyLogin(
  basePath: string,
  username: string,
  privileged = false,
): Promise<PasskeyLoginChallenge> {
  const u = username.trim();
  const init = await startPasswordAuth(basePath, u, "token", privileged);
  if (
    !("choose" in init.response.state) ||
    !init.response.state.choose.includes("passwordsecuritykey")
  )
    throw new Error("Security-key auth not available.");
  if (!init.authSessionId) throw new Error("Kanidm did not return an auth-session header.");
  const step = await beginAuth(basePath, "passwordsecuritykey", init.authSessionId);
  return {
    authSessionId: step.authSessionId ?? init.authSessionId,
    kind: "security-key",
    challenge: securityKeyAuthChallengeFromState(step.response.state),
    username: u,
    privileged,
  };
}

export async function finishSecurityKeyLogin(
  basePath: string,
  challenge: PasskeyLoginChallenge,
  assertion: unknown,
  password: string,
): Promise<string> {
  let step = await authStep(
    basePath,
    { step: { cred: { securitykey: assertion } } },
    challenge.authSessionId,
  );
  let sid = step.authSessionId ?? challenge.authSessionId;
  if ("denied" in step.response.state) throw new Error(step.response.state.denied);
  assertAllowedCredential(step.response.state, "password");
  step = await submitPassword(basePath, password, sid);
  sid = step.authSessionId ?? sid;
  if ("denied" in step.response.state) throw new Error(step.response.state.denied);
  if (!("success" in step.response.state))
    throw new Error("Kanidm security-key auth did not issue a bearer token.");
  return step.response.state.success;
}
