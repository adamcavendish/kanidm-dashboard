import type {
  Application,
  ApplicationClaimMap,
  ApplicationClaimMapJoin,
  ApplicationPatch,
  ConsoleState,
  CredentialUpdateStatus,
  Group,
  NewApplicationInput,
  NewGroupInput,
  NewPersonInput,
  NewServiceAccountInput,
  PasskeyCredential,
  PasskeyRegistration,
  Person,
  PersonCertificate,
  ServiceAccount,
  ServiceAccountPatch,
  TotpRegistration,
  UserAuthTokenStatus,
} from "./domain";
import { initialState } from "./seed";
import type { AuthResponse, AuthMechanism } from "./kanidm-auth";

export type { AuthIssueSession, AuthMechanism, AuthResponse, AuthStepResult } from "./kanidm-auth";

export type AuthAllowed =
  | "anonymous"
  | "backupcode"
  | "password"
  | "totp"
  | { securitykey: unknown }
  | { passkey: unknown };

export interface KanidmEntry {
  attrs?: Record<string, string[]>;
  class?: string[];
  displayname?: string[];
  name?: string[];
  spn?: string[];
  uuid?: string[];
}

export const domainImageUrl = "/ui/images/domain";

export interface KanidmAppLink {
  Oauth2?: {
    name: string;
    display_name: string;
    redirect_url: string;
    has_image: boolean;
  };
}

export interface KanidmCredentialUpdateIntent {
  token: string;
  expiry_time: string;
}

export interface KanidmCredentialUpdateSession {
  token: string;
}

export type KanidmCredentialUpdateExchangeResponse = [
  KanidmCredentialUpdateSession,
  KanidmCredentialUpdateStatus,
];

export interface KanidmCredentialUpdateStatus {
  spn: string;
  displayname: string;
  mfaregstate?: unknown;
  can_commit: boolean;
  warnings: string[];
  primary?: Record<string, unknown> | null;
  primary_state: string;
  passkeys: unknown[];
  passkeys_state: string;
  attested_passkeys: unknown[];
  attested_passkeys_state: string;
  unixcred?: Record<string, unknown> | null;
  unixcred_state: string;
  sshkeys: Record<string, unknown>;
  sshkeys_state: string;
}

export interface KanidmUserAuthTokenStatus {
  account_id?: string;
  uuid?: string;
  session_id?: string;
  issued_at?: string;
  purpose?: string;
  expiry?: string;
  state?: "neverexpires" | "revoked" | { expiresat: string };
}

export function mapPersonCertificates(entry: KanidmEntry | null): PersonCertificate[] {
  return values(entry ?? {}, "certificate").map((certificate, index) => ({
    id: `cert-${index + 1}`,
    label: `Certificate ${index + 1}`,
    pem: certificate,
  }));
}

export function personCreateEntry(input: NewPersonInput): KanidmEntry {
  return {
    attrs: compactAttrs({
      name: [input.username.trim()],
      displayname: [input.displayName.trim()],
      mail: [input.email.trim()],
    }),
  };
}

export function groupCreateEntry(input: NewGroupInput): KanidmEntry {
  return {
    attrs: compactAttrs({
      name: [input.name.trim()],
    }),
  };
}

export function serviceAccountCreateEntry(input: NewServiceAccountInput): KanidmEntry {
  return {
    attrs: compactAttrs({
      name: [input.name.trim()],
      displayname: [input.displayName.trim()],
      description: [input.description.trim()],
      entry_managed_by: [input.managedBy.trim()],
    }),
  };
}

export function oauth2CreateEntry(input: NewApplicationInput): KanidmEntry {
  return {
    attrs: compactAttrs({
      name: [input.name.trim()],
      displayname: [input.displayName.trim()],
      oauth2_rs_origin: input.redirectUris.map((value) => value.trim()),
      oauth2_rs_origin_landing: [input.landingUrl.trim()],
    }),
  };
}

export function serviceAccountPatchEntry(patch: ServiceAccountPatch): KanidmEntry {
  return {
    attrs: compactAttrs({
      displayname: patch.displayName !== undefined ? [patch.displayName.trim()] : undefined,
      description: patch.description !== undefined ? [patch.description.trim()] : undefined,
      entry_managed_by: patch.managedBy !== undefined ? [patch.managedBy.trim()] : undefined,
    }),
  };
}

export function oauth2ScopeMaps(input: NewApplicationInput) {
  const scopedGroups = input.scopeMaps?.length
    ? input.scopeMaps
    : input.allowedGroups.map((groupId) => ({ groupId, scopes: input.scopes }));

  return scopedGroups
    .filter((scopeMap) => input.allowedGroups.includes(scopeMap.groupId))
    .map((scopeMap) => ({
      groupId: scopeMap.groupId.trim(),
      scopes: unique(scopeMap.scopes.map((scope) => scope.trim()).filter(Boolean)),
    }))
    .filter((scopeMap) => scopeMap.groupId && scopeMap.scopes.length > 0);
}

export function oauth2PatchEntry(patch: ApplicationPatch): KanidmEntry {
  return {
    attrs: compactAttrs({
      displayname: patch.displayName !== undefined ? [patch.displayName.trim()] : undefined,
      oauth2_rs_origin_landing:
        patch.landingUrl !== undefined ? [patch.landingUrl.trim()] : undefined,
      oauth2_rs_origin: patch.redirectUris?.map((v) => v.trim()),
    }),
  };
}

function compactAttrs(attrs: Record<string, string[] | undefined>) {
  return Object.fromEntries(
    Object.entries(attrs)
      .map(([key, values]) => [key, (values ?? []).filter(Boolean)] as const)
      .filter(([, values]) => values.length > 0),
  );
}

export function assertAllowedCredential(
  state: AuthResponse["state"],
  credential: "password" | "totp" | "backupcode",
) {
  if (!("continue" in state)) return;
  const allowed = state.continue;
  if (!allowed.some((item) => item === credential)) {
    throw new Error(`${credentialLabel(credential)} was not offered by Kanidm.`);
  }
}

export function passkeyAuthChallengeFromState(state: AuthResponse["state"]) {
  if (!("continue" in state)) {
    throw new Error("Kanidm did not return a passkey challenge.");
  }
  const allowed = state.continue.find(
    (item): item is { passkey: unknown } => isObject(item) && "passkey" in item,
  );
  if (!allowed) {
    throw new Error("Kanidm did not offer a passkey challenge.");
  }
  return allowed.passkey;
}

export function securityKeyAuthChallengeFromState(state: AuthResponse["state"]) {
  if (!("continue" in state)) {
    throw new Error("Kanidm did not return a security-key challenge.");
  }
  const allowed = state.continue.find(
    (item): item is { securitykey: unknown } => isObject(item) && "securitykey" in item,
  );
  if (!allowed) {
    throw new Error("Kanidm did not offer a security-key challenge.");
  }
  return allowed.securitykey;
}

export function authMechanismLabel(mechanism: AuthMechanism) {
  if (mechanism === "passwordmfa") return "Password and TOTP";
  if (mechanism === "passwordbackupcode") return "Password and backup code";
  if (mechanism === "passwordsecuritykey") return "Password and security key";
  if (mechanism === "passkey") return "Passkey";
  return "Password";
}

export function credentialLabel(credential: "password" | "totp" | "backupcode") {
  if (credential === "totp") return "TOTP";
  if (credential === "backupcode") return "Backup code";
  return "Password";
}

export function mapKanidmState(
  self: KanidmEntry,
  people: KanidmEntry[],
  groups: KanidmEntry[],
  apps: KanidmEntry[],
  options: {
    serviceAccounts?: KanidmEntry[];
    appLinks?: KanidmAppLink[];
    domainDisplayName?: string;
    domainHasImage?: boolean;
    canManageNativeDomainBranding?: boolean;
  } = {},
): ConsoleState {
  const serviceAccountEntries = options.serviceAccounts ?? [];
  const mappedGroups = mapGroups(groups, [self, ...people, ...serviceAccountEntries], apps);
  const mappedPeople = people.map((entry) => mapPerson(entry, mappedGroups, groups));
  const selfPerson = mapPerson(self, mappedGroups, groups);
  const selfPersonIndex = mappedPeople.findIndex((person) => samePerson(person, selfPerson));
  const allPeople =
    selfPersonIndex >= 0
      ? mappedPeople.map((person, index) =>
          index === selfPersonIndex ? mergeCurrentPerson(person, selfPerson) : person,
        )
      : [selfPerson, ...mappedPeople];
  const currentUserName = attr(self, "name") || attr(self, "spn") || allPeople[0]?.username;
  const currentUser = allPeople.find(
    (person) => person.username === currentUserName || person.email === currentUserName,
  );
  const adminGroup = mappedGroups.find((group) => group.name === "idm_admins");
  const currentUserGroupIds = currentUser
    ? resolveMappedGroupClosure(currentUser.groups, mappedGroups)
    : [];
  const isCurrentUserAdmin =
    currentUser?.username === "admin" ||
    Boolean(adminGroup && currentUserGroupIds.includes(adminGroup.id));
  const role = currentUser && isCurrentUserAdmin ? "admin" : "user";
  const mappedApps = mergeAppLinks(
    apps.map((entry) => mapApplication(entry, mappedGroups)),
    options.appLinks ?? [],
    currentUser,
  );

  return {
    ...initialState,
    branding: {
      ...initialState.branding,
      companyName: options.domainDisplayName || initialState.branding.companyName,
      logoUrl: options.domainHasImage ? domainImageUrl : initialState.branding.logoUrl,
      canManageNativeDomainBranding: Boolean(options.canManageNativeDomainBranding),
    },
    role,
    currentUserId: currentUser?.id ?? allPeople[0]?.id ?? initialState.currentUserId,
    people: allPeople.length ? allPeople : initialState.people,
    serviceAccounts: serviceAccountEntries.map((entry) =>
      mapServiceAccount(entry, mappedGroups, groups),
    ),
    groups: mappedGroups.length ? mappedGroups : initialState.groups,
    apps: mappedApps,
  };
}

function mapPerson(entry: KanidmEntry, groups: Group[], groupEntries: KanidmEntry[]): Person {
  const username = attr(entry, "name") || attr(entry, "spn") || stableId("person", entry);
  const memberOf = membershipRefs(entry);
  const personRefs = entryRefs(entry, username);
  const gidNumber = parseOptionalNumber(attr(entry, "gidnumber"));
  const shell = attr(entry, "loginshell") || attr(entry, "shell");
  const unixCredentialSet = gidNumber !== null || shell.length > 0;
  const groupIds = groups
    .filter((group, index) => isMemberOfGroup(memberOf, personRefs, groupEntries[index], group))
    .map((group) => group.id);

  return {
    id: attr(entry, "uuid") || `u-${username}`,
    username,
    displayName: attr(entry, "displayname") || username,
    legalName: attr(entry, "legalname") || attr(entry, "displayname") || username,
    email: attr(entry, "mail") || `${username}@example.invalid`,
    status: personStatus(entry),
    validFrom: attr(entry, "accountvalidfrom") || undefined,
    expireAt: attr(entry, "accountexpire") || undefined,
    softLockExpire: attr(entry, "accountsoftlockexpire") || undefined,
    groups: groupIds,
    credential: {
      password: "healthy",
      passkeys: values(entry, "passkeys").length + values(entry, "attestedpasskeys").length,
      totp: values(entry, "totpimport").length > 0,
      backupCodes: 0,
      unixCredential: unixCredentialSet,
      sshKeys: values(entry, "sshpublickey").length + values(entry, "ldapsshpublickey").length,
      radiusPassword: values(entry, "radiussecret").length > 0,
    },
    unix: {
      gidNumber,
      shell,
      credentialSet: unixCredentialSet,
    },
    lastAuth: attr(entry, "last_auth") || "Unknown",
  };
}

function mapServiceAccount(
  entry: KanidmEntry,
  groups: Group[],
  groupEntries: KanidmEntry[],
): ServiceAccount {
  const name = attr(entry, "name") || attr(entry, "spn") || stableId("svc", entry);
  const memberOf = membershipRefs(entry);
  const serviceAccountRefs = entryRefs(entry, name);
  const gidNumber = parseOptionalNumber(attr(entry, "gidnumber"));
  const shell = attr(entry, "loginshell") || attr(entry, "shell");
  const unixCredentialSet = gidNumber !== null || shell.length > 0;
  const groupIds = groups
    .filter((group, index) =>
      isMemberOfGroup(memberOf, serviceAccountRefs, groupEntries[index], group),
    )
    .map((group) => group.id);
  const sshKeyCount =
    values(entry, "ssh_publickey").length +
    values(entry, "sshpublickey").length +
    values(entry, "ldapsshpublickey").length;
  const hasPassword =
    values(entry, "primarycredential").length > 0 ||
    values(entry, "credential").length > 0 ||
    values(entry, "userpassword").length > 0;
  const managedByRef = attr(entry, "entry_managed_by");
  const managedBy =
    groups.find((group) => groupMatchesRef(group, managedByRef))?.id ?? managedByRef;

  return {
    id: attr(entry, "uuid") || `svc-${name}`,
    name,
    displayName: attr(entry, "displayname") || name,
    description: attr(entry, "description") || "Kanidm service account",
    managedBy,
    groups: groupIds,
    credential: {
      password: hasPassword ? "present" : "unknown",
      apiTokens: values(entry, "api_token_session").length,
      sshKeys: sshKeyCount,
      unixCredential: unixCredentialSet,
    },
    unix: {
      gidNumber,
      shell,
      credentialSet: unixCredentialSet,
    },
    status: groupIds.length || sshKeyCount > 0 || unixCredentialSet ? "ready" : "attention",
  };
}

function personStatus(entry: KanidmEntry): Person["status"] {
  if (values(entry, "nsaccountlock").some((value) => value === "true" || value === "1")) {
    return "locked";
  }
  if (values(entry, "accountexpire").length || values(entry, "accountsoftlockexpire").length) {
    return "expiring";
  }
  return "active";
}

function mergeCurrentPerson(person: Person, selfPerson: Person): Person {
  return {
    ...person,
    username: selfPerson.username || person.username,
    displayName: selfPerson.displayName || person.displayName,
    legalName: selfPerson.legalName || person.legalName,
    email: selfPerson.email || person.email,
    groups: unique([...person.groups, ...selfPerson.groups]),
    lastAuth: selfPerson.lastAuth === "Unknown" ? person.lastAuth : selfPerson.lastAuth,
  };
}

function parseOptionalNumber(value: string) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function mapCredentialUpdateStatus(
  sessionToken: string,
  response: KanidmCredentialUpdateStatus,
): CredentialUpdateStatus {
  const totpIssue = totpIssueFromMfaRegistration(response.mfaregstate);
  const passkeys = passkeyDetails(response.passkeys);
  const attestedPasskeys = passkeyDetails(response.attested_passkeys);
  return {
    sessionToken,
    spn: response.spn,
    displayName: response.displayname,
    canCommit: response.can_commit,
    warnings: response.warnings,
    primaryState: response.primary_state,
    passkeysState: response.passkeys_state,
    attestedPasskeysState: response.attested_passkeys_state,
    unixCredentialState: response.unixcred_state,
    sshKeysState: response.sshkeys_state,
    passkeyCount: passkeys.length,
    attestedPasskeyCount: attestedPasskeys.length,
    passkeys,
    attestedPasskeys,
    sshKeyCount: Object.keys(response.sshkeys).length,
    sshKeyLabels: Object.keys(response.sshkeys),
    hasPrimaryCredential: response.primary !== null && response.primary !== undefined,
    hasUnixCredential: response.unixcred !== null && response.unixcred !== undefined,
    totpLabels: totpLabelsFromPrimaryCredential(response.primary),
    pendingTotp: pendingTotpFromMfaRegistration(response.mfaregstate),
    pendingPasskey: pendingPasskeyFromMfaRegistration(response.mfaregstate),
    totpIssue: totpIssue.issue,
    totpIssueLabel: totpIssue.label,
    pendingBackupCodes: backupCodesFromMfaRegistration(response.mfaregstate),
  };
}

function pendingPasskeyFromMfaRegistration(value: unknown): PasskeyRegistration | null {
  if (isObject(value) && "Passkey" in value && isObject(value.Passkey)) {
    return { kind: "passkey", challenge: value.Passkey };
  }
  if (isObject(value) && "AttestedPasskey" in value && isObject(value.AttestedPasskey)) {
    return { kind: "attested-passkey", challenge: value.AttestedPasskey };
  }
  return null;
}

function passkeyDetails(value: unknown[]): PasskeyCredential[] {
  return value
    .map((item, index) => {
      if (!isObject(item)) return null;
      const uuid = stringProp(item, "uuid");
      const tag = stringProp(item, "tag") || `Passkey ${index + 1}`;
      return uuid ? { uuid, tag } : null;
    })
    .filter((item): item is PasskeyCredential => item !== null);
}

function pendingTotpFromMfaRegistration(value: unknown): TotpRegistration | null {
  if (!isObject(value) || !("TotpCheck" in value) || !isObject(value.TotpCheck)) return null;

  const secret = value.TotpCheck;
  const accountName = stringProp(secret, "accountname");
  const issuer = stringProp(secret, "issuer");
  const algorithm = stringProp(secret, "algo").toUpperCase() || "SHA256";
  const step = numberProp(secret, "step") ?? 30;
  const digits = numberProp(secret, "digits") ?? 6;
  const secretValue = secretValueFromTotpSecret(secret.secret);
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}`;
  const query = new URLSearchParams({
    secret: secretValue,
    issuer,
    algorithm,
    digits: String(digits),
    period: String(step),
  });

  return {
    accountName,
    issuer,
    secret: secretValue,
    algorithm,
    step,
    digits,
    uri: `otpauth://totp/${label}?${query.toString()}`,
  };
}

function totpIssueFromMfaRegistration(value: unknown): {
  issue: CredentialUpdateStatus["totpIssue"];
  label: string;
} {
  if (value === "TotpTryAgain") return { issue: "try-again", label: "" };
  if (value === "TotpInvalidSha1") return { issue: "invalid-sha1", label: "" };
  if (isObject(value) && "TotpNameTryAgain" in value) {
    return {
      issue: "name-taken",
      label: typeof value.TotpNameTryAgain === "string" ? value.TotpNameTryAgain : "",
    };
  }
  return { issue: null, label: "" };
}

function backupCodesFromMfaRegistration(value: unknown): string[] {
  if (
    value &&
    typeof value === "object" &&
    "BackupCodes" in value &&
    Array.isArray(value.BackupCodes)
  ) {
    return value.BackupCodes.filter((code): code is string => typeof code === "string");
  }
  return [];
}

function totpLabelsFromPrimaryCredential(primary: unknown): string[] {
  if (!isObject(primary) || !isObject(primary.type_) || !("PasswordMfa" in primary.type_)) {
    return [];
  }

  const detail = primary.type_.PasswordMfa;
  if (!Array.isArray(detail) || !Array.isArray(detail[0])) return [];
  return detail[0].filter((label): label is string => typeof label === "string");
}

function secretValueFromTotpSecret(value: unknown) {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return base32Encode(
    value.filter((item): item is number => Number.isInteger(item) && item >= 0 && item <= 255),
  );
}

function base32Encode(bytes: number[]) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 31];
  }

  return output;
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringProp(value: Record<string, unknown>, key: string) {
  return typeof value[key] === "string" ? value[key] : "";
}

function numberProp(value: Record<string, unknown>, key: string) {
  return typeof value[key] === "number" ? value[key] : null;
}

export function mapUserAuthTokenStatus(token: KanidmUserAuthTokenStatus): UserAuthTokenStatus {
  const state =
    token.state && typeof token.state === "object" && "expiresat" in token.state
      ? { expiresAt: token.state.expiresat }
      : (token.state ?? (token.expiry ? { expiresAt: token.expiry } : "neverexpires"));

  return {
    accountId: token.account_id ?? token.uuid ?? "",
    sessionId: token.session_id ?? "",
    issuedAt: token.issued_at ?? "",
    purpose: token.purpose ?? "unknown",
    state,
  };
}

function samePerson(left: Person, right: Person) {
  return left.id === right.id || left.username === right.username;
}

function mapGroups(
  groupEntries: KanidmEntry[],
  personEntries: KanidmEntry[],
  appEntries: KanidmEntry[],
) {
  const mapped = groupEntries.map(mapGroup);
  const normalized = mapped.map((group, index) => ({
    ...group,
    parentGroups: mapped
      .filter(
        (candidate, candidateIndex) =>
          candidateIndex !== index &&
          refsIntersect(
            values(groupEntries[index], "memberof"),
            entryRefs(groupEntries[candidateIndex], candidate.name, candidate.id),
          ),
      )
      .map((candidate) => candidate.id),
    managedBy:
      mapped.find(
        (candidate, candidateIndex) =>
          candidateIndex !== index &&
          refsIntersect(
            values(groupEntries[index], "entry_managed_by"),
            entryRefs(groupEntries[candidateIndex], candidate.name, candidate.id),
          ),
      )?.id ?? group.managedBy,
  }));
  const seen = new Set(normalized.flatMap((group) => [group.id, group.name, group.displayName]));

  for (const ref of implicitGroupRefs(personEntries, appEntries)) {
    const name = normalizeRef(ref);
    if (!name || seen.has(name)) continue;
    const group = syntheticGroup(name, personEntries);
    normalized.push(group);
    seen.add(group.id);
    seen.add(group.name);
    seen.add(group.displayName);
  }

  return normalized;
}

function implicitGroupRefs(personEntries: KanidmEntry[], appEntries: KanidmEntry[]) {
  return unique([
    ...personEntries.flatMap((entry) => [
      ...values(entry, "memberof"),
      ...values(entry, "directmemberof"),
    ]),
    ...appEntries.flatMap((entry) =>
      values(entry, "oauth2_rs_scope_map").map((value) => parseScopeMap(value).groupRef),
    ),
  ]);
}

function syntheticGroup(name: string, personEntries: KanidmEntry[]): Group {
  return {
    id: `g-${name}`,
    name,
    displayName: name,
    description: "Kanidm group",
    members: personEntries
      .filter((entry) => membershipRefs(entry).some((ref) => normalizeRef(ref) === name))
      .map((entry) => attr(entry, "spn") || attr(entry, "name"))
      .filter((value) => value.length > 0),
    parentGroups: [],
    managedBy: "",
  };
}

function mapGroup(entry: KanidmEntry): Group {
  const name = attr(entry, "name") || stableId("group", entry);
  return {
    id: attr(entry, "uuid") || `g-${name}`,
    name,
    displayName: attr(entry, "displayname") || name,
    description: attr(entry, "description") || "Kanidm group",
    members: values(entry, "member"),
    parentGroups: values(entry, "memberof"),
    managedBy: attr(entry, "entry_managed_by") || "",
  };
}

function mapApplication(entry: KanidmEntry, groups: Group[]): Application {
  const name = attr(entry, "name") || stableId("app", entry);
  const parsedScopeMaps = values(entry, "oauth2_rs_scope_map").map(parseScopeMap);
  const scopeMaps = parsedScopeMaps.map((scopeMap) => {
    const group = groups.find((candidate) => groupMatchesRef(candidate, scopeMap.groupRef));
    return {
      groupId: group?.id ?? scopeMap.groupRef,
      scopes: scopeMap.scopes.length ? scopeMap.scopes : ["openid", "profile"],
    };
  });
  const supplementalScopeMaps = values(entry, "oauth2_rs_sup_scope_map").map((value) => {
    const scopeMap = parseScopeMap(value);
    const group = groups.find((candidate) => groupMatchesRef(candidate, scopeMap.groupRef));
    return {
      groupId: group?.id ?? scopeMap.groupRef,
      scopes: scopeMap.scopes,
    };
  });
  const claimMaps = parseClaimMaps(values(entry, "oauth2_rs_claim_map"), groups);
  const allowedGroups = unique(scopeMaps.map((scopeMap) => scopeMap.groupId));
  const scopes = unique([
    ...scopeMaps.flatMap((scopeMap) => scopeMap.scopes),
    ...supplementalScopeMaps.flatMap((scopeMap) => scopeMap.scopes),
  ]);

  return {
    id: attr(entry, "uuid") || `app-${name}`,
    name,
    displayName: attr(entry, "displayname") || name,
    landingUrl: attr(entry, "oauth2_rs_origin_landing") || "#",
    imageUrl: values(entry, "image").length ? oauth2ImageUrl(name) : "",
    clientType: values(entry, "oauth2_rs_basic_secret").length ? "confidential" : "public",
    redirectUris: values(entry, "oauth2_rs_origin"),
    allowedGroups,
    scopes: scopes.length ? scopes : ["openid", "profile"],
    scopeMaps,
    supplementalScopeMaps,
    claimMaps,
    status: allowedGroups.length ? "ready" : "attention",
  };
}

function mergeAppLinks(
  apps: Application[],
  appLinks: KanidmAppLink[],
  currentUser: Person | undefined,
) {
  if (!appLinks.length) return apps;
  const byName = new Map(apps.map((app) => [app.name, app]));

  for (const link of appLinks) {
    const app = mapAppLink(link, currentUser);
    if (!app) continue;
    const existing = byName.get(app.name);
    byName.set(app.name, existing ? mergeAppLink(existing, app, currentUser) : app);
  }

  return [...byName.values()];
}

function mapAppLink(link: KanidmAppLink, currentUser: Person | undefined): Application | null {
  if (!link.Oauth2) return null;
  const name = link.Oauth2.name.trim();
  if (!name) return null;
  return {
    id: `app-${name}`,
    name,
    displayName: link.Oauth2.display_name || name,
    landingUrl: link.Oauth2.redirect_url,
    imageUrl: link.Oauth2.has_image ? oauth2ImageUrl(name) : "",
    clientType: "public",
    redirectUris: [link.Oauth2.redirect_url],
    allowedGroups: currentUser?.groups ?? [],
    scopes: ["openid", "profile"],
    scopeMaps: (currentUser?.groups ?? []).map((groupId) => ({
      groupId,
      scopes: ["openid", "profile"],
    })),
    status: "ready",
  };
}

function mergeAppLink(
  existing: Application,
  appLink: Application,
  currentUser: Person | undefined,
) {
  return {
    ...existing,
    displayName: appLink.displayName || existing.displayName,
    landingUrl: appLink.landingUrl || existing.landingUrl,
    imageUrl: appLink.imageUrl || existing.imageUrl,
    allowedGroups: existing.allowedGroups.length
      ? existing.allowedGroups
      : (currentUser?.groups ?? []),
    scopeMaps: existing.scopeMaps?.length ? existing.scopeMaps : appLink.scopeMaps,
    status: "ready" as const,
  };
}

export function oauth2ImageUrl(appName: string) {
  return `/ui/images/oauth2/${encodeURIComponent(appName)}`;
}

function attr(entry: KanidmEntry, key: string) {
  return values(entry, key)[0] ?? "";
}

function values(entry: KanidmEntry, key: string) {
  const attrs = entry.attrs ?? entry;
  const value = (attrs as Record<string, unknown>)[key];
  return Array.isArray(value) ? value.map(String) : [];
}

function membershipRefs(entry: KanidmEntry) {
  const direct = values(entry, "directmemberof");
  return direct.length ? direct : values(entry, "memberof");
}

function resolveMappedGroupClosure(groupIds: string[], groups: Group[]) {
  const seen = new Set<string>();
  const visit = (groupId: string) => {
    if (seen.has(groupId)) return;
    seen.add(groupId);
    groups.find((group) => group.id === groupId)?.parentGroups.forEach(visit);
  };
  groupIds.forEach(visit);
  return [...seen];
}

function isMemberOfGroup(
  memberOfRefs: string[],
  accountRefs: Set<string>,
  groupEntry: KanidmEntry | undefined,
  group: Group,
) {
  return (
    refsIntersect(memberOfRefs, entryRefs(groupEntry, group.name, group.id)) ||
    refsIntersect(values(groupEntry ?? {}, "member"), accountRefs)
  );
}

function refsIntersect(left: string[], right: Set<string>) {
  return left.some((value) => right.has(value) || right.has(value.split("@")[0] ?? value));
}

function parseScopeMap(value: string) {
  const [rawGroupRef = "", rawScopes = ""] = value.split(/:(.*)/s);
  return {
    groupRef: normalizeRef(rawGroupRef),
    scopes: unique(
      [...rawScopes.matchAll(/"([^"]+)"|([a-zA-Z0-9:_*./-]+)/g)]
        .map((match) => match[1] ?? match[2] ?? "")
        .filter((scope) => scope && scope !== "{" && scope !== "}"),
    ),
  };
}

function parseClaimMaps(values: string[], groups: Group[]): ApplicationClaimMap[] {
  const byClaim = new Map<string, ApplicationClaimMap>();
  for (const value of values) {
    const parsed = parseClaimMap(value);
    if (!parsed) continue;
    const group = groups.find((candidate) => groupMatchesRef(candidate, parsed.groupRef));
    const groupId = group?.id ?? parsed.groupRef;
    const existing = byClaim.get(parsed.claimName);
    if (existing) {
      existing.rules.push({ groupId, values: parsed.values });
      existing.join = parsed.join;
    } else {
      byClaim.set(parsed.claimName, {
        claimName: parsed.claimName,
        join: parsed.join,
        rules: [{ groupId, values: parsed.values }],
      });
    }
  }
  return [...byClaim.values()];
}

function parseClaimMap(value: string): {
  claimName: string;
  groupRef: string;
  join: ApplicationClaimMapJoin;
  values: string[];
} | null {
  const match = value.match(/^([^:]+):([^:]+):(;|,| ):"(.*)"$/s);
  if (!match) return null;
  const [, claimName = "", rawGroupRef = "", joinToken = ";", rawValues = ""] = match;
  return {
    claimName: claimName.trim(),
    groupRef: normalizeRef(rawGroupRef),
    join: joinToken === "," ? "csv" : joinToken === " " ? "ssv" : "array",
    values: rawValues
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  };
}

function groupMatchesRef(group: Group, ref: string) {
  const normalizedRef = normalizeRef(ref);
  return [group.id, group.name, group.displayName].some(
    (candidate) => candidate === ref || candidate === normalizedRef,
  );
}

function normalizeRef(ref: string) {
  return ref.trim().replace(/@[^:@\s]+$/, "");
}

function entryRefs(entry: KanidmEntry | undefined, ...fallbacks: string[]) {
  const refs = new Set<string>();
  for (const value of [
    ...fallbacks,
    ...values(entry ?? {}, "uuid"),
    ...values(entry ?? {}, "name"),
    ...values(entry ?? {}, "spn"),
  ]) {
    if (!value) continue;
    refs.add(value);
    refs.add(value.split("@")[0] ?? value);
  }
  return refs;
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function stableId(prefix: string, entry: KanidmEntry) {
  return `${prefix}-${JSON.stringify(entry)
    .slice(0, 24)
    .replace(/[^a-z0-9]+/gi, "-")}`;
}
