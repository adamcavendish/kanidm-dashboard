export type Role = "user" | "admin";

export type ThemeMode = "dark" | "light" | "system";

export type ThemePreset = "orb" | "copper" | "forest" | "mono" | "custom";

export type LogoTreatment = "mark" | "wordmark" | "both";

export type SurfaceIntensity = "flat" | "frosted" | "glass";

export type StatusPalette = "kanidm" | "classic" | "high-contrast";

export type UserStatus = "active" | "locked" | "expiring" | "recovery";

export type ClientType = "confidential" | "public";

export interface ThemeSettings {
  mode: ThemeMode;
  preset: ThemePreset;
  accentColor: string;
  successColor: string;
  warningColor: string;
  dangerColor: string;
  surfaceIntensity: SurfaceIntensity;
  statusPalette: StatusPalette;
  logoTreatment: LogoTreatment;
}

export interface BrandingSettings {
  companyName: string;
  logoUrl: string;
  loginMessage: string;
  poweredBy: boolean;
  canManageNativeDomainBranding: boolean;
  theme: ThemeSettings;
}

export interface CredentialState {
  password: "healthy" | "needs-update" | "missing";
  passkeys: number;
  totp: boolean;
  backupCodes: number;
  unixCredential: boolean;
  sshKeys: number;
  radiusPassword: boolean;
}

export interface UnixAccountSettings {
  gidNumber: number | null;
  shell: string;
  credentialSet: boolean;
}

export type ServiceAccountStatus = "ready" | "attention";

export type ServiceAccountCredentialState = "unknown" | "present" | "missing";

export interface ServiceAccountCredentialSummary {
  password: ServiceAccountCredentialState;
  apiTokens: number;
  sshKeys: number;
  unixCredential: boolean;
}

export interface ServiceAccount {
  id: string;
  name: string;
  displayName: string;
  description: string;
  managedBy: string;
  groups: string[];
  credential: ServiceAccountCredentialSummary;
  unix: UnixAccountSettings;
  status: ServiceAccountStatus;
}

export type ServiceAccountApiTokenPurpose = "readonly" | "readwrite" | "synchronise" | "unknown";

export interface ServiceAccountApiToken {
  accountId: string;
  tokenId: string;
  label: string;
  issuedAt: string;
  expiry?: string;
  purpose: ServiceAccountApiTokenPurpose;
}

export interface ServiceAccountApiTokenInput {
  label: string;
  expiry?: string;
  readWrite: boolean;
  compact: boolean;
}

export interface ServiceAccountCredentialStatus {
  checkedAt: string;
  reachable: boolean;
  generatedAt?: string;
}

export interface Person {
  id: string;
  username: string;
  displayName: string;
  legalName: string;
  email: string;
  status: UserStatus;
  validFrom?: string;
  expireAt?: string;
  softLockExpire?: string;
  groups: string[];
  credential: CredentialState;
  unix: UnixAccountSettings;
  lastAuth: string;
}

export interface PersonStatusPatch {
  status: UserStatus;
  validFrom?: string;
  expireAt?: string;
  softLockExpire?: string;
}

export interface PersonCertificate {
  id: string;
  label: string;
  pem: string;
}

export interface Group {
  id: string;
  name: string;
  displayName: string;
  description: string;
  members: string[];
  parentGroups: string[];
  managedBy: string;
}

export interface Application {
  id: string;
  name: string;
  displayName: string;
  landingUrl: string;
  imageUrl: string;
  clientType: ClientType;
  redirectUris: string[];
  allowedGroups: string[];
  scopes: string[];
  scopeMaps?: ApplicationScopeMap[];
  supplementalScopeMaps?: ApplicationScopeMap[];
  claimMaps?: ApplicationClaimMap[];
  status: "ready" | "draft" | "attention";
}

export type CreatedApplication = Application & { clientSecret?: string };

export interface ApplicationScopeMap {
  groupId: string;
  scopes: string[];
}

export type ApplicationClaimMapJoin = "csv" | "ssv" | "array";

export interface ApplicationClaimMapRule {
  groupId: string;
  values: string[];
}

export interface ApplicationClaimMap {
  claimName: string;
  join: ApplicationClaimMapJoin;
  rules: ApplicationClaimMapRule[];
}

export interface ApplicationPolicyInput {
  scopeMaps: ApplicationScopeMap[];
  supplementalScopeMaps: ApplicationScopeMap[];
  claimMaps: ApplicationClaimMap[];
}

export interface AccessPath {
  app: Application;
  groups: Group[];
}

export interface SshPublicKey {
  tag: string;
  key: string;
}

export interface CredentialUpdateIntent {
  token: string;
  expiryTime: string;
}

export interface PersonCreationResult {
  person: Person;
  credentialIntent?: CredentialUpdateIntent;
  credentialEmailSent?: boolean;
  credentialNotice?: string;
}

export interface GroupCreationResult {
  group: Group;
  metadataWarnings: string[];
}

export interface TotpRegistration {
  accountName: string;
  issuer: string;
  secret: string;
  algorithm: string;
  step: number;
  digits: number;
  uri: string;
}

export interface CredentialUpdateStatus {
  sessionToken: string;
  spn: string;
  displayName: string;
  canCommit: boolean;
  warnings: string[];
  primaryState: string;
  passkeysState: string;
  attestedPasskeysState: string;
  unixCredentialState: string;
  sshKeysState: string;
  passkeyCount: number;
  attestedPasskeyCount: number;
  passkeys: PasskeyCredential[];
  attestedPasskeys: PasskeyCredential[];
  sshKeyCount: number;
  sshKeyLabels: string[];
  hasPrimaryCredential: boolean;
  hasUnixCredential: boolean;
  totpLabels: string[];
  pendingTotp: TotpRegistration | null;
  pendingPasskey: PasskeyRegistration | null;
  totpIssue: "try-again" | "name-taken" | "invalid-sha1" | null;
  totpIssueLabel: string;
  pendingBackupCodes: string[];
}

export interface PasskeyCredential {
  uuid: string;
  tag: string;
}

export interface PasskeyRegistration {
  kind: "passkey" | "attested-passkey";
  challenge: unknown;
}

export interface PasskeyLoginChallenge {
  authSessionId: string;
  kind: "passkey" | "security-key";
  challenge: unknown;
  username: string;
  privileged: boolean;
}

export interface UserAuthTokenStatus {
  accountId: string;
  sessionId: string;
  issuedAt: string;
  purpose: string;
  state: "neverexpires" | "revoked" | { expiresAt: string };
}

export interface ConsoleState {
  role: Role;
  currentUserId: string;
  branding: BrandingSettings;
  people: Person[];
  serviceAccounts: ServiceAccount[];
  groups: Group[];
  apps: Application[];
}

export interface DashboardDataSourceConfig {
  mode: "kanidm" | "mock";
  apiBasePath: string;
  openApiPath: string;
}

export interface DashboardConfig {
  siteName: string;
  logoUrl: string;
  loginMessage: string;
  dataSource: DashboardDataSourceConfig;
  adminGroup: string;
  theme: ThemeSettings;
}

export interface NewPersonInput {
  username: string;
  displayName: string;
  legalName: string;
  email: string;
  status: UserStatus;
  groups: string[];
  credentialMode: "enrolment-link" | "temporary-password" | "recovery-only";
}

export interface NewGroupInput {
  name: string;
  displayName: string;
  description: string;
  members: string[];
  parentGroups: string[];
  managedBy: string;
}

export interface NewServiceAccountInput {
  name: string;
  displayName: string;
  description: string;
  managedBy: string;
  groups: string[];
}

export interface NewApplicationInput {
  name: string;
  displayName: string;
  landingUrl: string;
  imageUrl: string;
  clientType: ClientType;
  redirectUris: string[];
  allowedGroups: string[];
  scopes: string[];
  scopeMaps?: ApplicationScopeMap[];
}

export interface ApplicationPatch {
  displayName?: string;
  landingUrl?: string;
  redirectUris?: string[];
}

export interface ServiceAccountPatch {
  displayName?: string;
  description?: string;
  managedBy?: string;
}

export interface ProfileUpdateInput {
  displayName: string;
  legalName: string;
  email: string;
}

export interface KanidmImageValidation {
  maxPixels: number;
  maxBytes: number;
  formats: string[];
}

export const kanidmImageValidation: KanidmImageValidation = {
  maxPixels: 1024 * 1024,
  maxBytes: 256 * 1024,
  formats: ["png", "jpg", "jpeg", "gif", "svg", "webp"],
};

export const defaultDashboardConfig: DashboardConfig = {
  siteName: "Kanidm Dashboard",
  logoUrl: "",
  loginMessage: "Sign in to continue to your company applications and identity settings.",
  adminGroup: "idm_admins",
  dataSource: {
    mode: "kanidm",
    apiBasePath: "",
    openApiPath: "/docs/v1/openapi.json",
  },
  theme: {
    mode: "dark",
    preset: "orb",
    accentColor: "#007aff",
    successColor: "#30d158",
    warningColor: "#ff9f0a",
    dangerColor: "#ff453a",
    surfaceIntensity: "frosted",
    statusPalette: "kanidm",
    logoTreatment: "both",
  },
};

export const supportedAdminSurfaces = [
  "Persons and self-service profile attributes",
  "Person lifecycle, groups, certificates, and admin credential operations",
  "Service accounts, API tokens, SSH keys, generated credentials, and Unix settings",
  "Groups and membership",
  "OAuth2/OIDC application display names and images",
  "Domain display name and domain image",
  "Credential reset and update flows",
  "RADIUS password self-service",
];

export const intentionallyExcludedSurfaces = [
  "Proxy/outpost deployment",
  "Login flow builder",
  "Arbitrary policy engine",
  "Outbound SCIM provider management",
  "SAML provider management without verified Kanidm support",
];
