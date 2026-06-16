import {
  createContext,
  createEffect,
  createMemo,
  createSignal,
  onMount,
  useContext,
  type Accessor,
  type ParentProps,
} from "solid-js";
import type {
  AccessPath,
  Application,
  ApplicationKeyAction,
  ApplicationPatch,
  ApplicationPolicyInput,
  BrandingSettings,
  ConsoleState,
  CreatedApplication,
  CredentialUpdateIntent,
  CredentialUpdateStatus,
  DashboardConfig,
  Group,
  GroupCreationResult,
  GroupPolicyAttribute,
  GroupUnixSettings,
  NewApplicationInput,
  NewGroupInput,
  NewPersonInput,
  NewServiceAccountInput,
  PasskeyCredential,
  PasskeyLoginChallenge,
  PasskeyRegistration,
  Person,
  PersonCertificate,
  PersonCreationResult,
  PersonStatusPatch,
  ProfileUpdateInput,
  RecycleBinEntry,
  Role,
  SchemaCatalog,
  ServiceAccount,
  ServiceAccountApiToken,
  ServiceAccountApiTokenInput,
  ServiceAccountCredentialState,
  ServiceAccountCredentialStatus,
  ServiceAccountPatch,
  SshPublicKey,
  SystemConfigEntry,
  ThemeMode,
  ThemeSettings,
  UnixAccountSettings,
  UserAuthTokenStatus,
} from "./domain";
import { defaultApplicationPolicyToggles, defaultDashboardConfig } from "./domain";
import { KanidmDataSource, MockDataSource } from "./data-source";
import { isKanidmAuthFailure } from "./kanidm-error";
import { Configuration } from "./generated/kanidm-sdk/runtime/runtime";
import {
  loginWithPassword as authLoginWithPassword,
  loginWithPasswordTotp as authLoginWithPasswordTotp,
  loginWithPasswordBackupCode as authLoginWithPasswordBackupCode,
  startPasskeyLogin as authStartPasskeyLogin,
  finishPasskeyLogin as authFinishPasskeyLogin,
  startSecurityKeyLogin as authStartSecurityKeyLogin,
  finishSecurityKeyLogin as authFinishSecurityKeyLogin,
} from "./kanidm-auth";
import { initialState } from "./seed";

const storageKey = "kanidm-dashboard-state-v2";
const bearerTokenKey = "kanidm-dashboard-kanidm-token";
const configPath = "/dashboard.config.json";
const seedRadiusPassword = "rad-demo-2a7c-9e4f";

interface ApiStatus {
  mode: DashboardConfig["dataSource"]["mode"];
  state: "ready" | "loading" | "fallback" | "error";
  message: string;
}

interface ConsoleContextValue {
  state: Accessor<ConsoleState>;
  config: Accessor<DashboardConfig>;
  configReady: Accessor<boolean>;
  sessionReady: Accessor<boolean>;
  isAuthenticated: Accessor<boolean>;
  apiStatus: Accessor<ApiStatus>;
  branding: Accessor<BrandingSettings>;
  currentUser: Accessor<Person>;
  refreshSessionData: () => Promise<void>;
  loginWithPassword: (
    username: string,
    password: string,
    privileged: boolean,
    options?: {
      method?: "password" | "totp" | "backup";
      totpCode?: string;
      backupCode?: string;
    },
  ) => Promise<void>;
  startPasskeyLogin: (username: string, privileged: boolean) => Promise<PasskeyLoginChallenge>;
  finishPasskeyLogin: (challenge: PasskeyLoginChallenge, assertion: unknown) => Promise<void>;
  startSecurityKeyLogin: (username: string, privileged: boolean) => Promise<PasskeyLoginChallenge>;
  finishSecurityKeyLogin: (
    challenge: PasskeyLoginChallenge,
    assertion: unknown,
    password: string,
  ) => Promise<void>;
  logout: () => void;
  setRole: (role: Role) => void;
  setThemeMode: (mode: ThemeMode) => void;
  updateNativeBranding: (patch: Partial<Omit<BrandingSettings, "theme">>) => Promise<void>;
  resetNativeBranding: () => void;
  updateProfile: (input: ProfileUpdateInput) => Promise<void>;
  updatePersonProfile: (personId: string, input: ProfileUpdateInput) => Promise<void>;
  updatePersonStatus: (personId: string, patch: PersonStatusPatch) => Promise<void>;
  deletePerson: (personId: string) => Promise<void>;
  getPersonCertificates: (personId: string) => Promise<PersonCertificate[]>;
  addPersonCertificate: (personId: string, certificate: string) => Promise<PersonCertificate[]>;
  getRadiusPassword: () => Promise<string | null>;
  generateRadiusPassword: () => Promise<string | null>;
  deleteRadiusPassword: () => Promise<void>;
  getPersonRadiusPassword: (personId: string) => Promise<string | null>;
  generatePersonRadiusPassword: (personId: string) => Promise<string | null>;
  deletePersonRadiusPassword: (personId: string) => Promise<void>;
  getSshPublicKeys: () => Promise<SshPublicKey[]>;
  addSshPublicKey: (tag: string, key: string) => Promise<SshPublicKey[]>;
  deleteSshPublicKey: (tag: string) => Promise<SshPublicKey[]>;
  getPersonSshPublicKeys: (personId: string) => Promise<SshPublicKey[]>;
  addPersonSshPublicKey: (personId: string, tag: string, key: string) => Promise<SshPublicKey[]>;
  deletePersonSshPublicKey: (personId: string, tag: string) => Promise<SshPublicKey[]>;
  getUserAuthTokens: () => Promise<UserAuthTokenStatus[]>;
  deleteUserAuthToken: (sessionId: string) => Promise<UserAuthTokenStatus[]>;
  getPersonUserAuthTokens: (personId: string) => Promise<UserAuthTokenStatus[]>;
  deletePersonUserAuthToken: (
    personId: string,
    sessionId: string,
  ) => Promise<UserAuthTokenStatus[]>;
  issueCredentialUpdateIntent: (
    personId: string,
    ttlSeconds: number,
  ) => Promise<CredentialUpdateIntent>;
  getUnixAccount: () => UnixAccountSettings;
  extendUnixAccount: (
    input: Pick<UnixAccountSettings, "gidNumber" | "shell">,
  ) => Promise<UnixAccountSettings>;
  setUnixCredential: (password: string) => Promise<UnixAccountSettings>;
  deleteUnixCredential: () => Promise<UnixAccountSettings>;
  extendPersonUnixAccount: (
    personId: string,
    input: Pick<UnixAccountSettings, "gidNumber" | "shell">,
  ) => Promise<UnixAccountSettings>;
  setPersonUnixCredential: (personId: string, password: string) => Promise<UnixAccountSettings>;
  deletePersonUnixCredential: (personId: string) => Promise<UnixAccountSettings>;
  beginCredentialUpdate: (personId: string) => Promise<CredentialUpdateStatus>;
  exchangeCredentialUpdateIntent: (intentToken: string) => Promise<CredentialUpdateStatus>;
  updateCredentialPassword: (
    sessionToken: string,
    password: string,
  ) => Promise<CredentialUpdateStatus>;
  generateCredentialBackupCodes: (sessionToken: string) => Promise<CredentialUpdateStatus>;
  removeCredentialBackupCodes: (sessionToken: string) => Promise<CredentialUpdateStatus>;
  startCredentialTotp: (sessionToken: string) => Promise<CredentialUpdateStatus>;
  verifyCredentialTotp: (
    sessionToken: string,
    code: string,
    label: string,
  ) => Promise<CredentialUpdateStatus>;
  acceptCredentialTotpSha1: (sessionToken: string) => Promise<CredentialUpdateStatus>;
  removeCredentialTotp: (sessionToken: string, label: string) => Promise<CredentialUpdateStatus>;
  cancelCredentialMfaRegistration: (sessionToken: string) => Promise<CredentialUpdateStatus>;
  updateCredentialUnixPassword: (
    sessionToken: string,
    password: string,
  ) => Promise<CredentialUpdateStatus>;
  removeCredentialUnixPassword: (sessionToken: string) => Promise<CredentialUpdateStatus>;
  removeCredentialSshPublicKey: (
    sessionToken: string,
    label: string,
  ) => Promise<CredentialUpdateStatus>;
  addCredentialSshPublicKey: (
    sessionToken: string,
    label: string,
    publicKey: string,
  ) => Promise<CredentialUpdateStatus>;
  startCredentialPasskey: (
    sessionToken: string,
    kind: PasskeyRegistration["kind"],
  ) => Promise<CredentialUpdateStatus>;
  finishCredentialPasskey: (
    sessionToken: string,
    label: string,
    registration: unknown,
    kind: PasskeyRegistration["kind"],
  ) => Promise<CredentialUpdateStatus>;
  removeCredentialPasskey: (sessionToken: string, uuid: string) => Promise<CredentialUpdateStatus>;
  removeCredentialAttestedPasskey: (
    sessionToken: string,
    uuid: string,
  ) => Promise<CredentialUpdateStatus>;
  commitCredentialUpdate: (sessionToken: string) => Promise<void>;
  cancelCredentialUpdate: (sessionToken: string) => Promise<void>;
  addPerson: (input: NewPersonInput) => Promise<PersonCreationResult>;
  addGroup: (input: NewGroupInput) => Promise<GroupCreationResult>;
  deleteGroup: (groupId: string, groupName: string) => Promise<void>;
  updateGroup: (
    groupId: string,
    groupName: string,
    patch: Partial<Pick<Group, "displayName" | "description" | "managedBy">>,
  ) => Promise<void>;
  addGroupMembers: (name: string, members: string[]) => Promise<void>;
  removeGroupMembers: (name: string, members: string[]) => Promise<void>;
  groupUnixSettings: (groupId: string) => Promise<GroupUnixSettings | null>;
  extendGroupUnix: (groupId: string, gidNumber: number) => Promise<GroupUnixSettings | null>;
  groupPolicy: (groupId: string) => Promise<GroupPolicyAttribute[]>;
  updateGroupPolicyAttribute: (groupId: string, attr: string, values: string[]) => Promise<void>;
  schemaCatalog: () => Promise<SchemaCatalog>;
  recycleBinEntries: () => Promise<RecycleBinEntry[]>;
  recycleBinEntry: (id: string) => Promise<RecycleBinEntry | null>;
  reviveRecycleBinEntry: (id: string) => Promise<void>;
  systemConfig: () => Promise<SystemConfigEntry[]>;
  updateSystemAttribute: (attr: string, values: string[]) => Promise<void>;
  addServiceAccount: (input: NewServiceAccountInput) => Promise<ServiceAccount>;
  updateServiceAccount: (serviceAccountId: string, patch: ServiceAccountPatch) => Promise<void>;
  deleteServiceAccount: (serviceAccountId: string) => Promise<void>;
  toggleServiceAccountGroup: (serviceAccountId: string, groupId: string) => Promise<void>;
  getServiceAccountApiTokens: (serviceAccountId: string) => Promise<ServiceAccountApiToken[]>;
  generateServiceAccountApiToken: (
    serviceAccountId: string,
    input: ServiceAccountApiTokenInput,
  ) => Promise<{ token: string; tokens: ServiceAccountApiToken[] }>;
  deleteServiceAccountApiToken: (
    serviceAccountId: string,
    tokenId: string,
  ) => Promise<ServiceAccountApiToken[]>;
  getServiceAccountCredentialStatus: (
    serviceAccountId: string,
  ) => Promise<ServiceAccountCredentialStatus>;
  generateServiceAccountPassword: (
    serviceAccountId: string,
  ) => Promise<ServiceAccountCredentialStatus>;
  getServiceAccountSshPublicKeys: (serviceAccountId: string) => Promise<SshPublicKey[]>;
  addServiceAccountSshPublicKey: (
    serviceAccountId: string,
    tag: string,
    key: string,
  ) => Promise<SshPublicKey[]>;
  deleteServiceAccountSshPublicKey: (
    serviceAccountId: string,
    tag: string,
  ) => Promise<SshPublicKey[]>;
  extendServiceAccountUnixAccount: (
    serviceAccountId: string,
    input: Pick<UnixAccountSettings, "gidNumber" | "shell">,
  ) => Promise<UnixAccountSettings>;
  addApplication: (input: NewApplicationInput) => Promise<CreatedApplication>;
  updateApplication: (appId: string, patch: ApplicationPatch) => Promise<void>;
  updateApplicationPolicy: (appId: string, input: ApplicationPolicyInput) => Promise<void>;
  updateApplicationKeyAction: (appId: string, action: ApplicationKeyAction) => Promise<void>;
  getApplicationClientSecret: (appId: string) => Promise<string | null>;
  deleteApplication: (appId: string) => Promise<void>;
  toggleGroupMember: (groupId: string, personId: string) => Promise<void>;
  uploadDomainImage: (file: File) => Promise<void>;
  resetDomainImage: () => Promise<void>;
  uploadAppImage: (appId: string, file: File) => Promise<void>;
  resetAppImage: (appId: string) => Promise<void>;
  resolveImageUrl: (imageUrl: string) => Promise<string>;
  getAccessForPerson: (personId: string) => AccessPath[];
  getGroupsForPerson: (personId: string) => Group[];
  getPeopleForGroup: (groupId: string) => Person[];
  themeConfigSnippet: () => string;
  resetDemoData: () => void;
}

const ConsoleContext = createContext<ConsoleContextValue>();

export function ConsoleProvider(props: ParentProps) {
  const [state, setState] = createSignal<ConsoleState>(
    createUnauthenticatedState(defaultDashboardConfig),
  );
  let mockRadiusPasswords = seedMockRadiusPasswords();
  const [mockSshPublicKeys, setMockSshPublicKeys] = createSignal(seedMockSshPublicKeys());
  const [mockServiceAccountApiTokens, setMockServiceAccountApiTokens] = createSignal(
    seedMockServiceAccountApiTokens(),
  );
  const [mockServiceAccountSshPublicKeys, setMockServiceAccountSshPublicKeys] = createSignal(
    seedMockServiceAccountSshPublicKeys(),
  );
  const [mockPersonCertificates, setMockPersonCertificates] = createSignal<
    Record<string, PersonCertificate[]>
  >({});
  const [mockUserAuthTokens, setMockUserAuthTokens] = createSignal(seedMockUserAuthTokens());
  const [config, setConfig] = createSignal<DashboardConfig>(defaultDashboardConfig);
  const [configReady, setConfigReady] = createSignal(false);
  const [sessionReady, setSessionReady] = createSignal(false);
  const [isAuthenticated, setIsAuthenticated] = createSignal(
    typeof window !== "undefined" && Boolean(sessionStorage.getItem(bearerTokenKey)),
  );
  const [apiStatus, setApiStatus] = createSignal<ApiStatus>({
    mode: defaultDashboardConfig.dataSource.mode,
    state: "loading",
    message: "Loading dashboard config.",
  });

  onMount(() => {
    void bootstrapConfigAndData();
  });

  createEffect(() => {
    const current = state();
    if (typeof window !== "undefined" && configReady() && config().dataSource.mode === "mock") {
      if (isAuthenticated()) {
        localStorage.setItem(storageKey, JSON.stringify(current));
      }
    }
  });

  createEffect(() => {
    applyTheme(config().theme);
  });

  const branding = createMemo<BrandingSettings>(() => ({
    ...state().branding,
    companyName: state().branding.companyName || config().siteName,
    logoUrl: state().branding.logoUrl || config().logoUrl,
    loginMessage: state().branding.loginMessage || config().loginMessage,
    theme: config().theme,
  }));

  const currentUser = createMemo<Person>(() => {
    const current = state();
    return (
      current.people.find((person) => person.id === current.currentUserId) ?? current.people[0]
    );
  });

  const personForId = (personId: string) =>
    state().people.find((person) => person.id === personId) ??
    state().people.find((person) => person.username === personId);

  const kanidmPersonId = (personId: string) => personForId(personId)?.username ?? personId;
  const serviceAccountForId = (serviceAccountId: string) =>
    state().serviceAccounts.find((serviceAccount) => serviceAccount.id === serviceAccountId) ??
    state().serviceAccounts.find((serviceAccount) => serviceAccount.name === serviceAccountId);

  const kanidmServiceAccountId = (serviceAccountId: string) =>
    serviceAccountForId(serviceAccountId)?.name ?? serviceAccountId;

  async function bootstrapConfigAndData() {
    const loadedConfig = await loadDashboardConfig();
    setConfig(loadedConfig);

    if (loadedConfig.dataSource.mode !== "kanidm") {
      setState(readMockState(loadedConfig));
      setConfigReady(true);
      setApiStatus({
        mode: "mock",
        state: "ready",
        message: "Using local demo data. Set dataSource.mode to kanidm for real API reads.",
      });
      setIsAuthenticated(false);
      setSessionReady(true);
      return;
    }

    setState(createUnauthenticatedState(loadedConfig));
    setConfigReady(true);
    setApiStatus({
      mode: "kanidm",
      state: "loading",
      message: "Loading Kanidm data from the same-origin API.",
    });

    const token = sessionStorage.getItem(bearerTokenKey) ?? undefined;
    if (!token) {
      setIsAuthenticated(false);
      setSessionReady(true);
      setApiStatus({
        mode: "kanidm",
        state: "ready",
        message: "Kanidm config loaded. Sign in to load identity data.",
      });
      return;
    }

    try {
      const dataSource = new KanidmDataSource(loadedConfig.dataSource, token);
      const loadedState = applyDashboardBrandingFallback(await dataSource.load(), loadedConfig);
      setState(loadedState);
      setIsAuthenticated(true);
      setSessionReady(true);
      setApiStatus({
        mode: "kanidm",
        state: "ready",
        message: "Loaded real Kanidm data from the same-origin API.",
      });
    } catch (error) {
      if (handleKanidmAuthFailure(error, token)) return;

      clearKanidmSession();
      setSessionReady(true);
      setApiStatus({
        mode: "kanidm",
        state: "error",
        message:
          error instanceof Error
            ? `Kanidm API unavailable; sign in again when the service recovers. ${error.message}`
            : "Kanidm API unavailable; sign in again when the service recovers.",
      });
    }
  }

  const refreshSessionData = async () => {
    const loadedConfig = config();
    if (loadedConfig.dataSource.mode !== "kanidm") {
      setState(readMockState(loadedConfig));
      return;
    }

    const token = sessionStorage.getItem(bearerTokenKey);
    if (!token) {
      clearKanidmSession("Kanidm session expired. Sign in again.");
      throw new Error("Kanidm refresh requires an authenticated bearer token.");
    }

    setApiStatus({
      mode: "kanidm",
      state: "loading",
      message: "Refreshing Kanidm identity data.",
    });
    const dataSource = new KanidmDataSource(loadedConfig.dataSource, token);
    const loadedState = applyDashboardBrandingFallback(await dataSource.load(), loadedConfig);
    setState(loadedState);
    setApiStatus({
      mode: "kanidm",
      state: "ready",
      message: "Loaded real Kanidm data from the same-origin API.",
    });
  };

  const getGroupsForPerson = (personId: string) => {
    const current = state();
    const person = current.people.find((candidate) => candidate.id === personId);
    if (!person) return [];
    const ids = resolveGroupClosure(person.groups, current.groups);
    return current.groups.filter((group) => ids.includes(group.id));
  };

  const getPeopleForGroup = (groupId: string) =>
    state().people.filter((person) => person.groups.includes(groupId));

  const getAccessForPerson = (personId: string) => {
    const current = state();
    const personGroups = getGroupsForPerson(personId);
    return current.apps
      .filter((app) =>
        app.allowedGroups.some((groupId) => personGroups.some((group) => group.id === groupId)),
      )
      .map((app) => ({
        app,
        groups: personGroups.filter((group) => app.allowedGroups.includes(group.id)),
      }));
  };

  const setRole = (role: Role) => {
    setState((previous) => ({
      ...previous,
      role,
      currentUserId: role === "admin" ? "u-ava" : "u-mika",
    }));
  };

  const loginWithPassword = async (
    username: string,
    password: string,
    privileged: boolean,
    options: {
      method?: "password" | "totp" | "backup";
      totpCode?: string;
      backupCode?: string;
    } = {},
  ) => {
    if (!configReady()) {
      throw new Error("Dashboard configuration is still loading.");
    }

    const loadedConfig = config();
    if (loadedConfig.dataSource.mode !== "kanidm") {
      setIsAuthenticated(true);
      setSessionReady(true);
      setRole(privileged ? "admin" : "user");
      return;
    }

    setApiStatus({
      mode: "kanidm",
      state: "loading",
      message: "Authenticating with Kanidm.",
    });

    const client = loadedConfig.dataSource.apiBasePath.replace(/\/$/, "");
    const method = options.method ?? "password";
    const token =
      method === "totp"
        ? await authLoginWithPasswordTotp(
            client,
            username,
            password,
            parseTotpCode(options.totpCode ?? ""),
            privileged,
          )
        : method === "backup"
          ? await authLoginWithPasswordBackupCode(
              client,
              username,
              password,
              options.backupCode ?? "",
              privileged,
            )
          : await authLoginWithPassword(client, username, password, privileged);
    sessionStorage.setItem(bearerTokenKey, token);
    const dataSource = new KanidmDataSource(loadedConfig.dataSource, token);
    setState(applyDashboardBrandingFallback(await dataSource.load(), loadedConfig));
    setIsAuthenticated(true);
    setSessionReady(true);
    setApiStatus({
      mode: "kanidm",
      state: "ready",
      message: "Authenticated with Kanidm.",
    });
  };

  const startPasskeyLogin = async (username: string, privileged: boolean) => {
    if (!configReady()) {
      throw new Error("Dashboard configuration is still loading.");
    }

    const trimmedUsername = username.trim();
    if (!trimmedUsername) throw new Error("Username is required.");

    const loadedConfig = config();
    if (loadedConfig.dataSource.mode !== "kanidm") {
      return mockPasskeyLoginChallenge(trimmedUsername, privileged);
    }

    setApiStatus({
      mode: "kanidm",
      state: "loading",
      message: "Starting Kanidm passkey authentication.",
    });

    return authStartPasskeyLogin(
      loadedConfig.dataSource.apiBasePath.replace(/\/$/, ""),
      trimmedUsername,
      privileged,
    );
  };

  const finishPasskeyLogin = async (challenge: PasskeyLoginChallenge, assertion: unknown) => {
    const loadedConfig = config();
    if (loadedConfig.dataSource.mode !== "kanidm") {
      setIsAuthenticated(true);
      setSessionReady(true);
      setRole(challenge.privileged ? "admin" : "user");
      return;
    }

    const client = loadedConfig.dataSource.apiBasePath.replace(/\/$/, "");
    const token = await authFinishPasskeyLogin(client, challenge, assertion);
    sessionStorage.setItem(bearerTokenKey, token);
    const dataSource = new KanidmDataSource(loadedConfig.dataSource, token);
    setState(applyDashboardBrandingFallback(await dataSource.load(), loadedConfig));
    setIsAuthenticated(true);
    setSessionReady(true);
    setApiStatus({
      mode: "kanidm",
      state: "ready",
      message: "Authenticated with Kanidm passkey.",
    });
  };

  const startSecurityKeyLogin = async (username: string, privileged: boolean) => {
    if (!configReady()) {
      throw new Error("Dashboard configuration is still loading.");
    }

    const trimmedUsername = username.trim();
    if (!trimmedUsername) throw new Error("Username is required.");

    const loadedConfig = config();
    if (loadedConfig.dataSource.mode !== "kanidm") {
      return {
        ...mockPasskeyLoginChallenge(trimmedUsername, privileged),
        kind: "security-key" as const,
      };
    }

    setApiStatus({
      mode: "kanidm",
      state: "loading",
      message: "Starting Kanidm security-key authentication.",
    });

    return authStartSecurityKeyLogin(
      loadedConfig.dataSource.apiBasePath.replace(/\/$/, ""),
      trimmedUsername,
      privileged,
    );
  };

  const finishSecurityKeyLogin = async (
    challenge: PasskeyLoginChallenge,
    assertion: unknown,
    password: string,
  ) => {
    const loadedConfig = config();
    if (loadedConfig.dataSource.mode !== "kanidm") {
      setIsAuthenticated(true);
      setSessionReady(true);
      setRole(challenge.privileged ? "admin" : "user");
      return;
    }

    const client = loadedConfig.dataSource.apiBasePath.replace(/\/$/, "");
    const token = await authFinishSecurityKeyLogin(client, challenge, assertion, password);
    sessionStorage.setItem(bearerTokenKey, token);
    const dataSource = new KanidmDataSource(loadedConfig.dataSource, token);
    setState(applyDashboardBrandingFallback(await dataSource.load(), loadedConfig));
    setIsAuthenticated(true);
    setSessionReady(true);
    setApiStatus({
      mode: "kanidm",
      state: "ready",
      message: "Authenticated with Kanidm security key.",
    });
  };

  const logout = () => {
    sessionStorage.removeItem(bearerTokenKey);
    setIsAuthenticated(false);
    setSessionReady(true);
    setState(createUnauthenticatedState(config(), branding()));
  };

  const setThemeMode = (mode: ThemeMode) => {
    setConfig((previous) => ({
      ...previous,
      theme: { ...previous.theme, mode },
    }));
  };

  const updateNativeBranding = async (patch: Partial<Omit<BrandingSettings, "theme">>) => {
    if (config().dataSource.mode === "kanidm" && patch.companyName?.trim()) {
      if (!branding().canManageNativeDomainBranding) {
        throw new Error(
          "Current Kanidm session cannot manage native domain branding. Use a domain administrator account or static dashboard config.",
        );
      }
      await mutateKanidm("Updating Kanidm domain display name.", () =>
        new KanidmDataSource(
          config().dataSource,
          sessionStorage.getItem(bearerTokenKey) ?? undefined,
        ).setDomainDisplayName(patch.companyName?.trim() ?? ""),
      );
    }

    setState((previous) => ({
      ...previous,
      branding: {
        ...previous.branding,
        ...patch,
        theme: config().theme,
      },
    }));
  };

  const resetNativeBranding = () => {
    setState((previous) => ({
      ...previous,
      branding: { ...initialState.branding, theme: config().theme },
    }));
  };

  const updatePersonProfile = async (personId: string, input: ProfileUpdateInput) => {
    if (config().dataSource.mode === "kanidm") {
      await mutateKanidm("Updating Kanidm profile attributes.", () =>
        new KanidmDataSource(
          config().dataSource,
          sessionStorage.getItem(bearerTokenKey) ?? undefined,
        ).updatePersonProfile(kanidmPersonId(personId), input),
      );
      return;
    }

    setState((previous) => ({
      ...previous,
      people: previous.people.map((person) =>
        person.id === personId
          ? {
              ...person,
              displayName: input.displayName.trim(),
              legalName: input.legalName.trim(),
              email: input.email.trim(),
            }
          : person,
      ),
    }));
  };

  const updateProfile = async (input: ProfileUpdateInput) =>
    updatePersonProfile(currentUser().id, input);

  const updatePersonStatus = async (personId: string, patch: PersonStatusPatch) => {
    if (config().dataSource.mode === "kanidm") {
      await mutateKanidm("Updating Kanidm person status.", () =>
        new KanidmDataSource(
          config().dataSource,
          sessionStorage.getItem(bearerTokenKey) ?? undefined,
        ).updatePersonStatus(kanidmPersonId(personId), patch),
      );
      return;
    }

    setState((previous) => ({
      ...previous,
      people: previous.people.map((person) =>
        person.id === personId
          ? {
              ...person,
              status: patch.status,
              ...(patch.validFrom !== undefined ? { validFrom: patch.validFrom } : {}),
              ...(patch.expireAt !== undefined ? { expireAt: patch.expireAt } : {}),
              ...(patch.softLockExpire !== undefined
                ? { softLockExpire: patch.softLockExpire }
                : {}),
            }
          : person,
      ),
    }));
  };

  const deletePerson = async (personId: string) => {
    const person = personForId(personId);
    if (!person) throw new Error("Person was not found.");
    if (config().dataSource.mode === "kanidm") {
      await mutateKanidm("Deleting Kanidm person.", () =>
        new KanidmDataSource(
          config().dataSource,
          sessionStorage.getItem(bearerTokenKey) ?? undefined,
        ).deletePerson(person.username),
      );
      return;
    }

    setState((previous) => ({
      ...previous,
      people: previous.people.filter((candidate) => candidate.id !== personId),
      groups: previous.groups.map((group) => ({
        ...group,
        members: group.members.filter((memberId) => memberId !== personId),
      })),
    }));
  };

  const getPersonCertificates = async (personId: string) => {
    if (config().dataSource.mode === "kanidm") {
      return readKanidm(
        "Reading Kanidm person certificates.",
        () =>
          new KanidmDataSource(
            config().dataSource,
            sessionStorage.getItem(bearerTokenKey) ?? undefined,
          ).personCertificates(kanidmPersonId(personId)),
        { reportError: false },
      );
    }

    return mockPersonCertificates()[personId] ?? [];
  };

  const addPersonCertificate = async (personId: string, certificate: string) => {
    const trimmed = certificate.trim();
    if (!trimmed) throw new Error("Certificate is required.");
    if (config().dataSource.mode === "kanidm") {
      await mutateKanidm("Adding Kanidm person certificate.", () =>
        new KanidmDataSource(
          config().dataSource,
          sessionStorage.getItem(bearerTokenKey) ?? undefined,
        ).addPersonCertificate(kanidmPersonId(personId), trimmed),
      );
      return getPersonCertificates(personId);
    }

    const nextCertificate: PersonCertificate = {
      id: `mock-cert-${Date.now()}`,
      label: `Certificate ${(mockPersonCertificates()[personId] ?? []).length + 1}`,
      pem: trimmed,
    };
    const next = [...(mockPersonCertificates()[personId] ?? []), nextCertificate];
    setMockPersonCertificates((previous) => ({ ...previous, [personId]: next }));
    return next;
  };

  const getPersonRadiusPassword = async (personId: string) => {
    if (config().dataSource.mode !== "kanidm") {
      const person = personForId(personId);
      if (!person?.credential.radiusPassword) return null;
      return mockRadiusPasswords[personId] ?? seedRadiusPassword;
    }
    return readKanidm(
      "Reading Kanidm RADIUS password.",
      () =>
        new KanidmDataSource(
          config().dataSource,
          sessionStorage.getItem(bearerTokenKey) ?? undefined,
        ).radiusPassword(kanidmPersonId(personId)),
      { reportError: false },
    );
  };

  const generatePersonRadiusPassword = async (personId: string) => {
    if (config().dataSource.mode === "kanidm") {
      const { result } = await mutateKanidm("Generating Kanidm RADIUS password.", () =>
        new KanidmDataSource(
          config().dataSource,
          sessionStorage.getItem(bearerTokenKey) ?? undefined,
        ).generateRadiusPassword(kanidmPersonId(personId)),
      );
      return result;
    }

    const generated = `rad-demo-${Math.random().toString(36).slice(2, 10)}`;
    mockRadiusPasswords[personId] = generated;
    setState((previous) => ({
      ...previous,
      people: previous.people.map((person) =>
        person.id === personId
          ? { ...person, credential: { ...person.credential, radiusPassword: true } }
          : person,
      ),
    }));
    return generated;
  };

  const deletePersonRadiusPassword = async (personId: string) => {
    if (config().dataSource.mode === "kanidm") {
      await mutateKanidm("Deleting Kanidm RADIUS password.", () =>
        new KanidmDataSource(
          config().dataSource,
          sessionStorage.getItem(bearerTokenKey) ?? undefined,
        ).deleteRadiusPassword(kanidmPersonId(personId)),
      );
      return;
    }

    delete mockRadiusPasswords[personId];
    setState((previous) => ({
      ...previous,
      people: previous.people.map((person) =>
        person.id === personId
          ? { ...person, credential: { ...person.credential, radiusPassword: false } }
          : person,
      ),
    }));
  };

  const getRadiusPassword = async () => {
    const current = currentUser();
    if (config().dataSource.mode !== "kanidm") {
      return new MockDataSource().radiusPassword(current.id);
    }
    const ds = new KanidmDataSource(
      config().dataSource,
      sessionStorage.getItem(bearerTokenKey) ?? undefined,
    );
    return ds.radiusPassword(current.id);
  };

  const generateRadiusPassword = async () => {
    const current = currentUser();

    if (config().dataSource.mode === "kanidm") {
      const { result } = await mutateKanidm("Generating Kanidm RADIUS password.", () =>
        new KanidmDataSource(
          config().dataSource,
          sessionStorage.getItem(bearerTokenKey) ?? undefined,
        ).generateRadiusPassword(current.id),
      );
      return result;
    }

    const generated = `rad-demo-${Math.random().toString(36).slice(2, 10)}`;
    mockRadiusPasswords[current.id] = generated;
    setState((previous) => ({
      ...previous,
      people: previous.people.map((person) =>
        person.id === current.id
          ? {
              ...person,
              credential: { ...person.credential, radiusPassword: true },
            }
          : person,
      ),
    }));
    return generated;
  };

  const deleteRadiusPassword = async () => {
    const current = currentUser();

    if (config().dataSource.mode === "kanidm") {
      await mutateKanidm("Deleting Kanidm RADIUS password.", () =>
        new KanidmDataSource(
          config().dataSource,
          sessionStorage.getItem(bearerTokenKey) ?? undefined,
        ).deleteRadiusPassword(current.id),
      );
      return;
    }

    await new MockDataSource().deleteRadiusPassword(current.id);
    setState((previous) => ({
      ...previous,
      people: previous.people.map((person) =>
        person.id === current.id
          ? {
              ...person,
              credential: { ...person.credential, radiusPassword: false },
            }
          : person,
      ),
    }));
  };

  const getSshPublicKeys = async () => {
    const current = currentUser();

    if (config().dataSource.mode !== "kanidm") {
      return mockSshPublicKeys()[current.id] ?? [];
    }

    return readKanidm("Reading Kanidm SSH public keys.", () =>
      new KanidmDataSource(
        config().dataSource,
        sessionStorage.getItem(bearerTokenKey) ?? undefined,
      ).sshPublicKeys(current.id),
    );
  };

  const addSshPublicKey = async (tag: string, key: string) => {
    const current = currentUser();
    const nextKey = { tag: tag.trim(), key: key.trim() };
    if (!nextKey.tag || !nextKey.key) {
      throw new Error("SSH key tag and public key are required.");
    }

    if (config().dataSource.mode === "kanidm") {
      await mutateKanidm("Adding Kanidm SSH public key.", () =>
        new KanidmDataSource(
          config().dataSource,
          sessionStorage.getItem(bearerTokenKey) ?? undefined,
        ).addSshPublicKey(current.id, nextKey.tag, nextKey.key),
      );
      return getSshPublicKeys();
    }

    const nextKeys = [
      ...(mockSshPublicKeys()[current.id] ?? []).filter((item) => item.tag !== nextKey.tag),
      nextKey,
    ];
    setMockSshPublicKeys((previous) => ({
      ...previous,
      [current.id]: nextKeys,
    }));
    setState((previous) => updateSshKeyCount(previous, current.id, nextKeys.length));
    return nextKeys;
  };

  const deleteSshPublicKey = async (tag: string) => {
    const current = currentUser();

    if (config().dataSource.mode === "kanidm") {
      await mutateKanidm("Deleting Kanidm SSH public key.", () =>
        new KanidmDataSource(
          config().dataSource,
          sessionStorage.getItem(bearerTokenKey) ?? undefined,
        ).deleteSshPublicKey(current.id, tag),
      );
      return getSshPublicKeys();
    }

    const nextKeys = (mockSshPublicKeys()[current.id] ?? []).filter((item) => item.tag !== tag);
    setMockSshPublicKeys((previous) => ({
      ...previous,
      [current.id]: nextKeys,
    }));
    setState((previous) => updateSshKeyCount(previous, current.id, nextKeys.length));
    return nextKeys;
  };

  const getUserAuthTokens = async () => {
    const current = currentUser();

    if (config().dataSource.mode === "kanidm") {
      return readKanidm("Reading Kanidm sessions.", () =>
        new KanidmDataSource(
          config().dataSource,
          sessionStorage.getItem(bearerTokenKey) ?? undefined,
        ).userAuthTokens(current.id),
      );
    }

    return mockUserAuthTokens().filter((session) => session.accountId === current.id);
  };

  const deleteUserAuthToken = async (sessionId: string) => {
    const current = currentUser();

    if (config().dataSource.mode === "kanidm") {
      await mutateKanidm("Revoking Kanidm user auth token.", () =>
        new KanidmDataSource(
          config().dataSource,
          sessionStorage.getItem(bearerTokenKey) ?? undefined,
        ).deleteUserAuthToken(current.id, sessionId),
      );
      return getUserAuthTokens();
    }

    setMockUserAuthTokens((previous) =>
      previous.map((session) =>
        session.accountId === current.id && session.sessionId === sessionId
          ? { ...session, state: "revoked" }
          : session,
      ),
    );
    return getUserAuthTokens();
  };

  const getPersonSshPublicKeys = async (personId: string) => {
    if (config().dataSource.mode !== "kanidm") {
      return mockSshPublicKeys()[personId] ?? [];
    }

    return readKanidm(
      "Reading Kanidm SSH public keys.",
      () =>
        new KanidmDataSource(
          config().dataSource,
          sessionStorage.getItem(bearerTokenKey) ?? undefined,
        ).sshPublicKeys(kanidmPersonId(personId)),
      { reportError: false },
    );
  };

  const addPersonSshPublicKey = async (personId: string, tag: string, key: string) => {
    const nextKey = { tag: tag.trim(), key: key.trim() };
    if (!nextKey.tag || !nextKey.key) {
      throw new Error("SSH key tag and public key are required.");
    }

    if (config().dataSource.mode === "kanidm") {
      await mutateKanidm("Adding Kanidm SSH public key.", () =>
        new KanidmDataSource(
          config().dataSource,
          sessionStorage.getItem(bearerTokenKey) ?? undefined,
        ).addSshPublicKey(kanidmPersonId(personId), nextKey.tag, nextKey.key),
      );
      return getPersonSshPublicKeys(personId);
    }

    const nextKeys = [
      ...(mockSshPublicKeys()[personId] ?? []).filter((item) => item.tag !== nextKey.tag),
      nextKey,
    ];
    setMockSshPublicKeys((previous) => ({ ...previous, [personId]: nextKeys }));
    setState((previous) => updateSshKeyCount(previous, personId, nextKeys.length));
    return nextKeys;
  };

  const deletePersonSshPublicKey = async (personId: string, tag: string) => {
    if (config().dataSource.mode === "kanidm") {
      await mutateKanidm("Deleting Kanidm SSH public key.", () =>
        new KanidmDataSource(
          config().dataSource,
          sessionStorage.getItem(bearerTokenKey) ?? undefined,
        ).deleteSshPublicKey(kanidmPersonId(personId), tag),
      );
      return getPersonSshPublicKeys(personId);
    }

    const nextKeys = (mockSshPublicKeys()[personId] ?? []).filter((item) => item.tag !== tag);
    setMockSshPublicKeys((previous) => ({ ...previous, [personId]: nextKeys }));
    setState((previous) => updateSshKeyCount(previous, personId, nextKeys.length));
    return nextKeys;
  };

  const getPersonUserAuthTokens = async (personId: string) => {
    if (config().dataSource.mode === "kanidm") {
      return readKanidm(
        "Reading Kanidm sessions.",
        () =>
          new KanidmDataSource(
            config().dataSource,
            sessionStorage.getItem(bearerTokenKey) ?? undefined,
          ).userAuthTokens(kanidmPersonId(personId)),
        { reportError: false },
      );
    }

    return mockUserAuthTokens().filter((session) => session.accountId === personId);
  };

  const deletePersonUserAuthToken = async (personId: string, sessionId: string) => {
    if (config().dataSource.mode === "kanidm") {
      await mutateKanidm("Revoking Kanidm user auth token.", () =>
        new KanidmDataSource(
          config().dataSource,
          sessionStorage.getItem(bearerTokenKey) ?? undefined,
        ).deleteUserAuthToken(kanidmPersonId(personId), sessionId),
      );
      return getPersonUserAuthTokens(personId);
    }

    setMockUserAuthTokens((previous) =>
      previous.map((session) =>
        session.accountId === personId && session.sessionId === sessionId
          ? { ...session, state: "revoked" }
          : session,
      ),
    );
    return getPersonUserAuthTokens(personId);
  };

  const issueCredentialUpdateIntent = async (personId: string, ttlSeconds: number) => {
    const person = state().people.find((candidate) => candidate.id === personId);
    if (!person) throw new Error("Person was not found.");

    if (config().dataSource.mode === "kanidm") {
      const { result } = await mutateKanidm("Issuing Kanidm credential update intent.", () =>
        new KanidmDataSource(
          config().dataSource,
          sessionStorage.getItem(bearerTokenKey) ?? undefined,
        ).credentialUpdateIntent(kanidmPersonId(personId), ttlSeconds),
      );
      return result;
    }

    return {
      token: `kc_demo_${person.username}_${Math.random().toString(36).slice(2, 10)}`,
      expiryTime: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
    };
  };

  const getUnixAccount = () => currentUser().unix;

  const extendUnixAccount = async (input: Pick<UnixAccountSettings, "gidNumber" | "shell">) => {
    const current = currentUser();
    const nextUnix: UnixAccountSettings = {
      gidNumber: input.gidNumber,
      shell: input.shell.trim(),
      credentialSet: current.unix.credentialSet,
    };

    if (config().dataSource.mode === "kanidm") {
      const { loadedState } = await mutateKanidm("Updating Kanidm Unix account.", () =>
        new KanidmDataSource(
          config().dataSource,
          sessionStorage.getItem(bearerTokenKey) ?? undefined,
        ).extendUnixAccount(current.id, {
          gidNumber: nextUnix.gidNumber,
          shell: nextUnix.shell,
        }),
      );
      return loadedState.people.find((person) => person.id === current.id)?.unix ?? current.unix;
    }

    setState((previous) => updateUnixAccount(previous, current.id, nextUnix));
    return nextUnix;
  };

  const setUnixCredential = async (password: string) => {
    const current = currentUser();
    if (!password.trim()) throw new Error("Unix credential password is required.");

    if (config().dataSource.mode === "kanidm") {
      const { loadedState } = await mutateKanidm("Setting Kanidm Unix credential.", () =>
        new KanidmDataSource(
          config().dataSource,
          sessionStorage.getItem(bearerTokenKey) ?? undefined,
        ).setUnixCredential(current.id, password),
      );
      return loadedState.people.find((person) => person.id === current.id)?.unix ?? current.unix;
    }

    const nextUnix = { ...current.unix, credentialSet: true };
    setState((previous) => updateUnixAccount(previous, current.id, nextUnix));
    return nextUnix;
  };

  const deleteUnixCredential = async () => {
    const current = currentUser();

    if (config().dataSource.mode === "kanidm") {
      const { loadedState } = await mutateKanidm("Deleting Kanidm Unix credential.", () =>
        new KanidmDataSource(
          config().dataSource,
          sessionStorage.getItem(bearerTokenKey) ?? undefined,
        ).deleteUnixCredential(current.id),
      );
      return loadedState.people.find((person) => person.id === current.id)?.unix ?? current.unix;
    }

    const nextUnix = { ...current.unix, credentialSet: false };
    setState((previous) => updateUnixAccount(previous, current.id, nextUnix));
    return nextUnix;
  };

  const extendPersonUnixAccount = async (
    personId: string,
    input: Pick<UnixAccountSettings, "gidNumber" | "shell">,
  ) => {
    const person = personForId(personId);
    if (!person) throw new Error("Person was not found.");
    const nextUnix: UnixAccountSettings = {
      gidNumber: input.gidNumber,
      shell: input.shell.trim(),
      credentialSet: person.unix.credentialSet,
    };

    if (config().dataSource.mode === "kanidm") {
      const { loadedState } = await mutateKanidm("Updating Kanidm Unix account.", () =>
        new KanidmDataSource(
          config().dataSource,
          sessionStorage.getItem(bearerTokenKey) ?? undefined,
        ).extendUnixAccount(kanidmPersonId(personId), {
          gidNumber: nextUnix.gidNumber,
          shell: nextUnix.shell,
        }),
      );
      return loadedState.people.find((candidate) => candidate.id === personId)?.unix ?? nextUnix;
    }

    setState((previous) => updateUnixAccount(previous, personId, nextUnix));
    return nextUnix;
  };

  const setPersonUnixCredential = async (personId: string, password: string) => {
    if (!password.trim()) throw new Error("Unix credential password is required.");
    const person = personForId(personId);
    if (!person) throw new Error("Person was not found.");

    if (config().dataSource.mode === "kanidm") {
      const { loadedState } = await mutateKanidm("Setting Kanidm Unix credential.", () =>
        new KanidmDataSource(
          config().dataSource,
          sessionStorage.getItem(bearerTokenKey) ?? undefined,
        ).setUnixCredential(kanidmPersonId(personId), password),
      );
      return loadedState.people.find((candidate) => candidate.id === personId)?.unix ?? person.unix;
    }

    const nextUnix = { ...person.unix, credentialSet: true };
    setState((previous) => updateUnixAccount(previous, personId, nextUnix));
    return nextUnix;
  };

  const deletePersonUnixCredential = async (personId: string) => {
    const person = personForId(personId);
    if (!person) throw new Error("Person was not found.");

    if (config().dataSource.mode === "kanidm") {
      const { loadedState } = await mutateKanidm("Deleting Kanidm Unix credential.", () =>
        new KanidmDataSource(
          config().dataSource,
          sessionStorage.getItem(bearerTokenKey) ?? undefined,
        ).deleteUnixCredential(kanidmPersonId(personId)),
      );
      return loadedState.people.find((candidate) => candidate.id === personId)?.unix ?? person.unix;
    }

    const nextUnix = { ...person.unix, credentialSet: false };
    setState((previous) => updateUnixAccount(previous, personId, nextUnix));
    return nextUnix;
  };

  const exchangeCredentialUpdateIntent = async (intentToken: string) => {
    const trimmed = intentToken.trim();
    if (!trimmed) throw new Error("Reset token is required.");

    if (config().dataSource.mode === "kanidm") {
      const dataSource = new KanidmDataSource(
        config().dataSource,
        sessionStorage.getItem(bearerTokenKey) ?? undefined,
      );
      const sessionToken = await dataSource.exchangeCredentialUpdateIntent(trimmed);
      return dataSource.credentialUpdateStatus(sessionToken);
    }

    return mockCredentialUpdateStatus(`cu_demo_${trimmed.slice(-12)}`, currentUser());
  };

  const beginCredentialUpdate = async (personId: string) => {
    const person = state().people.find((candidate) => candidate.id === personId);
    if (!person) throw new Error("Person was not found.");

    if (config().dataSource.mode === "kanidm") {
      return new KanidmDataSource(
        config().dataSource,
        sessionStorage.getItem(bearerTokenKey) ?? undefined,
      ).beginCredentialUpdate(kanidmPersonId(personId));
    }

    return mockCredentialUpdateStatus(`cu_demo_self_${person.username}`, person);
  };

  // Shared factory: avoids repeating KanidmDataSource construction ~16 times
  const ds = () =>
    new KanidmDataSource(config().dataSource, sessionStorage.getItem(bearerTokenKey) ?? undefined);

  const updateCredentialPassword = async (sessionToken: string, password: string) => {
    const trimmed = password.trim();
    if (!trimmed) throw new Error("New password is required.");

    if (config().dataSource.mode === "kanidm") {
      return ds().credentialUpdate(sessionToken, [{ password: password }, { token: sessionToken }]);
    }

    return {
      ...mockCredentialUpdateStatus(sessionToken, currentUser()),
      canCommit: true,
      hasPrimaryCredential: true,
    };
  };

  const generateCredentialBackupCodes = async (sessionToken: string) => {
    if (config().dataSource.mode === "kanidm") {
      return ds().credentialUpdate(sessionToken, ["backupcodegenerate", { token: sessionToken }]);
    }

    return {
      ...mockCredentialUpdateStatus(sessionToken, currentUser()),
      canCommit: true,
      pendingBackupCodes: Array.from(
        { length: 10 },
        (_, index) => `backup-${index + 1}-${Math.random().toString(36).slice(2, 6)}`,
      ),
    };
  };

  const removeCredentialBackupCodes = async (sessionToken: string) => {
    if (config().dataSource.mode === "kanidm") {
      return ds().credentialUpdate(sessionToken, ["backupcoderemove", { token: sessionToken }]);
    }

    return {
      ...mockCredentialUpdateStatus(sessionToken, currentUser()),
      canCommit: true,
      pendingBackupCodes: [],
    };
  };

  const startCredentialTotp = async (sessionToken: string) => {
    if (config().dataSource.mode === "kanidm") {
      return ds().credentialUpdate(sessionToken, ["totpgenerate", { token: sessionToken }]);
    }

    return {
      ...mockCredentialUpdateStatus(sessionToken, currentUser()),
      pendingTotp: mockPendingTotp(currentUser()),
    };
  };

  const verifyCredentialTotp = async (sessionToken: string, code: string, label: string) => {
    const trimmedLabel = label.trim();
    const numericCode = Number.parseInt(code.trim(), 10);
    if (!trimmedLabel) throw new Error("TOTP label is required.");
    if (!Number.isFinite(numericCode)) throw new Error("TOTP code must be numeric.");

    if (config().dataSource.mode === "kanidm") {
      return ds().credentialUpdate(sessionToken, [
        { totpverify: [numericCode, trimmedLabel] },
        { token: sessionToken },
      ]);
    }

    if (code.trim() !== "123456") {
      return {
        ...mockCredentialUpdateStatus(sessionToken, currentUser()),
        pendingTotp: mockPendingTotp(currentUser()),
        totpIssue: "try-again" as const,
      };
    }

    return {
      ...mockCredentialUpdateStatus(sessionToken, currentUser()),
      canCommit: true,
      totpLabels: uniqueLabels([
        ...(currentUser().credential.totp ? ["Authenticator"] : []),
        trimmedLabel,
      ]),
    };
  };

  const acceptCredentialTotpSha1 = async (sessionToken: string) => {
    if (config().dataSource.mode === "kanidm") {
      return ds().credentialUpdate(sessionToken, ["totpacceptsha1", { token: sessionToken }]);
    }

    return {
      ...mockCredentialUpdateStatus(sessionToken, currentUser()),
      canCommit: true,
    };
  };

  const removeCredentialTotp = async (sessionToken: string, label: string) => {
    const trimmedLabel = label.trim();
    if (!trimmedLabel) throw new Error("TOTP label is required.");

    if (config().dataSource.mode === "kanidm") {
      return ds().credentialUpdate(sessionToken, [
        { totpremove: trimmedLabel },
        { token: sessionToken },
      ]);
    }

    return {
      ...mockCredentialUpdateStatus(sessionToken, currentUser()),
      canCommit: true,
      totpLabels: mockCredentialUpdateStatus(sessionToken, currentUser()).totpLabels.filter(
        (item) => item !== trimmedLabel,
      ),
    };
  };

  const cancelCredentialMfaRegistration = async (sessionToken: string) => {
    if (config().dataSource.mode === "kanidm") {
      return ds().credentialUpdate(sessionToken, ["cancelmfareg", { token: sessionToken }]);
    }

    return mockCredentialUpdateStatus(sessionToken, currentUser());
  };

  const updateCredentialUnixPassword = async (sessionToken: string, password: string) => {
    if (!password.trim()) throw new Error("Unix credential password is required.");

    if (config().dataSource.mode === "kanidm") {
      return ds().credentialUpdate(sessionToken, [
        { unixpassword: { value: password } },
        { token: sessionToken },
      ]);
    }

    return {
      ...mockCredentialUpdateStatus(sessionToken, currentUser()),
      canCommit: true,
      hasUnixCredential: true,
    };
  };

  const removeCredentialUnixPassword = async (sessionToken: string) => {
    if (config().dataSource.mode === "kanidm") {
      return ds().credentialUpdate(sessionToken, ["removeunixpassword", { token: sessionToken }]);
    }

    return {
      ...mockCredentialUpdateStatus(sessionToken, currentUser()),
      canCommit: true,
      hasUnixCredential: false,
    };
  };

  const removeCredentialSshPublicKey = async (sessionToken: string, label: string) => {
    const trimmedLabel = label.trim();
    if (!trimmedLabel) throw new Error("SSH public key label is required.");

    if (config().dataSource.mode === "kanidm") {
      return ds().credentialUpdate(sessionToken, [
        { sshpublickeyremove: trimmedLabel },
        { token: sessionToken },
      ]);
    }

    const currentStatus = mockCredentialUpdateStatus(sessionToken, currentUser());
    return {
      ...currentStatus,
      canCommit: true,
      sshKeyLabels: currentStatus.sshKeyLabels.filter((item) => item !== trimmedLabel),
      sshKeyCount: Math.max(0, currentStatus.sshKeyCount - 1),
    };
  };

  const addCredentialSshPublicKey = async (
    sessionToken: string,
    label: string,
    publicKey: string,
  ) => {
    const trimmedLabel = label.trim();
    const trimmedPublicKey = publicKey.trim();
    if (!trimmedLabel) throw new Error("SSH public key label is required.");
    if (!trimmedPublicKey) throw new Error("SSH public key is required.");

    if (config().dataSource.mode === "kanidm") {
      return ds().credentialUpdate(sessionToken, [
        { sshpublickey: [trimmedLabel, trimmedPublicKey] },
        { token: sessionToken },
      ]);
    }

    const currentStatus = mockCredentialUpdateStatus(sessionToken, currentUser());
    const sshKeyLabels = uniqueLabels([...currentStatus.sshKeyLabels, trimmedLabel]);
    return {
      ...currentStatus,
      canCommit: true,
      sshKeyLabels,
      sshKeyCount: sshKeyLabels.length,
    };
  };

  const startCredentialPasskey = async (
    sessionToken: string,
    kind: PasskeyRegistration["kind"],
  ) => {
    if (config().dataSource.mode === "kanidm") {
      return ds().credentialUpdate(sessionToken, [
        kind === "attested-passkey" ? "attestedpasskeyinit" : "passkeyinit",
        { token: sessionToken },
      ]);
    }

    return {
      ...mockCredentialUpdateStatus(sessionToken, currentUser()),
      pendingPasskey: mockPendingPasskey(kind),
    };
  };

  const finishCredentialPasskey = async (
    sessionToken: string,
    label: string,
    registration: unknown,
    kind: PasskeyRegistration["kind"],
  ) => {
    const trimmedLabel = label.trim();
    if (!trimmedLabel) throw new Error("Passkey label is required.");

    if (config().dataSource.mode === "kanidm") {
      return ds().credentialUpdate(sessionToken, [
        {
          [kind === "attested-passkey" ? "attestedpasskeyfinish" : "passkeyfinish"]: [
            trimmedLabel,
            registration,
          ],
        },
        { token: sessionToken },
      ]);
    }

    const currentStatus = mockCredentialUpdateStatus(sessionToken, currentUser());
    if (kind === "attested-passkey") {
      const attestedPasskeys = uniquePasskeys([
        ...currentStatus.attestedPasskeys,
        {
          uuid: `00000000-0000-4000-9000-${Math.random().toString().slice(2, 14).padEnd(12, "0")}`,
          tag: trimmedLabel,
        },
      ]);
      return {
        ...currentStatus,
        canCommit: true,
        pendingPasskey: null,
        attestedPasskeys,
        attestedPasskeyCount: attestedPasskeys.length,
      };
    }

    const passkeys = uniquePasskeys([
      ...currentStatus.passkeys,
      {
        uuid: `00000000-0000-4000-9000-${Math.random().toString().slice(2, 14).padEnd(12, "0")}`,
        tag: trimmedLabel,
      },
    ]);
    return {
      ...currentStatus,
      canCommit: true,
      pendingPasskey: null,
      passkeys,
      passkeyCount: passkeys.length,
    };
  };

  const removeCredentialPasskey = async (sessionToken: string, uuid: string) => {
    const trimmedUuid = uuid.trim();
    if (!trimmedUuid) throw new Error("Passkey is required.");

    if (config().dataSource.mode === "kanidm") {
      return ds().credentialUpdate(sessionToken, [
        { passkeyremove: trimmedUuid },
        { token: sessionToken },
      ]);
    }

    const currentStatus = mockCredentialUpdateStatus(sessionToken, currentUser());
    const passkeys = currentStatus.passkeys.filter((item) => item.uuid !== trimmedUuid);
    return {
      ...currentStatus,
      canCommit: true,
      passkeys,
      passkeyCount: passkeys.length,
    };
  };

  const removeCredentialAttestedPasskey = async (sessionToken: string, uuid: string) => {
    const trimmedUuid = uuid.trim();
    if (!trimmedUuid) throw new Error("Attested passkey is required.");

    if (config().dataSource.mode === "kanidm") {
      return ds().credentialUpdate(sessionToken, [
        { attestedpasskeyremove: trimmedUuid },
        { token: sessionToken },
      ]);
    }

    const currentStatus = mockCredentialUpdateStatus(sessionToken, currentUser());
    const attestedPasskeys = currentStatus.attestedPasskeys.filter(
      (item) => item.uuid !== trimmedUuid,
    );
    return {
      ...currentStatus,
      canCommit: true,
      attestedPasskeys,
      attestedPasskeyCount: attestedPasskeys.length,
    };
  };

  const commitCredentialUpdate = async (sessionToken: string) => {
    if (config().dataSource.mode === "kanidm") {
      await ds().commitCredentialUpdate(sessionToken);
    }
  };

  const cancelCredentialUpdate = async (sessionToken: string) => {
    if (config().dataSource.mode === "kanidm") {
      await ds().cancelCredentialUpdate(sessionToken);
    }
  };

  async function mutateKanidm<T>(
    message: string,
    operation: (config: Configuration) => Promise<T>,
  ) {
    const loadedConfig = config();
    const token = sessionStorage.getItem(bearerTokenKey);
    if (!token) {
      throw new Error("Kanidm write requires an authenticated bearer token.");
    }

    setApiStatus({
      mode: "kanidm",
      state: "loading",
      message,
    });

    try {
      const opConfig = new Configuration({
        basePath: loadedConfig.dataSource.apiBasePath.replace(/\/$/, ""),
        credentials: "include",
        headers: { Accept: "application/json" },
        accessToken: () => token ?? undefined,
      });
      const result = await operation(opConfig);
      const loadedState = applyDashboardBrandingFallback(
        await new KanidmDataSource(loadedConfig.dataSource, token).load(),
        loadedConfig,
      );
      setState(loadedState);
      setApiStatus({
        mode: "kanidm",
        state: "ready",
        message: "Kanidm write completed.",
      });
      return { result, loadedState };
    } catch (error) {
      if (handleKanidmAuthFailure(error, token)) {
        throw error;
      }

      setApiStatus({
        mode: "kanidm",
        state: "error",
        message: error instanceof Error ? error.message : "Kanidm write failed.",
      });
      throw error;
    }
  }

  const addPerson = async (input: NewPersonInput) => {
    if (config().dataSource.mode === "kanidm") {
      const username = input.username.trim();
      const memberships = groupIdsToNames(input.groups, state().groups);
      if (input.credentialMode === "temporary-password") {
        throw new Error(
          "Kanidm does not support dashboard-created temporary passwords. Choose a credential update link or recovery email.",
        );
      }
      const kanidmInput = { ...input, groups: memberships };
      const { result, loadedState } = await mutateKanidm("Creating Kanidm person.", () =>
        new KanidmDataSource(
          config().dataSource,
          sessionStorage.getItem(bearerTokenKey) ?? undefined,
        ).createPerson(kanidmInput),
      );
      const created = loadedState.people.find((person) => person.username === username);
      if (!created)
        throw new Error(`Kanidm created ${username}, but it was not visible after reload.`);
      return result;
    }

    const person: Person = {
      id: nextId("u", input.username),
      username: input.username.trim(),
      displayName: input.displayName.trim(),
      legalName: input.legalName.trim() || input.displayName.trim(),
      email: input.email.trim(),
      status: input.status,
      groups: input.groups,
      credential: {
        password: input.credentialMode === "temporary-password" ? "needs-update" : "missing",
        passkeys: 0,
        totp: false,
        backupCodes: 0,
        unixCredential: false,
        sshKeys: 0,
        radiusPassword: false,
      },
      unix: {
        gidNumber: null,
        shell: "",
        credentialSet: false,
      },
      lastAuth: "Unknown",
    };

    setState((previous) => ({
      ...previous,
      people: [...previous.people, person],
      groups: previous.groups.map((group) =>
        input.groups.includes(group.id)
          ? { ...group, members: [...new Set([...group.members, person.id])] }
          : group,
      ),
    }));

    if (input.credentialMode === "enrolment-link") {
      return {
        person,
        credentialIntent: {
          token: `kc_demo_${person.username}_${Math.random().toString(36).slice(2, 10)}`,
          expiryTime: new Date(Date.now() + 3600 * 1000).toISOString(),
        },
      };
    }

    if (input.credentialMode === "recovery-only") {
      return {
        person,
        credentialEmailSent: true,
        credentialNotice: "Mock recovery email marked as sent.",
      };
    }

    return {
      person,
      credentialNotice: "Mock temporary password state was staged.",
    };
  };

  const addGroup = async (input: NewGroupInput) => {
    if (config().dataSource.mode === "kanidm") {
      const groupName = input.name.trim();
      const memberNames = personIdsToUsernames(input.members, state().people);
      const parentGroupNames = groupIdsToNames(input.parentGroups, state().groups);
      const managedByName =
        state().groups.find((group) => group.id === input.managedBy)?.name ?? "";
      const { result, loadedState } = await mutateKanidm("Creating Kanidm group.", async () => {
        const ds = new KanidmDataSource(
          config().dataSource,
          sessionStorage.getItem(bearerTokenKey) ?? undefined,
        );
        const createResult = await ds.createGroup({
          ...input,
          managedBy: managedByName,
        });
        if (memberNames.length) await ds.addGroupMembers(groupName, memberNames);
        await Promise.all(
          parentGroupNames.map((parentGroupName) =>
            ds.addGroupMembers(parentGroupName, [groupName]),
          ),
        );
        return createResult;
      });
      const created = loadedState.groups.find((group) => group.name === groupName);
      if (!created)
        throw new Error(`Kanidm created ${groupName}, but it was not visible after reload.`);
      return { group: created, metadataWarnings: result.metadataWarnings };
    }

    const group: Group = {
      id: nextId("g", input.name),
      name: input.name.trim(),
      displayName: input.displayName.trim(),
      description: input.description.trim(),
      members: input.members,
      parentGroups: input.parentGroups,
      managedBy: input.managedBy,
    };

    setState((previous) => ({
      ...previous,
      groups: [...previous.groups, group],
      people: previous.people.map((person) =>
        input.members.includes(person.id)
          ? { ...person, groups: [...new Set([...person.groups, group.id])] }
          : person,
      ),
    }));

    return { group, metadataWarnings: [] };
  };

  const deleteGroup = async (groupId: string, groupName: string) => {
    if (config().dataSource.mode === "kanidm") {
      await mutateKanidm("Deleting Kanidm group.", () =>
        new KanidmDataSource(
          config().dataSource,
          sessionStorage.getItem(bearerTokenKey) ?? undefined,
        ).deleteGroup(groupName),
      );
      return;
    }
    setState((previous) => ({
      ...previous,
      groups: previous.groups.filter((g) => g.id !== groupId),
    }));
  };

  const updateGroup = async (
    groupId: string,
    groupName: string,
    patch: Partial<Pick<Group, "displayName" | "description" | "managedBy">>,
  ) => {
    if (config().dataSource.mode === "kanidm") {
      await mutateKanidm("Updating Kanidm group.", () =>
        new KanidmDataSource(
          config().dataSource,
          sessionStorage.getItem(bearerTokenKey) ?? undefined,
        ).updateGroup(groupName, patch),
      );
      return;
    }
    setState((previous) => ({
      ...previous,
      groups: previous.groups.map((g) => (g.id === groupId ? { ...g, ...patch } : g)),
    }));
  };

  const addGroupMembers = async (name: string, members: string[]) => {
    if (config().dataSource.mode === "kanidm") {
      await mutateKanidm("Adding Kanidm group members.", () =>
        new KanidmDataSource(
          config().dataSource,
          sessionStorage.getItem(bearerTokenKey) ?? undefined,
        ).addGroupMembers(name, members),
      );
      return;
    }
    setState((previous) => {
      const group = previous.groups.find((g) => g.name === name);
      if (!group) return previous;
      return {
        ...previous,
        groups: previous.groups.map((g) =>
          g.name === name ? { ...g, members: [...new Set([...g.members, ...members])] } : g,
        ),
        people: previous.people.map((p) =>
          members.includes(p.id) ? { ...p, groups: [...new Set([...p.groups, group.id])] } : p,
        ),
      };
    });
  };

  const removeGroupMembers = async (name: string, members: string[]) => {
    if (config().dataSource.mode === "kanidm") {
      await mutateKanidm("Removing Kanidm group members.", () =>
        new KanidmDataSource(
          config().dataSource,
          sessionStorage.getItem(bearerTokenKey) ?? undefined,
        ).removeGroupMembers(name, members),
      );
      return;
    }
    setState((previous) => {
      const group = previous.groups.find((g) => g.name === name);
      if (!group) return previous;
      return {
        ...previous,
        groups: previous.groups.map((g) =>
          g.name === name ? { ...g, members: g.members.filter((m) => !members.includes(m)) } : g,
        ),
        people: previous.people.map((p) =>
          members.includes(p.id) ? { ...p, groups: p.groups.filter((gid) => gid !== group.id) } : p,
        ),
      };
    });
  };

  const groupNameForId = (groupId: string) => {
    const group = state().groups.find((candidate) => candidate.id === groupId);
    if (!group) throw new Error("Group not found.");
    return group.name;
  };

  const groupUnixSettings = async (groupId: string) => {
    const id = groupNameForId(groupId);
    if (config().dataSource.mode === "kanidm") {
      return readKanidm("Reading Kanidm group Unix settings.", () =>
        new KanidmDataSource(
          config().dataSource,
          sessionStorage.getItem(bearerTokenKey) ?? undefined,
        ).groupUnixSettings(id),
      );
    }
    return ds().groupUnixSettings(groupId);
  };

  const extendGroupUnix = async (groupId: string, gidNumber: number) => {
    const id = groupNameForId(groupId);
    if (config().dataSource.mode === "kanidm") {
      const { result } = await mutateKanidm("Extending Kanidm group Unix settings.", () =>
        new KanidmDataSource(
          config().dataSource,
          sessionStorage.getItem(bearerTokenKey) ?? undefined,
        ).extendGroupUnix(id, gidNumber),
      );
      return result;
    }
    return ds().extendGroupUnix(groupId, gidNumber);
  };

  const groupPolicy = async (groupId: string) => {
    const id = groupNameForId(groupId);
    if (config().dataSource.mode === "kanidm") {
      return readKanidm("Reading Kanidm group account policy.", () =>
        new KanidmDataSource(
          config().dataSource,
          sessionStorage.getItem(bearerTokenKey) ?? undefined,
        ).groupPolicy(id),
      );
    }
    return ds().groupPolicy(groupId);
  };

  const updateGroupPolicyAttribute = async (groupId: string, attr: string, values: string[]) => {
    const id = groupNameForId(groupId);
    if (config().dataSource.mode === "kanidm") {
      await mutateKanidm("Updating Kanidm group account policy.", () =>
        new KanidmDataSource(
          config().dataSource,
          sessionStorage.getItem(bearerTokenKey) ?? undefined,
        ).updateGroupPolicyAttribute(id, attr, values),
      );
      return;
    }
    await ds().updateGroupPolicyAttribute(groupId, attr, values);
  };

  const schemaCatalog = () =>
    config().dataSource.mode === "kanidm"
      ? readKanidm("Reading Kanidm schema.", () =>
          new KanidmDataSource(
            config().dataSource,
            sessionStorage.getItem(bearerTokenKey) ?? undefined,
          ).schemaCatalog(),
        )
      : ds().schemaCatalog();

  const recycleBinEntries = () =>
    config().dataSource.mode === "kanidm"
      ? readKanidm("Reading Kanidm recycle bin.", () =>
          new KanidmDataSource(
            config().dataSource,
            sessionStorage.getItem(bearerTokenKey) ?? undefined,
          ).recycleBinEntries(),
        )
      : ds().recycleBinEntries();

  const recycleBinEntry = (id: string) =>
    config().dataSource.mode === "kanidm"
      ? readKanidm("Reading Kanidm recycle bin entry.", () =>
          new KanidmDataSource(
            config().dataSource,
            sessionStorage.getItem(bearerTokenKey) ?? undefined,
          ).recycleBinEntry(id),
        )
      : ds().recycleBinEntry(id);

  const reviveRecycleBinEntry = async (id: string) => {
    if (config().dataSource.mode === "kanidm") {
      await mutateKanidm("Reviving Kanidm recycle bin entry.", () =>
        new KanidmDataSource(
          config().dataSource,
          sessionStorage.getItem(bearerTokenKey) ?? undefined,
        ).reviveRecycleBinEntry(id),
      );
      return;
    }
    await ds().reviveRecycleBinEntry(id);
  };

  const systemConfig = () =>
    config().dataSource.mode === "kanidm"
      ? readKanidm("Reading Kanidm system config.", () =>
          new KanidmDataSource(
            config().dataSource,
            sessionStorage.getItem(bearerTokenKey) ?? undefined,
          ).systemConfig(),
        )
      : ds().systemConfig();

  const updateSystemAttribute = async (attr: string, values: string[]) => {
    if (config().dataSource.mode === "kanidm") {
      await mutateKanidm("Updating Kanidm system config.", () =>
        new KanidmDataSource(
          config().dataSource,
          sessionStorage.getItem(bearerTokenKey) ?? undefined,
        ).updateSystemAttribute(attr, values),
      );
      return;
    }
    await ds().updateSystemAttribute(attr, values);
  };

  const addServiceAccount = async (input: NewServiceAccountInput) => {
    const serviceAccountName = input.name.trim();
    if (config().dataSource.mode === "kanidm") {
      const groupNames = groupIdsToNames(input.groups, state().groups);
      const managedByName =
        state().groups.find((group) => group.id === input.managedBy)?.name ?? input.managedBy;
      const { loadedState } = await mutateKanidm("Creating Kanidm service account.", () =>
        new KanidmDataSource(
          config().dataSource,
          sessionStorage.getItem(bearerTokenKey) ?? undefined,
        ).createServiceAccount({
          ...input,
          managedBy: managedByName,
          groups: groupNames,
        }),
      );
      const created = loadedState.serviceAccounts.find(
        (serviceAccount) => serviceAccount.name === serviceAccountName,
      );
      if (!created) {
        throw new Error(
          `Kanidm created ${serviceAccountName}, but it was not visible after reload.`,
        );
      }
      return created;
    }

    const serviceAccount: ServiceAccount = {
      id: nextId("svc", input.name),
      name: input.name.trim(),
      displayName: input.displayName.trim(),
      description: input.description.trim(),
      managedBy: input.managedBy,
      groups: input.groups,
      credential: {
        password: "unknown",
        apiTokens: 0,
        sshKeys: 0,
        unixCredential: false,
      },
      unix: { gidNumber: null, shell: "", credentialSet: false },
      status: input.groups.length ? "ready" : "attention",
    };

    setState((previous) => ({
      ...previous,
      serviceAccounts: [...previous.serviceAccounts, serviceAccount],
      groups: previous.groups.map((group) =>
        input.groups.includes(group.id)
          ? { ...group, members: [...new Set([...group.members, serviceAccount.id])] }
          : group,
      ),
    }));

    return serviceAccount;
  };

  const updateServiceAccount = async (serviceAccountId: string, patch: ServiceAccountPatch) => {
    const serviceAccount = serviceAccountForId(serviceAccountId);
    if (!serviceAccount) throw new Error("Service account not found.");

    if (config().dataSource.mode === "kanidm") {
      const managedByName =
        patch.managedBy !== undefined
          ? (state().groups.find((group) => group.id === patch.managedBy)?.name ?? patch.managedBy)
          : undefined;
      await mutateKanidm("Updating Kanidm service account.", () =>
        new KanidmDataSource(
          config().dataSource,
          sessionStorage.getItem(bearerTokenKey) ?? undefined,
        ).updateServiceAccount(kanidmServiceAccountId(serviceAccountId), {
          ...patch,
          managedBy: managedByName,
        }),
      );
      return;
    }

    setState((previous) => ({
      ...previous,
      serviceAccounts: previous.serviceAccounts.map((candidate) =>
        candidate.id === serviceAccount.id
          ? {
              ...candidate,
              ...(patch.displayName !== undefined ? { displayName: patch.displayName.trim() } : {}),
              ...(patch.description !== undefined ? { description: patch.description.trim() } : {}),
              ...(patch.managedBy !== undefined ? { managedBy: patch.managedBy } : {}),
            }
          : candidate,
      ),
    }));
  };

  const deleteServiceAccount = async (serviceAccountId: string) => {
    const serviceAccount = serviceAccountForId(serviceAccountId);
    if (!serviceAccount) throw new Error("Service account not found.");

    if (config().dataSource.mode === "kanidm") {
      await mutateKanidm("Deleting Kanidm service account.", () =>
        new KanidmDataSource(
          config().dataSource,
          sessionStorage.getItem(bearerTokenKey) ?? undefined,
        ).deleteServiceAccount(serviceAccount.name),
      );
      return;
    }

    setMockServiceAccountApiTokens((previous) => {
      const next = { ...previous };
      delete next[serviceAccount.id];
      return next;
    });
    setMockServiceAccountSshPublicKeys((previous) => {
      const next = { ...previous };
      delete next[serviceAccount.id];
      return next;
    });
    setState((previous) => ({
      ...previous,
      serviceAccounts: previous.serviceAccounts.filter(
        (candidate) => candidate.id !== serviceAccount.id,
      ),
      groups: previous.groups.map((group) => ({
        ...group,
        members: group.members.filter((memberId) => memberId !== serviceAccount.id),
      })),
    }));
  };

  const toggleServiceAccountGroup = async (serviceAccountId: string, groupId: string) => {
    const current = state();
    const serviceAccount = current.serviceAccounts.find(
      (candidate) => candidate.id === serviceAccountId,
    );
    const group = current.groups.find((candidate) => candidate.id === groupId);
    if (!serviceAccount || !group) return;

    const isMember = serviceAccount.groups.includes(groupId);
    if (config().dataSource.mode === "kanidm") {
      const ds = new KanidmDataSource(
        config().dataSource,
        sessionStorage.getItem(bearerTokenKey) ?? undefined,
      );
      await mutateKanidm(
        isMember
          ? "Removing Kanidm service account group."
          : "Adding Kanidm service account group.",
        () =>
          isMember
            ? ds.removeGroupMembers(group.name, [serviceAccount.name])
            : ds.addGroupMembers(group.name, [serviceAccount.name]),
      );
      return;
    }

    setState((previous) => ({
      ...previous,
      serviceAccounts: previous.serviceAccounts.map((candidate) =>
        candidate.id === serviceAccountId
          ? {
              ...candidate,
              groups: isMember
                ? candidate.groups.filter((candidateGroupId) => candidateGroupId !== groupId)
                : [...candidate.groups, groupId],
              status: !isMember || candidate.credential.apiTokens > 0 ? "ready" : candidate.status,
            }
          : candidate,
      ),
      groups: previous.groups.map((candidate) =>
        candidate.id === groupId
          ? {
              ...candidate,
              members: isMember
                ? candidate.members.filter((memberId) => memberId !== serviceAccountId)
                : [...candidate.members, serviceAccountId],
            }
          : candidate,
      ),
    }));
  };

  const getServiceAccountApiTokens = async (serviceAccountId: string) => {
    if (config().dataSource.mode === "kanidm") {
      return readKanidm(
        "Reading Kanidm service account API tokens.",
        () =>
          new KanidmDataSource(
            config().dataSource,
            sessionStorage.getItem(bearerTokenKey) ?? undefined,
          ).serviceAccountApiTokens(kanidmServiceAccountId(serviceAccountId)),
        { reportError: false },
      );
    }

    return mockServiceAccountApiTokens()[serviceAccountId] ?? [];
  };

  const generateServiceAccountApiToken = async (
    serviceAccountId: string,
    input: ServiceAccountApiTokenInput,
  ) => {
    const trimmedLabel = input.label.trim();
    if (!trimmedLabel) throw new Error("API token label is required.");

    if (config().dataSource.mode === "kanidm") {
      const { result } = await mutateKanidm("Generating Kanidm service account API token.", () =>
        new KanidmDataSource(
          config().dataSource,
          sessionStorage.getItem(bearerTokenKey) ?? undefined,
        ).generateServiceAccountApiToken(kanidmServiceAccountId(serviceAccountId), {
          ...input,
          label: trimmedLabel,
        }),
      );
      return {
        token: result,
        tokens: await getServiceAccountApiTokens(serviceAccountId),
      };
    }

    const tokenRecord: ServiceAccountApiToken = {
      accountId: serviceAccountId,
      tokenId: `00000000-0000-4000-a000-${Math.random().toString().slice(2, 14).padEnd(12, "0")}`,
      label: trimmedLabel,
      issuedAt: new Date().toISOString(),
      expiry: input.expiry?.trim() || undefined,
      purpose: input.readWrite ? "readwrite" : "readonly",
    };
    const nextTokens = [...(mockServiceAccountApiTokens()[serviceAccountId] ?? []), tokenRecord];
    setMockServiceAccountApiTokens((previous) => ({
      ...previous,
      [serviceAccountId]: nextTokens,
    }));
    setState((previous) =>
      updateServiceAccountTokenCount(previous, serviceAccountId, nextTokens.length),
    );
    return {
      token: `svctok_${Math.random().toString(36).slice(2, 20)}`,
      tokens: nextTokens,
    };
  };

  const deleteServiceAccountApiToken = async (serviceAccountId: string, tokenId: string) => {
    if (config().dataSource.mode === "kanidm") {
      await mutateKanidm("Deleting Kanidm service account API token.", () =>
        new KanidmDataSource(
          config().dataSource,
          sessionStorage.getItem(bearerTokenKey) ?? undefined,
        ).deleteServiceAccountApiToken(kanidmServiceAccountId(serviceAccountId), tokenId),
      );
      return getServiceAccountApiTokens(serviceAccountId);
    }

    const nextTokens = (mockServiceAccountApiTokens()[serviceAccountId] ?? []).filter(
      (token) => token.tokenId !== tokenId,
    );
    setMockServiceAccountApiTokens((previous) => ({
      ...previous,
      [serviceAccountId]: nextTokens,
    }));
    setState((previous) =>
      updateServiceAccountTokenCount(previous, serviceAccountId, nextTokens.length),
    );
    return nextTokens;
  };

  const getServiceAccountCredentialStatus = async (serviceAccountId: string) => {
    if (config().dataSource.mode === "kanidm") {
      return readKanidm(
        "Reading Kanidm service account credential status.",
        () =>
          new KanidmDataSource(
            config().dataSource,
            sessionStorage.getItem(bearerTokenKey) ?? undefined,
          ).serviceAccountCredentialStatus(kanidmServiceAccountId(serviceAccountId)),
        { reportError: false },
      );
    }

    return { checkedAt: new Date().toISOString(), reachable: true };
  };

  const generateServiceAccountPassword = async (serviceAccountId: string) => {
    if (config().dataSource.mode === "kanidm") {
      const { result } = await mutateKanidm("Generating Kanidm service account credential.", () =>
        new KanidmDataSource(
          config().dataSource,
          sessionStorage.getItem(bearerTokenKey) ?? undefined,
        ).generateServiceAccountPassword(kanidmServiceAccountId(serviceAccountId)),
      );
      return result;
    }

    const generatedAt = new Date().toISOString();
    setState((previous) =>
      updateServiceAccountCredentialState(previous, serviceAccountId, "present"),
    );
    return { checkedAt: generatedAt, generatedAt, reachable: true };
  };

  const getServiceAccountSshPublicKeys = async (serviceAccountId: string) => {
    if (config().dataSource.mode === "kanidm") {
      return readKanidm(
        "Reading Kanidm service account SSH public keys.",
        () =>
          new KanidmDataSource(
            config().dataSource,
            sessionStorage.getItem(bearerTokenKey) ?? undefined,
          ).serviceAccountSshPublicKeys(kanidmServiceAccountId(serviceAccountId)),
        { reportError: false },
      );
    }

    return mockServiceAccountSshPublicKeys()[serviceAccountId] ?? [];
  };

  const addServiceAccountSshPublicKey = async (
    serviceAccountId: string,
    tag: string,
    key: string,
  ) => {
    const nextKey = { tag: tag.trim(), key: key.trim() };
    if (!nextKey.tag || !nextKey.key) {
      throw new Error("SSH key tag and public key are required.");
    }

    if (config().dataSource.mode === "kanidm") {
      await mutateKanidm("Adding Kanidm service account SSH key.", () =>
        new KanidmDataSource(
          config().dataSource,
          sessionStorage.getItem(bearerTokenKey) ?? undefined,
        ).addServiceAccountSshPublicKey(
          kanidmServiceAccountId(serviceAccountId),
          nextKey.tag,
          nextKey.key,
        ),
      );
      return getServiceAccountSshPublicKeys(serviceAccountId);
    }

    const nextKeys = [
      ...(mockServiceAccountSshPublicKeys()[serviceAccountId] ?? []).filter(
        (item) => item.tag !== nextKey.tag,
      ),
      nextKey,
    ];
    setMockServiceAccountSshPublicKeys((previous) => ({
      ...previous,
      [serviceAccountId]: nextKeys,
    }));
    setState((previous) =>
      updateServiceAccountSshKeyCount(previous, serviceAccountId, nextKeys.length),
    );
    return nextKeys;
  };

  const deleteServiceAccountSshPublicKey = async (serviceAccountId: string, tag: string) => {
    if (config().dataSource.mode === "kanidm") {
      await mutateKanidm("Deleting Kanidm service account SSH key.", () =>
        new KanidmDataSource(
          config().dataSource,
          sessionStorage.getItem(bearerTokenKey) ?? undefined,
        ).deleteServiceAccountSshPublicKey(kanidmServiceAccountId(serviceAccountId), tag),
      );
      return getServiceAccountSshPublicKeys(serviceAccountId);
    }

    const nextKeys = (mockServiceAccountSshPublicKeys()[serviceAccountId] ?? []).filter(
      (item) => item.tag !== tag,
    );
    setMockServiceAccountSshPublicKeys((previous) => ({
      ...previous,
      [serviceAccountId]: nextKeys,
    }));
    setState((previous) =>
      updateServiceAccountSshKeyCount(previous, serviceAccountId, nextKeys.length),
    );
    return nextKeys;
  };

  const extendServiceAccountUnixAccount = async (
    serviceAccountId: string,
    input: Pick<UnixAccountSettings, "gidNumber" | "shell">,
  ) => {
    const serviceAccount = serviceAccountForId(serviceAccountId);
    if (!serviceAccount) throw new Error("Service account not found.");
    const nextUnix: UnixAccountSettings = {
      gidNumber: input.gidNumber,
      shell: input.shell.trim(),
      credentialSet:
        serviceAccount.unix.credentialSet || input.gidNumber !== null || input.shell.trim() !== "",
    };

    if (config().dataSource.mode === "kanidm") {
      const { loadedState } = await mutateKanidm(
        "Updating Kanidm service account Unix settings.",
        () =>
          new KanidmDataSource(
            config().dataSource,
            sessionStorage.getItem(bearerTokenKey) ?? undefined,
          ).extendServiceAccountUnixAccount(kanidmServiceAccountId(serviceAccountId), {
            gidNumber: nextUnix.gidNumber,
            shell: nextUnix.shell,
          }),
      );
      return (
        loadedState.serviceAccounts.find((candidate) => candidate.id === serviceAccountId)?.unix ??
        nextUnix
      );
    }

    setState((previous) => updateServiceAccountUnixAccount(previous, serviceAccountId, nextUnix));
    return nextUnix;
  };

  const addApplication = async (input: NewApplicationInput): Promise<CreatedApplication> => {
    if (config().dataSource.mode === "kanidm") {
      const appName = input.name.trim();
      const groupNames = new Map(state().groups.map((group) => [group.id, group.name]));
      const kanidmInput = {
        ...input,
        allowedGroups: input.allowedGroups.map((groupId) => groupNames.get(groupId) ?? groupId),
        scopeMaps: input.scopeMaps?.map((scopeMap) => ({
          ...scopeMap,
          groupId: groupNames.get(scopeMap.groupId) ?? scopeMap.groupId,
        })),
      };
      const { result, loadedState } = await mutateKanidm(
        "Creating Kanidm OAuth2 application.",
        () =>
          new KanidmDataSource(
            config().dataSource,
            sessionStorage.getItem(bearerTokenKey) ?? undefined,
          ).createOAuth2Application(kanidmInput),
      );
      const created = loadedState.apps.find((app) => app.name === appName);
      if (!created)
        throw new Error(`Kanidm created ${appName}, but it was not visible after reload.`);
      return { ...created, clientSecret: result.clientSecret };
    }

    const app: Application = {
      id: nextId("app", input.name),
      name: input.name.trim(),
      displayName: input.displayName.trim(),
      landingUrl: input.landingUrl.trim(),
      imageUrl: input.imageUrl.trim(),
      clientType: input.clientType,
      redirectUris: input.redirectUris,
      allowedGroups: input.allowedGroups,
      scopes: input.scopes,
      scopeMaps: normalizedApplicationScopeMaps(input),
      supplementalScopeMaps: [],
      claimMaps: [],
      policyToggles: { ...defaultApplicationPolicyToggles },
      status: "draft",
    };

    setState((previous) => ({ ...previous, apps: [...previous.apps, app] }));
    return {
      ...app,
      clientSecret:
        input.clientType === "confidential"
          ? `mock-secret-${Math.random().toString(36).slice(2, 12)}`
          : undefined,
    };
  };

  const updateApplication = async (appId: string, patch: ApplicationPatch) => {
    const app = state().apps.find((candidate) => candidate.id === appId);
    if (!app) throw new Error("Application not found.");

    if (config().dataSource.mode === "kanidm") {
      await mutateKanidm("Updating Kanidm OAuth2 application.", () =>
        new KanidmDataSource(
          config().dataSource,
          sessionStorage.getItem(bearerTokenKey) ?? undefined,
        ).updateOAuth2Application(app.name, patch),
      );
      return;
    }

    setState((previous) => ({
      ...previous,
      apps: previous.apps.map((candidate) =>
        candidate.id === appId
          ? {
              ...candidate,
              ...(patch.displayName !== undefined ? { displayName: patch.displayName } : {}),
              ...(patch.landingUrl !== undefined ? { landingUrl: patch.landingUrl } : {}),
              ...(patch.redirectUris !== undefined ? { redirectUris: patch.redirectUris } : {}),
            }
          : candidate,
      ),
    }));
  };

  const updateApplicationPolicy = async (appId: string, input: ApplicationPolicyInput) => {
    const current = state();
    const app = current.apps.find((candidate) => candidate.id === appId);
    if (!app) throw new Error("Application not found.");

    if (config().dataSource.mode === "kanidm") {
      const groupNames = new Map(current.groups.map((group) => [group.id, group.name]));
      const kanidmInput: ApplicationPolicyInput = {
        scopeMaps: input.scopeMaps.map((scopeMap) => ({
          ...scopeMap,
          groupId: groupNames.get(scopeMap.groupId) ?? scopeMap.groupId,
        })),
        supplementalScopeMaps: input.supplementalScopeMaps.map((scopeMap) => ({
          ...scopeMap,
          groupId: groupNames.get(scopeMap.groupId) ?? scopeMap.groupId,
        })),
        claimMaps: input.claimMaps.map((claimMap) => ({
          ...claimMap,
          rules: claimMap.rules.map((rule) => ({
            ...rule,
            groupId: groupNames.get(rule.groupId) ?? rule.groupId,
          })),
        })),
        policyToggles: input.policyToggles,
      };
      await mutateKanidm("Updating Kanidm OAuth2 policy.", () =>
        new KanidmDataSource(
          config().dataSource,
          sessionStorage.getItem(bearerTokenKey) ?? undefined,
        ).updateOAuth2ApplicationPolicy(app.name, kanidmInput),
      );
      return;
    }

    setState((previous) => ({
      ...previous,
      apps: previous.apps.map((candidate) => {
        if (candidate.id !== appId) return candidate;
        const scopeMaps = normalizedPolicyScopeMaps(input.scopeMaps);
        const supplementalScopeMaps = normalizedPolicyScopeMaps(input.supplementalScopeMaps);
        const scopes = [
          ...new Set([
            ...scopeMaps.flatMap((scopeMap) => scopeMap.scopes),
            ...supplementalScopeMaps.flatMap((scopeMap) => scopeMap.scopes),
          ]),
        ];
        return {
          ...candidate,
          allowedGroups: [...new Set(scopeMaps.map((scopeMap) => scopeMap.groupId))],
          scopes: scopes.length ? scopes : ["openid", "profile"],
          scopeMaps,
          supplementalScopeMaps,
          claimMaps: input.claimMaps,
          policyToggles: input.policyToggles,
          status: scopeMaps.length ? "ready" : "attention",
        };
      }),
    }));
  };

  const updateApplicationKeyAction = async (appId: string, action: ApplicationKeyAction) => {
    const app = state().apps.find((candidate) => candidate.id === appId);
    if (!app) throw new Error("Application not found.");

    if (config().dataSource.mode === "kanidm") {
      await mutateKanidm("Updating Kanidm OAuth2 key state.", () =>
        new KanidmDataSource(
          config().dataSource,
          sessionStorage.getItem(bearerTokenKey) ?? undefined,
        ).updateOAuth2ApplicationKeyAction(app.name, action),
      );
      return;
    }

    return;
  };

  const getApplicationClientSecret = async (appId: string) => {
    const app = state().apps.find((candidate) => candidate.id === appId);
    if (!app) throw new Error("Application not found.");
    if (app.clientType !== "confidential") return null;

    if (config().dataSource.mode === "kanidm") {
      return readKanidm(
        "Reading Kanidm OAuth2 client secret.",
        () =>
          new KanidmDataSource(
            config().dataSource,
            sessionStorage.getItem(bearerTokenKey) ?? undefined,
          ).getOAuth2ApplicationClientSecret(app.name),
        { reportError: false },
      );
    }

    return `mock-secret-${app.name}`;
  };

  const deleteApplication = async (appId: string) => {
    const app = state().apps.find((candidate) => candidate.id === appId);
    if (!app) throw new Error("Application not found.");

    if (config().dataSource.mode === "kanidm") {
      await mutateKanidm("Deleting Kanidm OAuth2 application.", () =>
        new KanidmDataSource(
          config().dataSource,
          sessionStorage.getItem(bearerTokenKey) ?? undefined,
        ).deleteOAuth2Application(app.name),
      );
      return;
    }

    setState((previous) => ({
      ...previous,
      apps: previous.apps.filter((candidate) => candidate.id !== appId),
    }));
  };

  const toggleGroupMember = async (groupId: string, personId: string) => {
    if (config().dataSource.mode === "kanidm") {
      const current = state();
      const group = current.groups.find((candidate) => candidate.id === groupId);
      const person = current.people.find((candidate) => candidate.id === personId);
      if (!group || !person) return;

      const isMember = person.groups.includes(groupId);
      const ds = new KanidmDataSource(
        config().dataSource,
        sessionStorage.getItem(bearerTokenKey) ?? undefined,
      );
      await mutateKanidm(
        isMember ? "Removing Kanidm group member." : "Adding Kanidm group member.",
        () =>
          isMember
            ? ds.removeGroupMembers(group.name, [person.username])
            : ds.addGroupMembers(group.name, [person.username]),
      );
      return;
    }

    setState((previous) => {
      const group = previous.groups.find((candidate) => candidate.id === groupId);
      const person = previous.people.find((candidate) => candidate.id === personId);
      if (!group || !person) return previous;

      const isMember = group.members.includes(personId);
      return {
        ...previous,
        groups: previous.groups.map((candidate) =>
          candidate.id === groupId
            ? {
                ...candidate,
                members: isMember
                  ? candidate.members.filter((memberId) => memberId !== personId)
                  : [...candidate.members, personId],
              }
            : candidate,
        ),
        people: previous.people.map((candidate) =>
          candidate.id === personId
            ? {
                ...candidate,
                groups: isMember
                  ? candidate.groups.filter((candidateGroupId) => candidateGroupId !== groupId)
                  : [...candidate.groups, groupId],
              }
            : candidate,
        ),
      };
    });
  };

  const uploadDomainImage = async (file: File) => {
    if (config().dataSource.mode === "kanidm") {
      if (!branding().canManageNativeDomainBranding) {
        throw new Error(
          "Current Kanidm session cannot manage native domain branding. Use a domain administrator account or static dashboard config.",
        );
      }
      await mutateKanidm("Uploading Kanidm domain image.", () =>
        new KanidmDataSource(
          config().dataSource,
          sessionStorage.getItem(bearerTokenKey) ?? undefined,
        ).uploadDomainImage(file),
      );
      return;
    }

    const imageUrl = await readFileAsDataUrl(file);
    setState((previous) => ({
      ...previous,
      branding: { ...previous.branding, logoUrl: imageUrl },
    }));
  };

  const resetDomainImage = async () => {
    if (config().dataSource.mode === "kanidm") {
      if (!branding().canManageNativeDomainBranding) {
        throw new Error(
          "Current Kanidm session cannot manage native domain branding. Use a domain administrator account or static dashboard config.",
        );
      }
      await mutateKanidm("Resetting Kanidm domain image.", () =>
        new KanidmDataSource(
          config().dataSource,
          sessionStorage.getItem(bearerTokenKey) ?? undefined,
        ).deleteDomainImage(),
      );
      return;
    }

    setState((previous) => ({
      ...previous,
      branding: { ...previous.branding, logoUrl: config().logoUrl },
    }));
  };

  const uploadAppImage = async (appId: string, file: File) => {
    if (config().dataSource.mode === "kanidm") {
      const app = state().apps.find((candidate) => candidate.id === appId);
      if (!app) throw new Error("Application not found.");
      await mutateKanidm("Uploading Kanidm OAuth2 application image.", () =>
        new KanidmDataSource(
          config().dataSource,
          sessionStorage.getItem(bearerTokenKey) ?? undefined,
        ).uploadOAuth2ApplicationImage(app.name, file),
      );
      return;
    }

    const imageUrl = await readFileAsDataUrl(file);
    setState((previous) => ({
      ...previous,
      apps: previous.apps.map((app) => (app.id === appId ? { ...app, imageUrl } : app)),
    }));
  };

  const resetAppImage = async (appId: string) => {
    if (config().dataSource.mode === "kanidm") {
      const app = state().apps.find((candidate) => candidate.id === appId);
      if (!app) throw new Error("Application not found.");
      await mutateKanidm("Resetting Kanidm OAuth2 application image.", () =>
        new KanidmDataSource(
          config().dataSource,
          sessionStorage.getItem(bearerTokenKey) ?? undefined,
        ).deleteOAuth2ApplicationImage(app.name),
      );
      return;
    }

    setState((previous) => ({
      ...previous,
      apps: previous.apps.map((app) => (app.id === appId ? { ...app, imageUrl: "" } : app)),
    }));
  };

  const resolveImageUrl = async (imageUrl: string) => {
    if (!imageUrl || config().dataSource.mode !== "kanidm" || !imageUrl.startsWith("/ui/images/")) {
      return imageUrl;
    }

    const token = sessionStorage.getItem(bearerTokenKey);
    if (!token) return "";
    const blob = await readKanidm("Reading Kanidm image.", () =>
      new KanidmDataSource(config().dataSource, token).fetchImage(imageUrl),
    );
    return URL.createObjectURL(blob);
  };

  function clearKanidmSession(message = "Kanidm config loaded. Sign in to load identity data.") {
    sessionStorage.removeItem(bearerTokenKey);
    setIsAuthenticated(false);
    setSessionReady(true);
    setState(createUnauthenticatedState(config()));
    setApiStatus({
      mode: "kanidm",
      state: "ready",
      message,
    });
  }

  function handleKanidmAuthFailure(error: unknown, failedToken?: string) {
    if (!isKanidmAuthFailure(error)) return false;

    if (failedToken && sessionStorage.getItem(bearerTokenKey) !== failedToken) {
      return true;
    }

    clearKanidmSession("Kanidm session expired. Sign in again.");
    return true;
  }

  async function readKanidm<T>(
    message: string,
    operation: (config: Configuration) => Promise<T>,
    options: { reportError?: boolean } = {},
  ) {
    const token = sessionStorage.getItem(bearerTokenKey);
    if (!token) {
      clearKanidmSession("Kanidm session expired. Sign in again.");
      throw new Error("Kanidm read requires an authenticated bearer token.");
    }

    try {
      const rConfig = new Configuration({
        basePath: config().dataSource.apiBasePath.replace(/\/$/, ""),
        credentials: "include",
        headers: { Accept: "application/json" },
        accessToken: () => token ?? undefined,
      });
      return await operation(rConfig);
    } catch (error) {
      if (!handleKanidmAuthFailure(error, token) && options.reportError !== false) {
        setApiStatus({
          mode: "kanidm",
          state: "error",
          message: error instanceof Error ? error.message : message,
        });
      }
      throw error;
    }
  }

  const themeConfigSnippet = () =>
    JSON.stringify(
      {
        siteName: config().siteName,
        logoUrl: config().logoUrl,
        loginMessage: config().loginMessage,
        adminGroup: config().adminGroup,
        dataSource: config().dataSource,
        theme: config().theme,
      },
      null,
      2,
    );

  const resetDemoData = () => {
    mockRadiusPasswords = seedMockRadiusPasswords();
    setMockSshPublicKeys(seedMockSshPublicKeys());
    setMockServiceAccountApiTokens(seedMockServiceAccountApiTokens());
    setMockServiceAccountSshPublicKeys(seedMockServiceAccountSshPublicKeys());
    setMockPersonCertificates({});
    setMockUserAuthTokens(seedMockUserAuthTokens());
    setState({ ...initialState, branding: branding() });
  };

  const value: ConsoleContextValue = {
    state,
    config,
    configReady,
    sessionReady,
    isAuthenticated,
    apiStatus,
    branding,
    currentUser,
    refreshSessionData,
    loginWithPassword,
    startPasskeyLogin,
    finishPasskeyLogin,
    startSecurityKeyLogin,
    finishSecurityKeyLogin,
    logout,
    setRole,
    setThemeMode,
    updateNativeBranding,
    resetNativeBranding,
    updateProfile,
    updatePersonProfile,
    updatePersonStatus,
    deletePerson,
    getPersonCertificates,
    addPersonCertificate,
    getRadiusPassword,
    generateRadiusPassword,
    deleteRadiusPassword,
    getPersonRadiusPassword,
    generatePersonRadiusPassword,
    deletePersonRadiusPassword,
    getSshPublicKeys,
    addSshPublicKey,
    deleteSshPublicKey,
    getPersonSshPublicKeys,
    addPersonSshPublicKey,
    deletePersonSshPublicKey,
    getUserAuthTokens,
    deleteUserAuthToken,
    getPersonUserAuthTokens,
    deletePersonUserAuthToken,
    issueCredentialUpdateIntent,
    getUnixAccount,
    extendUnixAccount,
    setUnixCredential,
    deleteUnixCredential,
    extendPersonUnixAccount,
    setPersonUnixCredential,
    deletePersonUnixCredential,
    beginCredentialUpdate,
    exchangeCredentialUpdateIntent,
    updateCredentialPassword,
    generateCredentialBackupCodes,
    removeCredentialBackupCodes,
    startCredentialTotp,
    verifyCredentialTotp,
    acceptCredentialTotpSha1,
    removeCredentialTotp,
    cancelCredentialMfaRegistration,
    updateCredentialUnixPassword,
    removeCredentialUnixPassword,
    removeCredentialSshPublicKey,
    addCredentialSshPublicKey,
    startCredentialPasskey,
    finishCredentialPasskey,
    removeCredentialPasskey,
    removeCredentialAttestedPasskey,
    commitCredentialUpdate,
    cancelCredentialUpdate,
    addPerson,
    addGroup,
    deleteGroup,
    updateGroup,
    addGroupMembers,
    removeGroupMembers,
    groupUnixSettings,
    extendGroupUnix,
    groupPolicy,
    updateGroupPolicyAttribute,
    schemaCatalog,
    recycleBinEntries,
    recycleBinEntry,
    reviveRecycleBinEntry,
    systemConfig,
    updateSystemAttribute,
    addServiceAccount,
    updateServiceAccount,
    deleteServiceAccount,
    toggleServiceAccountGroup,
    getServiceAccountApiTokens,
    generateServiceAccountApiToken,
    deleteServiceAccountApiToken,
    getServiceAccountCredentialStatus,
    generateServiceAccountPassword,
    getServiceAccountSshPublicKeys,
    addServiceAccountSshPublicKey,
    deleteServiceAccountSshPublicKey,
    extendServiceAccountUnixAccount,
    addApplication,
    updateApplication,
    updateApplicationPolicy,
    updateApplicationKeyAction,
    getApplicationClientSecret,
    deleteApplication,
    toggleGroupMember,
    uploadDomainImage,
    resetDomainImage,
    uploadAppImage,
    resetAppImage,
    resolveImageUrl,
    getAccessForPerson,
    getGroupsForPerson,
    getPeopleForGroup,
    themeConfigSnippet,
    resetDemoData,
  };

  return <ConsoleContext.Provider value={value}>{props.children}</ConsoleContext.Provider>;
}

export function useConsole() {
  const context = useContext(ConsoleContext);
  if (!context) {
    throw new Error("useConsole must be used inside ConsoleProvider");
  }
  return context;
}

export async function loadDashboardConfig(): Promise<DashboardConfig> {
  try {
    const response = await fetch(configPath, { cache: "no-store" });
    if (!response.ok) return defaultDashboardConfig;
    return mergeDashboardConfig(await response.json());
  } catch {
    return defaultDashboardConfig;
  }
}

interface DashboardRuntimePolicy {
  production: boolean;
  allowMockData: boolean;
}

function currentDashboardRuntimePolicy(): DashboardRuntimePolicy {
  return {
    production: import.meta.env.PROD,
    allowMockData: import.meta.env.VITE_ALLOW_MOCK_DATA === "true",
  };
}

export function mergeDashboardConfig(
  value: unknown,
  runtimePolicy = currentDashboardRuntimePolicy(),
): DashboardConfig {
  if (!value || typeof value !== "object") return defaultDashboardConfig;
  const candidate = value as Partial<DashboardConfig>;
  const config = {
    ...defaultDashboardConfig,
    ...candidate,
    dataSource: {
      ...defaultDashboardConfig.dataSource,
      ...candidate.dataSource,
    },
    theme: {
      ...defaultDashboardConfig.theme,
      ...candidate.theme,
    },
  };

  if (
    config.dataSource.mode === "mock" &&
    runtimePolicy.production &&
    !runtimePolicy.allowMockData
  ) {
    console.warn(
      "Ignoring dashboard.config.json mock dataSource in production build. Build with VITE_ALLOW_MOCK_DATA=true only for intentional demo artifacts.",
    );
    return {
      ...config,
      dataSource: {
        ...defaultDashboardConfig.dataSource,
        mode: "kanidm",
      },
    };
  }

  return config;
}

function applyDashboardBrandingFallback(
  state: ConsoleState,
  config: DashboardConfig,
): ConsoleState {
  return {
    ...state,
    branding: {
      ...state.branding,
      companyName:
        state.branding.companyName &&
        state.branding.companyName !== initialState.branding.companyName
          ? state.branding.companyName
          : config.siteName,
      logoUrl:
        state.branding.logoUrl && state.branding.logoUrl !== initialState.branding.logoUrl
          ? state.branding.logoUrl
          : config.logoUrl,
      loginMessage:
        state.branding.loginMessage &&
        state.branding.loginMessage !== initialState.branding.loginMessage
          ? state.branding.loginMessage
          : config.loginMessage,
      theme: config.theme,
    },
  };
}

export function resolveGroupClosure(groupIds: string[], groups: Group[]) {
  const seen = new Set<string>();
  const visit = (groupId: string) => {
    if (seen.has(groupId)) return;
    seen.add(groupId);
    const group = groups.find((candidate) => candidate.id === groupId);
    group?.parentGroups.forEach(visit);
  };
  groupIds.forEach(visit);
  return [...seen];
}

export function contrastRatio(hexA: string, hexB: string) {
  const toRgb = (hex: string) => {
    const normalized = hex.replace("#", "");
    const value =
      normalized.length === 3
        ? normalized
            .split("")
            .map((char) => char + char)
            .join("")
        : normalized;
    return [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16) / 255);
  };

  const luminance = (hex: string) => {
    const [r, g, b] = toRgb(hex).map((channel) =>
      channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  const light = Math.max(luminance(hexA), luminance(hexB));
  const dark = Math.min(luminance(hexA), luminance(hexB));
  return (light + 0.05) / (dark + 0.05);
}

export function getPresetTheme(preset: ThemeSettings["preset"]): ThemeSettings {
  const base = defaultDashboardConfig.theme;
  const presets: Record<ThemeSettings["preset"], ThemeSettings> = {
    orb: base,
    copper: {
      ...base,
      preset: "copper",
      accentColor: "#af5f00",
      successColor: "#248a52",
      warningColor: "#ad6500",
      dangerColor: "#c7352b",
      surfaceIntensity: "frosted",
    },
    forest: {
      ...base,
      preset: "forest",
      accentColor: "#007a4d",
      successColor: "#16833a",
      warningColor: "#8b6a00",
      dangerColor: "#b83245",
      surfaceIntensity: "frosted",
    },
    mono: {
      ...base,
      preset: "mono",
      accentColor: "#4b5563",
      successColor: "#047857",
      warningColor: "#92400e",
      dangerColor: "#b91c1c",
      surfaceIntensity: "flat",
    },
    custom: {
      ...base,
      preset: "custom",
    },
  };
  return presets[preset];
}

export function themePreviewStyle(theme: ThemeSettings) {
  return {
    "--accent": theme.accentColor,
    "--success": theme.successColor,
    "--warning": theme.warningColor,
    "--danger": theme.dangerColor,
    "--surface-alpha": String(surfaceAlpha(theme.surfaceIntensity)),
  };
}

function applyTheme(theme: ThemeSettings) {
  const root = document.documentElement;
  const resolvedMode = resolveThemeMode(theme.mode);
  root.dataset.theme = resolvedMode;
  root.style.setProperty("--accent", theme.accentColor);
  root.style.setProperty("--success", theme.successColor);
  root.style.setProperty("--warning", theme.warningColor);
  root.style.setProperty("--danger", theme.dangerColor);
  root.style.setProperty("--surface-alpha", String(surfaceAlpha(theme.surfaceIntensity)));
}

function resolveThemeMode(mode: ThemeMode): "dark" | "light" {
  if (mode !== "system") return mode;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function surfaceAlpha(intensity: ThemeSettings["surfaceIntensity"]) {
  if (intensity === "flat") return 0.96;
  if (intensity === "glass") return 0.58;
  return 0.78;
}

export function createUnauthenticatedState(
  config: DashboardConfig = defaultDashboardConfig,
  brandingOverride?: BrandingSettings,
): ConsoleState {
  const anonymousPerson: Person = {
    id: "anonymous",
    username: "",
    displayName: "Not signed in",
    legalName: "Not signed in",
    email: "",
    status: "active",
    groups: [],
    credential: {
      password: "missing",
      passkeys: 0,
      totp: false,
      backupCodes: 0,
      unixCredential: false,
      sshKeys: 0,
      radiusPassword: false,
    },
    unix: {
      gidNumber: null,
      shell: "",
      credentialSet: false,
    },
    lastAuth: "Not signed in",
  };

  return {
    role: "user",
    currentUserId: anonymousPerson.id,
    branding: {
      ...initialState.branding,
      ...brandingOverride,
      companyName: brandingOverride?.companyName || config.siteName,
      logoUrl: brandingOverride?.logoUrl || config.logoUrl,
      loginMessage: brandingOverride?.loginMessage || config.loginMessage,
      theme: config.theme,
    },
    people: [anonymousPerson],
    serviceAccounts: [],
    groups: [],
    apps: [],
  };
}

function readMockState(config: DashboardConfig): ConsoleState {
  if (typeof window === "undefined") return mockInitialState(config);
  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) return mockInitialState(config);
    const parsed = JSON.parse(stored) as Partial<ConsoleState>;
    if (!isUsableStoredMockState(parsed)) return mockInitialState(config);
    return {
      ...initialState,
      ...parsed,
      branding: {
        ...initialState.branding,
        ...parsed.branding,
        companyName: parsed.branding?.companyName || config.siteName,
        logoUrl: parsed.branding?.logoUrl || config.logoUrl,
        loginMessage: parsed.branding?.loginMessage || config.loginMessage,
        theme: config.theme,
      },
    };
  } catch {
    return mockInitialState(config);
  }
}

function isUsableStoredMockState(value: Partial<ConsoleState>) {
  return Boolean(
    value.currentUserId &&
    value.currentUserId !== "anonymous" &&
    value.people?.some((person) => person.id === value.currentUserId),
  );
}

function mockInitialState(config: DashboardConfig): ConsoleState {
  return {
    ...initialState,
    branding: {
      ...initialState.branding,
      companyName: initialState.branding.companyName || config.siteName,
      logoUrl: initialState.branding.logoUrl || config.logoUrl,
      loginMessage: initialState.branding.loginMessage || config.loginMessage,
      theme: config.theme,
    },
  };
}

function seedMockRadiusPasswords() {
  return Object.fromEntries(
    initialState.people
      .filter((person) => person.credential.radiusPassword)
      .map((person) => [person.id, seedRadiusPassword]),
  );
}

function seedMockSshPublicKeys(): Record<string, SshPublicKey[]> {
  return Object.fromEntries(
    initialState.people.map((person) => [
      person.id,
      Array.from({ length: person.credential.sshKeys }, (_, index) => {
        const tag = index === 0 ? "work-laptop" : `key-${index + 1}`;
        return {
          tag,
          key: `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI${person.username}${index}DemoPublicKey ${person.username}-${tag}`,
        };
      }),
    ]),
  );
}

function seedMockServiceAccountApiTokens(): Record<string, ServiceAccountApiToken[]> {
  return Object.fromEntries(
    initialState.serviceAccounts.map((serviceAccount) => [
      serviceAccount.id,
      Array.from({ length: serviceAccount.credential.apiTokens }, (_, index) => ({
        accountId: serviceAccount.id,
        tokenId: `00000000-0000-4000-a100-${String(index + 1).padStart(12, "0")}`,
        label: index === 0 ? "deployment token" : `automation token ${index + 1}`,
        issuedAt: new Date(Date.now() - (index + 1) * 86_400_000).toISOString(),
        expiry: index === 0 ? undefined : new Date(Date.now() + 30 * 86_400_000).toISOString(),
        purpose: index === 0 ? "readwrite" : "readonly",
      })),
    ]),
  );
}

function seedMockServiceAccountSshPublicKeys(): Record<string, SshPublicKey[]> {
  return Object.fromEntries(
    initialState.serviceAccounts.map((serviceAccount) => [
      serviceAccount.id,
      Array.from({ length: serviceAccount.credential.sshKeys }, (_, index) => {
        const tag = index === 0 ? "deploy-host" : `service-key-${index + 1}`;
        return {
          tag,
          key: `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI${serviceAccount.name}${index}DemoPublicKey ${tag}`,
        };
      }),
    ]),
  );
}

function seedMockUserAuthTokens(): UserAuthTokenStatus[] {
  return initialState.people.flatMap((person, index) => [
    {
      accountId: person.id,
      sessionId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      issuedAt: new Date(Date.now() - (index + 1) * 36e5).toISOString(),
      purpose: index === 0 ? "readwrite" : "readonly",
      state: {
        expiresAt: new Date(Date.now() + (index + 2) * 36e5).toISOString(),
      },
    },
    {
      accountId: person.id,
      sessionId: `00000000-0000-4000-9000-${String(index + 1).padStart(12, "0")}`,
      issuedAt: new Date(Date.now() - (index + 2) * 72e5).toISOString(),
      purpose: "privilegecapable",
      state: "neverexpires",
    },
  ]);
}

function updateSshKeyCount(state: ConsoleState, personId: string, count: number): ConsoleState {
  return {
    ...state,
    people: state.people.map((person) =>
      person.id === personId
        ? { ...person, credential: { ...person.credential, sshKeys: count } }
        : person,
    ),
  };
}

function updateUnixAccount(
  state: ConsoleState,
  personId: string,
  unix: UnixAccountSettings,
): ConsoleState {
  return {
    ...state,
    people: state.people.map((person) =>
      person.id === personId
        ? {
            ...person,
            unix,
            credential: {
              ...person.credential,
              unixCredential:
                unix.credentialSet || unix.gidNumber !== null || unix.shell.trim().length > 0,
            },
          }
        : person,
    ),
  };
}

function updateServiceAccountTokenCount(
  state: ConsoleState,
  serviceAccountId: string,
  count: number,
): ConsoleState {
  return {
    ...state,
    serviceAccounts: state.serviceAccounts.map((serviceAccount) =>
      serviceAccount.id === serviceAccountId
        ? {
            ...serviceAccount,
            credential: { ...serviceAccount.credential, apiTokens: count },
            status: count > 0 ? "ready" : serviceAccount.status,
          }
        : serviceAccount,
    ),
  };
}

function updateServiceAccountSshKeyCount(
  state: ConsoleState,
  serviceAccountId: string,
  count: number,
): ConsoleState {
  return {
    ...state,
    serviceAccounts: state.serviceAccounts.map((serviceAccount) =>
      serviceAccount.id === serviceAccountId
        ? {
            ...serviceAccount,
            credential: { ...serviceAccount.credential, sshKeys: count },
            status: count > 0 ? "ready" : serviceAccount.status,
          }
        : serviceAccount,
    ),
  };
}

function updateServiceAccountCredentialState(
  state: ConsoleState,
  serviceAccountId: string,
  password: ServiceAccountCredentialState,
): ConsoleState {
  return {
    ...state,
    serviceAccounts: state.serviceAccounts.map((serviceAccount) =>
      serviceAccount.id === serviceAccountId
        ? {
            ...serviceAccount,
            credential: { ...serviceAccount.credential, password },
            status: password === "present" ? "ready" : serviceAccount.status,
          }
        : serviceAccount,
    ),
  };
}

function updateServiceAccountUnixAccount(
  state: ConsoleState,
  serviceAccountId: string,
  unix: UnixAccountSettings,
): ConsoleState {
  return {
    ...state,
    serviceAccounts: state.serviceAccounts.map((serviceAccount) =>
      serviceAccount.id === serviceAccountId
        ? {
            ...serviceAccount,
            unix,
            credential: {
              ...serviceAccount.credential,
              unixCredential:
                unix.credentialSet || unix.gidNumber !== null || unix.shell.trim().length > 0,
            },
            status: "ready",
          }
        : serviceAccount,
    ),
  };
}

function mockCredentialUpdateStatus(sessionToken: string, person: Person): CredentialUpdateStatus {
  return {
    sessionToken,
    spn: `${person.username}@localhost`,
    displayName: person.displayName,
    canCommit: true,
    warnings: person.credential.totp ? [] : ["MfaRequired"],
    primaryState: "Modifiable",
    passkeysState: "Modifiable",
    attestedPasskeysState: "PolicyDeny",
    unixCredentialState: "Modifiable",
    sshKeysState: "Modifiable",
    passkeyCount: person.credential.passkeys,
    attestedPasskeyCount: 0,
    passkeys: Array.from({ length: person.credential.passkeys }, (_, index) => ({
      uuid: `00000000-0000-4000-9000-${String(index + 10).padStart(12, "0")}`,
      tag: index === 0 ? "Laptop passkey" : `Passkey ${index + 1}`,
    })),
    attestedPasskeys: [],
    sshKeyCount: person.credential.sshKeys,
    sshKeyLabels: Array.from({ length: person.credential.sshKeys }, (_, index) =>
      index === 0 ? "work-laptop" : `ssh-key-${index + 1}`,
    ),
    hasPrimaryCredential: person.credential.password !== "missing",
    hasUnixCredential: person.unix.credentialSet,
    totpLabels: person.credential.totp ? ["Authenticator"] : [],
    pendingTotp: null,
    pendingPasskey: null,
    totpIssue: null,
    totpIssueLabel: "",
    pendingBackupCodes: [],
  };
}

function parseTotpCode(value: string) {
  const trimmed = value.trim();
  if (!/^[0-9]+$/.test(trimmed)) {
    throw new Error("TOTP code must be numeric.");
  }
  return Number.parseInt(trimmed, 10);
}

function mockPendingTotp(person: Person) {
  const secret = "JBSWY3DPEHPK3PXP";
  const issuer = "Kanidm Dashboard";
  const accountName = `${person.username}@localhost`;
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}`;
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA256",
    digits: "6",
    period: "30",
  });

  return {
    accountName,
    issuer,
    secret,
    algorithm: "SHA256",
    step: 30,
    digits: 6,
    uri: `otpauth://totp/${label}?${params.toString()}`,
  };
}

function mockPendingPasskey(kind: PasskeyRegistration["kind"]): PasskeyRegistration {
  const host =
    typeof globalThis.location === "object" && globalThis.location.hostname
      ? globalThis.location.hostname
      : "localhost";

  return {
    kind,
    challenge: {
      publicKey: {
        challenge: "Y2hhbGxlbmdl",
        rp: { name: "Kanidm Dashboard", id: host },
        user: {
          id: "YXZh",
          name: "ava@localhost",
          displayName: "Ava Chen",
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 },
        ],
        timeout: 60000,
        attestation: kind === "attested-passkey" ? "direct" : "none",
        authenticatorSelection: {
          residentKey: "required",
          userVerification: "preferred",
        },
      },
    },
  };
}

function mockPasskeyLoginChallenge(username: string, privileged: boolean): PasskeyLoginChallenge {
  const host =
    typeof globalThis.location === "object" && globalThis.location.hostname
      ? globalThis.location.hostname
      : "localhost";

  return {
    authSessionId: `mock_passkey_${username}`,
    kind: "passkey",
    username,
    privileged,
    challenge: {
      publicKey: {
        challenge: "bW9jay1sb2dpbi1jaGFsbGVuZ2U",
        rpId: host,
        allowCredentials: [],
        timeout: 60000,
        userVerification: "preferred",
      },
    },
  };
}

function uniqueLabels(labels: string[]) {
  return Array.from(new Set(labels.filter(Boolean)));
}

function uniquePasskeys(passkeys: PasskeyCredential[]) {
  const byKey = new Map<string, PasskeyCredential>();
  for (const passkey of passkeys) {
    const key = passkey.uuid || passkey.tag;
    if (key) byKey.set(key, passkey);
  }
  return Array.from(byKey.values());
}

function nextId(prefix: string, value: string) {
  const safe = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${prefix}-${safe || Date.now()}`;
}

function groupIdsToNames(groupIds: string[], groups: Group[]) {
  return groupIds
    .map((groupId) => groups.find((group) => group.id === groupId)?.name)
    .filter((name): name is string => Boolean(name));
}

function normalizedApplicationScopeMaps(input: NewApplicationInput) {
  const explicitMaps = input.scopeMaps ?? [];
  return input.allowedGroups.map((groupId) => {
    const explicit = explicitMaps.find((scopeMap) => scopeMap.groupId === groupId);
    return {
      groupId,
      scopes: uniqueLabels((explicit?.scopes.length ? explicit.scopes : input.scopes).map(String)),
    };
  });
}

function normalizedPolicyScopeMaps(scopeMaps: ApplicationPolicyInput["scopeMaps"]) {
  return scopeMaps
    .map((scopeMap) => ({
      groupId: scopeMap.groupId,
      scopes: uniqueLabels(scopeMap.scopes.map(String)),
    }))
    .filter((scopeMap) => scopeMap.groupId && scopeMap.scopes.length);
}

function personIdsToUsernames(personIds: string[], people: Person[]) {
  return personIds
    .map((personId) => people.find((person) => person.id === personId)?.username)
    .filter((username): username is string => Boolean(username));
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Expected FileReader to return a data URL string."));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
