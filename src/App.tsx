import {
  createContext,
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
  useContext,
} from "solid-js";
import type { JSX, ParentProps } from "solid-js";
import {
  AppWindow,
  ArrowRight,
  BadgeCheck,
  Brush,
  Check,
  ChevronRight,
  CircleAlert,
  CircleUserRound,
  ClipboardCheck,
  Fingerprint,
  GitBranch,
  KeyRound,
  LaptopMinimal,
  LayoutDashboard,
  Link as LinkIcon,
  LogOut,
  Moon,
  Palette,
  Plus,
  QrCode,
  RefreshCw,
  RotateCcw,
  Search,
  ServerCog,
  ShieldCheck,
  Smartphone,
  SquareAsterisk,
  Sun,
  Trash2,
  Upload,
  UserRoundPlus,
  UsersRound,
} from "lucide-solid";
import type {
  Application,
  ApplicationScopeMap,
  BrandingSettings,
  CredentialUpdateIntent,
  CredentialUpdateStatus,
  Group,
  GroupCreationResult,
  NewApplicationInput,
  NewGroupInput,
  NewPersonInput,
  PasskeyRegistration,
  Person,
  PersonCreationResult,
  ProfileUpdateInput,
  Role,
  SshPublicKey,
  UnixAccountSettings,
  UserAuthTokenStatus,
  UserStatus,
} from "./domain";
import {
  intentionallyExcludedSurfaces,
  kanidmImageValidation,
  supportedAdminSurfaces,
} from "./domain";
import {
  ConsoleProvider,
  contrastRatio,
  resolveGroupClosure,
  themePreviewStyle,
  useConsole,
} from "./store";
import ErrorBox from "./components/error-box";
import Checklist from "./components/checklist";
import OptionGrid from "./components/option-grid";
import GlassPanel from "./components/glass-panel";
import PageHeader from "./components/page-header";
import TextField from "./components/text-field";
import KeyValue from "./components/key-value";
import ReviewPanel from "./components/review-panel";
import AppIcon from "./components/app-icon";

const standardScopes = ["openid", "profile", "email", "groups", "ssh_publickey"];
const scopeDetails: Record<string, string> = {
  openid: "Required for OIDC",
  profile: "User profile claim",
  email: "Email claim",
  groups: "Group claim",
  ssh_publickey: "SSH key claim",
};

const returnAfterLoginKey = "kanidm-dashboard-return-after-login";

type LoginMethod = "password" | "totp" | "backup" | "passkey" | "security-key";
type CreatedApplication = Application & { clientSecret?: string };

interface RouteContextValue {
  path: () => string;
  navigate: (to: string) => void;
}

const RouteContext = createContext<RouteContextValue>();

function App() {
  return (
    <ConsoleProvider>
      <NavigationProvider>
        <AppRoutes />
      </NavigationProvider>
    </ConsoleProvider>
  );
}

function NavigationProvider(props: ParentProps) {
  const [path, setPath] = createSignal(window.location.pathname || "/portal");
  const navigate = (to: string) => {
    if (to === path()) return;
    window.history.pushState({}, "", to);
    setPath(to);
    window.scrollTo({ top: 0, behavior: "auto" });
  };
  const onPopState = () => setPath(window.location.pathname || "/portal");

  onMount(() => window.addEventListener("popstate", onPopState));
  onCleanup(() => window.removeEventListener("popstate", onPopState));

  return <RouteContext.Provider value={{ path, navigate }}>{props.children}</RouteContext.Provider>;
}

function useNavigation() {
  const context = useContext(RouteContext);
  if (!context) throw new Error("useNavigation must be used inside NavigationProvider");
  return context;
}

function AppRoutes() {
  const { path, navigate } = useNavigation();
  const { configReady, sessionReady, isAuthenticated } = useConsole();
  const privatePath = () => !isPublicRoute(path());
  const privateRouteReady = () => privatePath() && sessionReady() && isAuthenticated();
  const privateRouteLoading = () => privatePath() && isAuthenticated() && !sessionReady();

  createEffect(() => {
    if (configReady() && sessionReady() && privatePath() && !isAuthenticated()) {
      navigate("/login");
    }
  });

  return (
    <Show when={!privateRouteLoading()} fallback={<PrivateRouteLoading />}>
      <Show when={privateRouteReady()} fallback={<SwitchPublic />}>
        <Shell>
          <SwitchPrivate />
        </Shell>
      </Show>
    </Show>
  );
}

function PrivateRouteLoading() {
  return (
    <AuthFrame>
      <section class="auth-card compact-auth">
        <div class="auth-brand compact-brand">
          <LogoMark />
          <h1>Loading session</h1>
          <p>Preparing Kanidm identity data.</p>
        </div>
      </section>
    </AuthFrame>
  );
}

function SwitchPublic() {
  const { path } = useNavigation();
  const route = createMemo(() => {
    const currentPath = path();
    if (currentPath === "/oauth/consent") return <OAuthConsentPage />;
    if (currentPath === "/oauth/resume") return <OAuthResumePage />;
    if (currentPath === "/oauth/access-denied") return <OAuthAccessDeniedPage />;
    if (currentPath === "/recover") return <RecoveryPage />;
    if (currentPath === "/reset") return <ResetCredentialsPage />;
    if (currentPath === "/logout") return <LogoutPage />;
    return <LoginPage />;
  });

  return <>{route()}</>;
}

function SwitchPrivate() {
  const { state } = useConsole();
  const { path } = useNavigation();
  const isAdmin = createMemo(() => state().role === "admin");
  const route = createMemo(() => {
    const currentPath = path();
    const admin = isAdmin();

    if (currentPath === "/" || currentPath === "/portal") return <PortalPage />;
    if (currentPath === "/profile") return <ProfilePage />;
    if (currentPath === "/credentials") return <CredentialsPage />;
    if (currentPath === "/radius") return <RadiusPage />;
    if (currentPath === "/ssh-keys") return <SshKeysPage />;
    if (currentPath === "/unix-credential") return <UnixCredentialPage />;
    if (currentPath === "/enrol") return <EnrolPage />;
    if (!admin && currentPath.startsWith("/admin")) return <PortalPage />;
    if (currentPath === "/admin") return <AdminOverviewPage />;
    if (currentPath === "/admin/people") return <PeoplePage />;
    if (currentPath === "/admin/people/new") return <NewPersonPage />;
    if (currentPath === "/admin/groups") return <GroupsPage />;
    if (currentPath === "/admin/groups/new") return <NewGroupPage />;
    if (currentPath === "/admin/apps") return <ApplicationsPage />;
    if (currentPath === "/admin/apps/new") return <NewApplicationPage />;
    if (currentPath === "/admin/relationships") return <RelationshipsPage />;
    if (currentPath === "/admin/branding") return <BrandingPage />;
    return <PortalPage />;
  });

  return <>{route()}</>;
}

function isPublicRoute(path: string) {
  return [
    "/login",
    "/oauth/consent",
    "/oauth/resume",
    "/oauth/access-denied",
    "/recover",
    "/reset",
    "/logout",
  ].includes(path);
}

function Shell(props: ParentProps) {
  const { state, currentUser, branding, setThemeMode } = useConsole();
  const { path } = useNavigation();
  const admin = () => state().role === "admin";
  const showAdminRail = () => admin() && path().startsWith("/admin");
  const nextTheme = () => (branding().theme.mode === "dark" ? "light" : "dark");

  return (
    <div class="app-shell">
      <header class="topbar">
        <Link class="brand-lockup" href="/portal" ariaLabel="Application portal">
          <LogoMark />
          <span class="brand-name">{branding().companyName}</span>
        </Link>

        <nav class="main-nav" aria-label="Primary">
          <NavLink href="/portal">
            <AppWindow size={16} /> Portal
          </NavLink>
          <NavLink href="/profile">
            <CircleUserRound size={16} /> Profile
          </NavLink>
          <NavLink href="/credentials">
            <KeyRound size={16} /> Credentials
          </NavLink>
          <Show when={admin()}>
            <NavLink href="/admin">
              <ShieldCheck size={16} /> Admin
            </NavLink>
          </Show>
        </nav>

        <div class="topbar-controls">
          <button
            class="theme-toggle"
            type="button"
            onClick={() => setThemeMode(nextTheme())}
            aria-label={`Switch to ${nextTheme()} theme`}
          >
            <Show when={branding().theme.mode === "dark"} fallback={<Sun size={15} />}>
              <Moon size={15} />
            </Show>
            <span>{branding().theme.mode}</span>
          </button>
          <div class="session-pill">
            <span class="avatar">{initials(currentUser().displayName)}</span>
            <span>
              <strong>{currentUser().displayName}</strong>
              <small>{admin() ? "Admin" : "User"}</small>
            </span>
            <Link class="icon-button" href="/logout" ariaLabel="Sign out">
              <LogOut size={16} />
            </Link>
          </div>
        </div>
      </header>

      <main class={showAdminRail() ? "workspace workspace-with-rail" : "workspace"}>
        <Show when={showAdminRail()}>
          <AdminRail />
        </Show>
        <section class="content-pane">{props.children}</section>
      </main>
    </div>
  );
}

function AdminRail() {
  return (
    <aside class="admin-rail" aria-label="Admin">
      <NavLink href="/admin">
        <LayoutDashboard size={17} /> Overview
      </NavLink>
      <NavLink href="/admin/people">
        <UsersRound size={17} /> People
      </NavLink>
      <NavLink href="/admin/groups">
        <GitBranch size={17} /> Groups
      </NavLink>
      <NavLink href="/admin/apps">
        <AppWindow size={17} /> Applications
      </NavLink>
      <NavLink href="/admin/relationships">
        <LinkIcon size={17} /> Relationships
      </NavLink>
      <NavLink href="/admin/branding">
        <Brush size={17} /> Branding
      </NavLink>
    </aside>
  );
}

function Link(
  props: ParentProps<{
    href: string;
    class?: string;
    ariaLabel?: string;
    target?: string;
    rel?: string;
  }>,
) {
  const { navigate } = useNavigation();
  const external = () => props.href.startsWith("http") || props.target;
  return (
    <a
      href={props.href}
      class={props.class}
      aria-label={props.ariaLabel}
      target={props.target}
      rel={props.rel}
      onClick={(event) => {
        if (external()) return;
        event.preventDefault();
        navigate(props.href);
      }}
    >
      {props.children}
    </a>
  );
}

function NavLink(props: ParentProps<{ href: string }>) {
  const { path } = useNavigation();
  const active = () =>
    props.href === "/admin"
      ? path() === "/admin" || path().startsWith("/admin/")
      : path() === props.href;
  return (
    <Link href={props.href} class={active() ? "active" : ""}>
      {props.children}
    </Link>
  );
}

function LogoMark(props: { small?: boolean }) {
  const { branding } = useConsole();
  const className = () => (props.small ? "logo-mark logo-mark-small" : "logo-mark");
  return (
    <Show
      when={branding().logoUrl}
      fallback={
        <span class={className()} aria-hidden="true">
          {branding().companyName.slice(0, 1).toUpperCase()}
        </span>
      }
    >
      {(logoUrl) => <img class={className()} src={logoUrl()} alt="" />}
    </Show>
  );
}

function LoginPage() {
  const {
    branding,
    config,
    configReady,
    loginWithPassword,
    startPasskeyLogin,
    finishPasskeyLogin,
    startSecurityKeyLogin,
    finishSecurityKeyLogin,
  } = useConsole();
  const { navigate } = useNavigation();
  const [role, setSelectedRole] = createSignal<Role>("admin");
  const [method, setMethod] = createSignal<LoginMethod>("password");
  const [username, setUsername] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [totpCode, setTotpCode] = createSignal("");
  const [backupCode, setBackupCode] = createSignal("");
  const [error, setError] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const enabledMethod = () =>
    method() === "password" ||
    method() === "totp" ||
    method() === "backup" ||
    method() === "passkey" ||
    method() === "security-key";
  const canSubmit = () => {
    if (!configReady() || busy() || !enabledMethod() || !username().trim()) {
      return false;
    }
    if (method() === "passkey") return true;
    if (!password().trim()) return false;
    if (method() === "totp") return Boolean(totpCode().trim());
    if (method() === "backup") return Boolean(backupCode().trim());
    return true;
  };

  createEffect(() => {
    if (!configReady() || config().dataSource.mode !== "mock") return;
    if (!username().trim()) setUsername(role() === "admin" ? "ava" : "mika");
    if (!password().trim()) setPassword("correct horse battery staple");
  });

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!canSubmit()) return;
    setBusy(true);
    setError("");
    try {
      if (method() === "passkey") {
        const challenge = await startPasskeyLogin(username(), role() === "admin");
        const assertion =
          config().dataSource.mode === "mock"
            ? mockPasskeyAssertion()
            : await createPasskeyAssertion(challenge.challenge);
        await finishPasskeyLogin(challenge, assertion);
      } else if (method() === "security-key") {
        const challenge = await startSecurityKeyLogin(username(), role() === "admin");
        const assertion =
          config().dataSource.mode === "mock"
            ? mockPasskeyAssertion()
            : await createPasskeyAssertion(challenge.challenge);
        await finishSecurityKeyLogin(challenge, assertion, password());
      } else {
        await loginWithPassword(username(), password(), role() === "admin", {
          method: method() === "totp" ? "totp" : method() === "backup" ? "backup" : "password",
          totpCode: totpCode(),
          backupCode: backupCode(),
        });
      }
      navigate(returnAfterLoginPath());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame>
      <form class="auth-card" onSubmit={submit}>
        <div class="auth-brand">
          <LogoMark />
          <h1>{branding().companyName}</h1>
          <p>{branding().loginMessage}</p>
        </div>

        <div class="segmented">
          <For each={["password", "totp", "backup", "passkey", "security-key"] as LoginMethod[]}>
            {(item) => (
              <button
                class={method() === item ? "active" : ""}
                type="button"
                onClick={() => setMethod(item)}
              >
                {methodLabel(item)}
              </button>
            )}
          </For>
        </div>

        <label>
          Username
          <input
            value={username()}
            autocomplete="username"
            onInput={(event) => setUsername(event.currentTarget.value)}
          />
        </label>

        <Show
          when={
            method() === "password" ||
            method() === "totp" ||
            method() === "backup" ||
            method() === "security-key"
          }
          fallback={
            <div class="mechanism-box">
              <Show when={method() === "passkey"} fallback={<KeyRound />}>
                <Fingerprint />
              </Show>
              <span>{mechanismCopy(method())}</span>
              <Show
                when={
                  config().dataSource.mode === "kanidm" &&
                  (method() === "passkey" || method() === "security-key")
                }
              >
                <a class="secondary-action" href="/ui/login">
                  Use Kanidm native login <ArrowRight size={16} />
                </a>
              </Show>
            </div>
          }
        >
          <>
            <label>
              Password
              <input
                type="password"
                value={password()}
                autocomplete="current-password"
                onInput={(event) => setPassword(event.currentTarget.value)}
              />
            </label>
            <Show when={method() === "totp"}>
              <label>
                TOTP code
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autocomplete="one-time-code"
                  value={totpCode()}
                  onInput={(event) => setTotpCode(event.currentTarget.value)}
                  placeholder="123456"
                />
              </label>
            </Show>
            <Show when={method() === "backup"}>
              <label>
                Backup code
                <input
                  autocomplete="one-time-code"
                  value={backupCode()}
                  onInput={(event) => setBackupCode(event.currentTarget.value)}
                />
              </label>
            </Show>
          </>
        </Show>

        <label>
          {config().dataSource.mode === "kanidm" ? "Session scope" : "Demo session"}
          <select
            value={role()}
            onChange={(event) => {
              const nextRole = event.currentTarget.value as Role;
              setSelectedRole(nextRole);
              if (config().dataSource.mode === "mock") {
                setUsername(nextRole === "admin" ? "ava" : "mika");
              }
            }}
          >
            <option value="admin">
              {config().dataSource.mode === "kanidm" ? "Admin console access" : "Admin user"}
            </option>
            <option value="user">
              {config().dataSource.mode === "kanidm" ? "Portal session" : "Non-admin user"}
            </option>
          </select>
        </label>

        <ErrorBox error={error} />

        <button class="primary-action" type="submit" disabled={!canSubmit()}>
          {!configReady() ? "Loading config" : busy() ? "Authenticating" : "Continue"}{" "}
          <ArrowRight size={16} />
        </button>

        <div class="auth-links">
          <Link href="/recover">Recover account</Link>
          <Link href="/reset">Use reset token</Link>
          <Link href="/oauth/consent">OAuth consent</Link>
        </div>
      </form>
    </AuthFrame>
  );
}

function returnAfterLoginPath() {
  const stored = sessionStorage.getItem(returnAfterLoginKey);
  sessionStorage.removeItem(returnAfterLoginKey);
  if (!stored || !stored.startsWith("/") || stored.startsWith("//") || isPublicRoute(stored)) {
    return "/portal";
  }
  return stored;
}

function AuthFrame(props: ParentProps) {
  return (
    <main class="auth-frame">
      <div class="orb-grid" />
      {props.children}
    </main>
  );
}

function OAuthConsentPage() {
  const { state, currentUser } = useConsole();
  const request = () => oauthRequestFromLocation(state().apps);
  return (
    <AuthFrame>
      <section class="auth-card wide-auth">
        <div class="auth-brand compact-brand">
          <AppIcon app={request().app} />
          <h1>{request().app.displayName}</h1>
          <p>Authenticate as {currentUser().displayName} to continue.</p>
        </div>
        <div class="intent-token">
          <KeyValue label="Client" value={request().clientId} />
          <KeyValue label="Redirect URI" value={request().redirectUri || "Not provided"} />
          <KeyValue label="State" value={request().stateValue || "Not provided"} />
        </div>
        <div class="scope-list">
          <For each={request().scopes}>
            {(scope) => (
              <span>
                <Check size={14} /> {scope}
              </span>
            )}
          </For>
        </div>
        <div class="button-row">
          <a class="secondary-action" href={oauthAccessDeniedHref(request())}>
            Deny
          </a>
          <a class="primary-action" href={oauthAllowHref(request())}>
            Allow access <ArrowRight size={16} />
          </a>
        </div>
      </section>
    </AuthFrame>
  );
}

function OAuthResumePage() {
  const { state } = useConsole();
  const request = () => oauthRequestFromLocation(state().apps);
  return (
    <AuthFrame>
      <section class="auth-card wide-auth">
        <div class="auth-brand compact-brand">
          <AppIcon app={request().app} />
          <h1>Resume sign-in</h1>
          <p>{request().app.displayName}</p>
        </div>
        <div class="intent-token">
          <KeyValue label="Client" value={request().clientId} />
          <KeyValue label="Redirect URI" value={request().redirectUri || "Not provided"} />
          <KeyValue label="Requested scopes" value={request().scopes.join(", ")} />
        </div>
        <div class="button-row">
          <Link class="secondary-action" href="/login">
            Return to login
          </Link>
          <a class="primary-action" href={oauthConsentHref(request())}>
            Review access <ArrowRight size={16} />
          </a>
        </div>
      </section>
    </AuthFrame>
  );
}

function OAuthAccessDeniedPage() {
  const { state } = useConsole();
  const request = () => oauthRequestFromLocation(state().apps);
  const reason = () =>
    new URLSearchParams(window.location.search).get("error_description") ||
    "The authorization request was denied.";
  return (
    <AuthFrame>
      <section class="auth-card wide-auth">
        <div class="auth-brand compact-brand">
          <CircleAlert size={28} />
          <h1>Access denied</h1>
          <p>{request().app.displayName}</p>
        </div>
        <div class="review-box danger">
          <CircleAlert size={18} />
          <span>{reason()}</span>
        </div>
        <div class="button-row">
          <Link class="secondary-action" href="/login">
            Return to login
          </Link>
          <Show when={request().redirectUri}>
            <a class="primary-action" href={oauthDeniedRedirectHref(request())}>
              Return to application <ArrowRight size={16} />
            </a>
          </Show>
        </div>
      </section>
    </AuthFrame>
  );
}

function RecoveryPage() {
  const { branding, config } = useConsole();
  const [email, setEmail] = createSignal("");
  const [submitted, setSubmitted] = createSignal(false);
  const realKanidm = () => config().dataSource.mode === "kanidm";

  function submit(event: SubmitEvent) {
    event.preventDefault();
    if (realKanidm()) return;
    setSubmitted(true);
  }

  return (
    <AuthFrame>
      <form class="auth-card" onSubmit={submit}>
        <div class="auth-brand">
          <LogoMark />
          <h1>Account recovery</h1>
          <p>{branding().companyName}</p>
        </div>
        <Show
          when={realKanidm()}
          fallback={
            <>
              <label>
                Username or email
                <input
                  value={email()}
                  onInput={(event) => setEmail(event.currentTarget.value)}
                  placeholder="ava@aster.example"
                />
              </label>
              <Show when={submitted()}>
                <div class="review-box success">
                  <BadgeCheck size={18} />
                  <span>If that account can recover credentials, instructions have been sent.</span>
                </div>
              </Show>
              <button class="primary-action" type="submit" disabled={!email().trim()}>
                Send recovery instructions
              </button>
            </>
          }
        >
          <div class="review-box">
            <ShieldCheck size={18} />
            <span>Continue through Kanidm's protected recovery form.</span>
          </div>
          <a class="primary-action" href="/ui/recover">
            Open recovery <ArrowRight size={16} />
          </a>
        </Show>
        <Link class="quiet-link" href="/login">
          Return to login
        </Link>
      </form>
    </AuthFrame>
  );
}

function ResetCredentialsPage() {
  const {
    config,
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
  } = useConsole();
  const [token, setToken] = createSignal(
    new URLSearchParams(window.location.search).get("token") ?? "",
  );
  const [status, setStatus] = createSignal<CredentialUpdateStatus | null>(null);
  const [newPassword, setNewPassword] = createSignal("");
  const [confirmPassword, setConfirmPassword] = createSignal("");
  const [totpLabel, setTotpLabel] = createSignal("Authenticator");
  const [totpCode, setTotpCode] = createSignal("");
  const [totpRemoveLabel, setTotpRemoveLabel] = createSignal("");
  const [passkeyLabel, setPasskeyLabel] = createSignal("Workstation passkey");
  const [passkeyRemoveId, setPasskeyRemoveId] = createSignal("");
  const [attestedPasskeyRemoveId, setAttestedPasskeyRemoveId] = createSignal("");
  const [sshKeyLabel, setSshKeyLabel] = createSignal("Workstation");
  const [sshPublicKey, setSshPublicKey] = createSignal("");
  const [sshKeyRemoveLabel, setSshKeyRemoveLabel] = createSignal("");
  const [unixPassword, setUnixPassword] = createSignal("");
  const [unixConfirmPassword, setUnixConfirmPassword] = createSignal("");
  const [busy, setBusy] = createSignal("");
  const [message, setMessage] = createSignal("");
  const [error, setError] = createSignal("");

  async function verifyToken() {
    setBusy("verify");
    setMessage("");
    setError("");
    try {
      const nextStatus = await exchangeCredentialUpdateIntent(token());
      setStatus(nextStatus);
      setNewPassword("");
      setConfirmPassword("");
      setTotpCode("");
      setTotpRemoveLabel("");
      setPasskeyLabel("Workstation passkey");
      setPasskeyRemoveId(nextStatus.passkeys[0]?.uuid ?? "");
      setAttestedPasskeyRemoveId(nextStatus.attestedPasskeys[0]?.uuid ?? "");
      setSshKeyLabel("Workstation");
      setSshPublicKey("");
      setSshKeyRemoveLabel(nextStatus.sshKeyLabels[0] ?? "");
      setUnixPassword("");
      setUnixConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify reset token.");
    } finally {
      setBusy("");
    }
  }

  async function stagePassword() {
    const current = status();
    if (!current) return;
    if (!newPassword().trim()) {
      setError("New password is required.");
      return;
    }
    if (newPassword() !== confirmPassword()) {
      setError("Password confirmation does not match.");
      return;
    }

    setBusy("password");
    setMessage("");
    setError("");
    try {
      setStatus(await updateCredentialPassword(current.sessionToken, newPassword()));
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Password staged. Review the credential status, then commit.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not stage password update.");
    } finally {
      setBusy("");
    }
  }

  async function generateBackupCodes() {
    const current = status();
    if (!current) return;

    setBusy("backup-codes");
    setMessage("");
    setError("");
    try {
      setStatus(await generateCredentialBackupCodes(current.sessionToken));
      setMessage("Backup codes staged. Store them securely, then commit.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate backup codes.");
    } finally {
      setBusy("");
    }
  }

  async function removeBackupCodes() {
    const current = status();
    if (!current) return;

    setBusy("backup-code-remove");
    setMessage("");
    setError("");
    try {
      setStatus(await removeCredentialBackupCodes(current.sessionToken));
      setMessage("Backup code removal staged. Review the credential status, then commit.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove backup codes.");
    } finally {
      setBusy("");
    }
  }

  async function stageUnixPassword() {
    const current = status();
    if (!current) return;
    if (!unixPassword().trim()) {
      setError("Unix credential password is required.");
      return;
    }
    if (unixPassword() !== unixConfirmPassword()) {
      setError("Unix credential confirmation does not match.");
      return;
    }

    setBusy("unix-password");
    setMessage("");
    setError("");
    try {
      setStatus(await updateCredentialUnixPassword(current.sessionToken, unixPassword()));
      setUnixPassword("");
      setUnixConfirmPassword("");
      setMessage("Unix credential staged. Review the credential status, then commit.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not stage Unix credential.");
    } finally {
      setBusy("");
    }
  }

  async function removeUnixPassword() {
    const current = status();
    if (!current) return;

    setBusy("unix-remove");
    setMessage("");
    setError("");
    try {
      setStatus(await removeCredentialUnixPassword(current.sessionToken));
      setMessage("Unix credential removal staged. Review the credential status, then commit.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove Unix credential.");
    } finally {
      setBusy("");
    }
  }

  async function removeSshPublicKey() {
    const current = status();
    if (!current) return;

    setBusy("ssh-key-remove");
    setMessage("");
    setError("");
    try {
      const nextStatus = await removeCredentialSshPublicKey(
        current.sessionToken,
        sshKeyRemoveLabel(),
      );
      setStatus(nextStatus);
      setSshKeyRemoveLabel(nextStatus.sshKeyLabels[0] ?? "");
      setMessage("SSH public key removal staged. Review the credential status, then commit.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove SSH public key.");
    } finally {
      setBusy("");
    }
  }

  async function addSshKey() {
    const current = status();
    if (!current) return;

    setBusy("ssh-key-add");
    setMessage("");
    setError("");
    try {
      const nextStatus = await addCredentialSshPublicKey(
        current.sessionToken,
        sshKeyLabel(),
        sshPublicKey(),
      );
      setStatus(nextStatus);
      setSshKeyRemoveLabel(nextStatus.sshKeyLabels[0] ?? "");
      setSshPublicKey("");
      setMessage("SSH public key staged. Review the credential status, then commit.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add SSH public key.");
    } finally {
      setBusy("");
    }
  }

  async function removePasskey() {
    const current = status();
    if (!current) return;

    setBusy("passkey-remove");
    setMessage("");
    setError("");
    try {
      const nextStatus = await removeCredentialPasskey(current.sessionToken, passkeyRemoveId());
      setStatus(nextStatus);
      setPasskeyRemoveId(nextStatus.passkeys[0]?.uuid ?? "");
      setMessage("Passkey removal staged. Review the credential status, then commit.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove passkey.");
    } finally {
      setBusy("");
    }
  }

  async function startPasskey(kind: PasskeyRegistration["kind"]) {
    const current = status();
    if (!current) return;

    setBusy(kind === "attested-passkey" ? "attested-passkey-start" : "passkey-start");
    setMessage("");
    setError("");
    try {
      setStatus(await startCredentialPasskey(current.sessionToken, kind));
      setMessage(
        kind === "attested-passkey"
          ? "Attested passkey setup started. Complete browser registration before commit."
          : "Passkey setup started. Complete browser registration before commit.",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : kind === "attested-passkey"
            ? "Could not start attested passkey setup."
            : "Could not start passkey setup.",
      );
    } finally {
      setBusy("");
    }
  }

  async function finishPasskeyRegistration() {
    const current = status();
    if (!current?.pendingPasskey) return;

    setBusy("passkey-finish");
    setMessage("");
    setError("");
    try {
      const registration =
        config().dataSource.mode === "mock"
          ? mockPasskeyRegistration()
          : await createPasskeyRegistration(current.pendingPasskey.challenge);
      const nextStatus = await finishCredentialPasskey(
        current.sessionToken,
        passkeyLabel(),
        registration,
        current.pendingPasskey.kind,
      );
      setStatus(nextStatus);
      setPasskeyRemoveId(nextStatus.passkeys[0]?.uuid ?? "");
      setAttestedPasskeyRemoveId(nextStatus.attestedPasskeys[0]?.uuid ?? "");
      setMessage(
        current.pendingPasskey.kind === "attested-passkey"
          ? "Attested passkey staged. Review the credential status, then commit."
          : "Passkey staged. Review the credential status, then commit.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not register passkey.");
    } finally {
      setBusy("");
    }
  }

  async function removeAttestedPasskey() {
    const current = status();
    if (!current) return;

    setBusy("attested-passkey-remove");
    setMessage("");
    setError("");
    try {
      const nextStatus = await removeCredentialAttestedPasskey(
        current.sessionToken,
        attestedPasskeyRemoveId(),
      );
      setStatus(nextStatus);
      setAttestedPasskeyRemoveId(nextStatus.attestedPasskeys[0]?.uuid ?? "");
      setMessage("Attested passkey removal staged. Review the credential status, then commit.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove attested passkey.");
    } finally {
      setBusy("");
    }
  }

  async function startTotp() {
    const current = status();
    if (!current) return;

    setBusy("totp-start");
    setMessage("");
    setError("");
    try {
      setStatus(await startCredentialTotp(current.sessionToken));
      setTotpCode("");
      setMessage("TOTP setup started. Verify the authenticator code before commit.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start TOTP setup.");
    } finally {
      setBusy("");
    }
  }

  async function verifyTotp() {
    const current = status();
    if (!current) return;

    setBusy("totp-verify");
    setMessage("");
    setError("");
    try {
      const nextStatus = await verifyCredentialTotp(current.sessionToken, totpCode(), totpLabel());
      setStatus(nextStatus);
      setTotpRemoveLabel(nextStatus.totpLabels[0] ?? "");
      setTotpCode("");
      setMessage("TOTP staged. Review the credential status, then commit.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify TOTP code.");
    } finally {
      setBusy("");
    }
  }

  async function acceptTotpSha1() {
    const current = status();
    if (!current) return;

    setBusy("totp-sha1");
    setMessage("");
    setError("");
    try {
      setStatus(await acceptCredentialTotpSha1(current.sessionToken));
      setMessage("SHA1 TOTP accepted. Review the credential status, then commit.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not accept SHA1 TOTP.");
    } finally {
      setBusy("");
    }
  }

  async function removeTotp() {
    const current = status();
    if (!current) return;

    setBusy("totp-remove");
    setMessage("");
    setError("");
    try {
      const nextStatus = await removeCredentialTotp(current.sessionToken, totpRemoveLabel());
      setStatus(nextStatus);
      setTotpRemoveLabel(nextStatus.totpLabels[0] ?? "");
      setMessage("TOTP removal staged. Review the credential status, then commit.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove TOTP.");
    } finally {
      setBusy("");
    }
  }

  async function cancelMfaRegistration() {
    const current = status();
    if (!current) return;

    setBusy("mfa-cancel");
    setMessage("");
    setError("");
    try {
      setStatus(await cancelCredentialMfaRegistration(current.sessionToken));
      setTotpCode("");
      setMessage("MFA setup cancelled.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel MFA setup.");
    } finally {
      setBusy("");
    }
  }

  async function commit() {
    const current = status();
    if (!current) return;
    setBusy("commit");
    setMessage("");
    setError("");
    try {
      await commitCredentialUpdate(current.sessionToken);
      setMessage("Credential update committed.");
      setStatus(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not commit credential update.");
    } finally {
      setBusy("");
    }
  }

  async function cancel() {
    const current = status();
    if (!current) return;
    setBusy("cancel");
    setMessage("");
    setError("");
    try {
      await cancelCredentialUpdate(current.sessionToken);
      setMessage("Credential update cancelled.");
      setStatus(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel credential update.");
    } finally {
      setBusy("");
    }
  }

  return (
    <AuthFrame>
      <form class="auth-card">
        <div class="auth-brand">
          <LogoMark />
          <h1>Reset credentials</h1>
          <p>
            Enter a reset token to update password, passkey, TOTP, Unix credential, or SSH keys.
          </p>
        </div>
        <label>
          Reset token
          <input
            value={token()}
            onInput={(event) => {
              setToken(event.currentTarget.value);
              setStatus(null);
              setMessage("");
              setError("");
            }}
            placeholder="kc_..."
          />
        </label>
        <button
          class="primary-action"
          type="button"
          disabled={!token().trim() || busy() === "verify"}
          onClick={() => void verifyToken()}
        >
          {busy() === "verify" ? "Verifying token" : "Verify token"}
        </button>
        <Show when={status()}>
          {(verified) => <CredentialUpdateStatusPanel status={verified()} />}
        </Show>
        <Show when={status()}>
          <div class="field-grid">
            <label>
              New password
              <input
                type="password"
                value={newPassword()}
                autocomplete="new-password"
                onInput={(event) => setNewPassword(event.currentTarget.value)}
              />
            </label>
            <label>
              Confirm password
              <input
                type="password"
                value={confirmPassword()}
                autocomplete="new-password"
                onInput={(event) => setConfirmPassword(event.currentTarget.value)}
              />
            </label>
            <button
              class="secondary-action"
              type="button"
              disabled={busy() === "password" || !newPassword().trim() || !confirmPassword().trim()}
              onClick={() => void stagePassword()}
            >
              <KeyRound size={16} /> {busy() === "password" ? "Staging password" : "Stage password"}
            </button>
          </div>
        </Show>
        <Show when={status()}>
          <div class="field-grid">
            <label>
              New Unix password
              <input
                type="password"
                value={unixPassword()}
                autocomplete="new-password"
                onInput={(event) => setUnixPassword(event.currentTarget.value)}
              />
            </label>
            <label>
              Confirm Unix password
              <input
                type="password"
                value={unixConfirmPassword()}
                autocomplete="new-password"
                onInput={(event) => setUnixConfirmPassword(event.currentTarget.value)}
              />
            </label>
            <div class="button-row">
              <button
                class="secondary-action"
                type="button"
                disabled={
                  busy() === "unix-password" ||
                  !unixPassword().trim() ||
                  !unixConfirmPassword().trim()
                }
                onClick={() => void stageUnixPassword()}
              >
                <ServerCog size={16} />
                {busy() === "unix-password" ? "Staging Unix credential" : "Stage Unix credential"}
              </button>
              <button
                class="danger-action"
                type="button"
                disabled={busy() === "unix-remove"}
                onClick={() => void removeUnixPassword()}
              >
                <Trash2 size={16} />
                {busy() === "unix-remove" ? "Removing Unix credential" : "Remove Unix credential"}
              </button>
            </div>
          </div>
        </Show>
        <Show when={status()}>
          {(verified) => (
            <div class="field-grid">
              <Show when={verified().passkeys.length}>
                <label>
                  Passkey
                  <select
                    aria-label="Passkey"
                    value={passkeyRemoveId()}
                    onChange={(event) => setPasskeyRemoveId(event.currentTarget.value)}
                  >
                    <option value="">Select passkey</option>
                    <For each={verified().passkeys}>
                      {(passkey) => <option value={passkey.uuid}>{passkey.tag}</option>}
                    </For>
                  </select>
                </label>
              </Show>
              <Show when={verified().attestedPasskeys.length}>
                <label>
                  Attested passkey
                  <select
                    aria-label="Attested passkey"
                    value={attestedPasskeyRemoveId()}
                    onChange={(event) => setAttestedPasskeyRemoveId(event.currentTarget.value)}
                  >
                    <option value="">Select attested passkey</option>
                    <For each={verified().attestedPasskeys}>
                      {(passkey) => <option value={passkey.uuid}>{passkey.tag}</option>}
                    </For>
                  </select>
                </label>
              </Show>
              <label>
                Passkey label
                <input
                  value={passkeyLabel()}
                  onInput={(event) => setPasskeyLabel(event.currentTarget.value)}
                />
              </label>
              <div class="review-box">
                <Fingerprint size={18} />
                <span>{passkeyRegistrationHint(verified().pendingPasskey)}</span>
              </div>
              <div class="button-row">
                <button
                  class="secondary-action"
                  type="button"
                  disabled={
                    busy() === "passkey-start" ||
                    Boolean(verified().pendingPasskey || verified().pendingTotp)
                  }
                  onClick={() => void startPasskey("passkey")}
                >
                  <Fingerprint size={16} />
                  {busy() === "passkey-start" ? "Starting passkey" : "Start passkey setup"}
                </button>
                <button
                  class="secondary-action"
                  type="button"
                  disabled={
                    busy() === "attested-passkey-start" ||
                    Boolean(verified().pendingPasskey || verified().pendingTotp)
                  }
                  onClick={() => void startPasskey("attested-passkey")}
                >
                  <Fingerprint size={16} />
                  {busy() === "attested-passkey-start"
                    ? "Starting attested passkey"
                    : "Start attested passkey setup"}
                </button>
                <button
                  class="secondary-action"
                  type="button"
                  disabled={
                    busy() === "passkey-finish" ||
                    !verified().pendingPasskey ||
                    !passkeyLabel().trim()
                  }
                  onClick={() => void finishPasskeyRegistration()}
                >
                  <ShieldCheck size={16} />
                  {busy() === "passkey-finish"
                    ? "Registering passkey"
                    : verified().pendingPasskey?.kind === "attested-passkey"
                      ? "Register attested passkey"
                      : "Register passkey"}
                </button>
                <button
                  class="danger-action"
                  type="button"
                  disabled={
                    busy() === "passkey-remove" ||
                    !verified().passkeys.length ||
                    !passkeyRemoveId().trim()
                  }
                  onClick={() => void removePasskey()}
                >
                  <Trash2 size={16} />
                  {busy() === "passkey-remove" ? "Removing passkey" : "Remove passkey"}
                </button>
                <button
                  class="danger-action"
                  type="button"
                  disabled={
                    busy() === "attested-passkey-remove" ||
                    !verified().attestedPasskeys.length ||
                    !attestedPasskeyRemoveId().trim()
                  }
                  onClick={() => void removeAttestedPasskey()}
                >
                  <Trash2 size={16} />
                  {busy() === "attested-passkey-remove"
                    ? "Removing attested passkey"
                    : "Remove attested passkey"}
                </button>
              </div>
            </div>
          )}
        </Show>
        <Show when={status()}>
          {(verified) => (
            <div class="field-grid">
              <label>
                SSH key label
                <input
                  value={sshKeyLabel()}
                  onInput={(event) => setSshKeyLabel(event.currentTarget.value)}
                />
              </label>
              <label>
                SSH public key
                <textarea
                  rows={3}
                  value={sshPublicKey()}
                  onInput={(event) => setSshPublicKey(event.currentTarget.value)}
                  placeholder="ssh-ed25519 AAAA..."
                />
              </label>
              <Show when={verified().sshKeyLabels.length}>
                <label>
                  Registered SSH public key
                  <select
                    value={sshKeyRemoveLabel()}
                    onChange={(event) => setSshKeyRemoveLabel(event.currentTarget.value)}
                  >
                    <option value="">Select SSH key</option>
                    <For each={verified().sshKeyLabels}>
                      {(label) => <option value={label}>{label}</option>}
                    </For>
                  </select>
                </label>
              </Show>
              <div class="review-box">
                <CircleAlert size={18} />
                <span>
                  SSH public keys are parsed by Kanidm before staging. Commit only after reviewing
                  the resulting key count and labels.
                </span>
              </div>
              <div class="button-row">
                <button
                  class="secondary-action"
                  type="button"
                  disabled={
                    busy() === "ssh-key-add" || !sshKeyLabel().trim() || !sshPublicKey().trim()
                  }
                  onClick={() => void addSshKey()}
                >
                  <KeyRound size={16} />
                  {busy() === "ssh-key-add" ? "Adding SSH key" : "Add SSH key"}
                </button>
                <button
                  class="danger-action"
                  type="button"
                  disabled={
                    busy() === "ssh-key-remove" ||
                    !verified().sshKeyLabels.length ||
                    !sshKeyRemoveLabel().trim()
                  }
                  onClick={() => void removeSshPublicKey()}
                >
                  <Trash2 size={16} />
                  {busy() === "ssh-key-remove" ? "Removing SSH key" : "Remove SSH key"}
                </button>
              </div>
            </div>
          )}
        </Show>
        <Show when={status()}>
          {(verified) => (
            <div class="field-grid">
              <div class="button-row">
                <button
                  class="secondary-action"
                  type="button"
                  disabled={busy() === "backup-codes"}
                  onClick={() => void generateBackupCodes()}
                >
                  <SquareAsterisk size={16} />
                  {busy() === "backup-codes" ? "Generating codes" : "Generate backup codes"}
                </button>
                <button
                  class="danger-action"
                  type="button"
                  disabled={busy() === "backup-code-remove"}
                  onClick={() => void removeBackupCodes()}
                >
                  <Trash2 size={16} />
                  {busy() === "backup-code-remove" ? "Removing codes" : "Remove backup codes"}
                </button>
              </div>
              <Show when={verified().pendingBackupCodes.length}>
                <div class="code-grid" aria-label="Generated backup codes">
                  <For each={verified().pendingBackupCodes}>{(code) => <code>{code}</code>}</For>
                </div>
              </Show>
            </div>
          )}
        </Show>
        <Show when={status()}>
          {(verified) => (
            <div class="field-grid">
              <div class="button-row">
                <button
                  class="secondary-action"
                  type="button"
                  disabled={busy() === "totp-start" || Boolean(verified().pendingPasskey)}
                  onClick={() => void startTotp()}
                >
                  <QrCode size={16} />
                  {busy() === "totp-start" ? "Starting TOTP" : "Start TOTP setup"}
                </button>
                <button
                  class="secondary-action"
                  type="button"
                  disabled={
                    busy() === "mfa-cancel" ||
                    !(verified().pendingTotp || verified().pendingPasskey)
                  }
                  onClick={() => void cancelMfaRegistration()}
                >
                  <RotateCcw size={16} />
                  {busy() === "mfa-cancel" ? "Cancelling setup" : "Cancel MFA setup"}
                </button>
              </div>
              <Show when={verified().pendingTotp}>
                {(totp) => <TotpRegistrationPanel registration={totp()} />}
              </Show>
              <Show when={verified().totpIssue}>
                <div class="review-box danger">
                  <CircleAlert size={18} />
                  <span>{totpIssueText(verified())}</span>
                  <Show when={verified().totpIssue === "invalid-sha1"}>
                    <button
                      class="secondary-action"
                      type="button"
                      disabled={busy() === "totp-sha1"}
                      onClick={() => void acceptTotpSha1()}
                    >
                      {busy() === "totp-sha1" ? "Accepting" : "Accept SHA1"}
                    </button>
                  </Show>
                </div>
              </Show>
              <div class="field-grid">
                <label>
                  Authenticator label
                  <input
                    value={totpLabel()}
                    onInput={(event) => setTotpLabel(event.currentTarget.value)}
                  />
                </label>
                <label>
                  TOTP code
                  <input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={totpCode()}
                    onInput={(event) => setTotpCode(event.currentTarget.value)}
                    placeholder="123456"
                  />
                </label>
                <button
                  class="secondary-action"
                  type="button"
                  disabled={
                    busy() === "totp-verify" ||
                    !verified().pendingTotp ||
                    !totpLabel().trim() ||
                    !totpCode().trim()
                  }
                  onClick={() => void verifyTotp()}
                >
                  <ShieldCheck size={16} />
                  {busy() === "totp-verify" ? "Verifying TOTP" : "Verify TOTP"}
                </button>
              </div>
              <Show when={verified().totpLabels.length}>
                <div class="field-grid">
                  <label>
                    Registered TOTP
                    <select
                      value={totpRemoveLabel()}
                      onChange={(event) => setTotpRemoveLabel(event.currentTarget.value)}
                    >
                      <option value="">Select TOTP</option>
                      <For each={verified().totpLabels}>
                        {(label) => <option value={label}>{label}</option>}
                      </For>
                    </select>
                  </label>
                  <button
                    class="danger-action"
                    type="button"
                    disabled={busy() === "totp-remove" || !totpRemoveLabel().trim()}
                    onClick={() => void removeTotp()}
                  >
                    <Trash2 size={16} />
                    {busy() === "totp-remove" ? "Removing TOTP" : "Remove TOTP"}
                  </button>
                </div>
              </Show>
            </div>
          )}
        </Show>
        <Show when={status()}>
          {(verified) => (
            <div class="button-row">
              <button
                class="primary-action"
                type="button"
                disabled={!verified().canCommit || busy() === "commit"}
                onClick={() => void commit()}
              >
                <ClipboardCheck size={16} /> {busy() === "commit" ? "Committing" : "Commit update"}
              </button>
              <button
                class="danger-action"
                type="button"
                disabled={busy() === "cancel"}
                onClick={() => void cancel()}
              >
                <Trash2 size={16} /> {busy() === "cancel" ? "Cancelling" : "Cancel update"}
              </button>
            </div>
          )}
        </Show>
        <Show when={message()}>
          <div class="review-box success">
            <BadgeCheck size={18} />
            <span>{message()}</span>
          </div>
        </Show>
        <ErrorBox error={error} />
        <Link class="quiet-link" href="/login">
          Return to login
        </Link>
      </form>
    </AuthFrame>
  );
}

function passkeyRegistrationHint(registration: CredentialUpdateStatus["pendingPasskey"]) {
  if (!registration) {
    return "Start passkey setup to ask Kanidm for a browser registration challenge. Commit only after the registered key is staged.";
  }
  if (registration.kind === "attested-passkey") {
    return "Attested passkey setup is pending. Use a compatible hardware authenticator to complete browser registration.";
  }
  return "Passkey setup is pending. Complete the browser WebAuthn ceremony to stage the new passkey.";
}

function mockPasskeyRegistration() {
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

function mockPasskeyAssertion() {
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

async function createPasskeyRegistration(challenge: unknown) {
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

async function createPasskeyAssertion(challenge: unknown) {
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

  const publicKey = { ...challenge.publicKey };
  if (typeof publicKey.challenge !== "string") {
    throw new Error("Kanidm passkey challenge is missing a string challenge.");
  }
  publicKey.challenge = base64UrlToUint8Array(publicKey.challenge);

  if (!isRecord(publicKey.user) || typeof publicKey.user.id !== "string") {
    throw new Error("Kanidm passkey challenge is missing a string user id.");
  }
  publicKey.user = {
    ...publicKey.user,
    id: base64UrlToUint8Array(publicKey.user.id),
  };

  if (Array.isArray(publicKey.excludeCredentials)) {
    publicKey.excludeCredentials = publicKey.excludeCredentials.map((credential) => {
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

  const publicKey = { ...challenge.publicKey };
  if (typeof publicKey.challenge !== "string") {
    throw new Error("Kanidm passkey challenge is missing a string challenge.");
  }
  publicKey.challenge = base64UrlToUint8Array(publicKey.challenge);

  if (Array.isArray(publicKey.allowCredentials)) {
    publicKey.allowCredentials = publicKey.allowCredentials.map((credential) => {
      if (!isRecord(credential) || typeof credential.id !== "string") return credential;
      return {
        ...credential,
        id: base64UrlToUint8Array(credential.id),
      };
    });
  }

  return publicKey as unknown as PublicKeyCredentialRequestOptions;
}

function base64UrlToUint8Array(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  const binary = globalThis.atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function arrayBufferToBase64Url(buffer: ArrayBuffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return globalThis.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
}

function CredentialUpdateStatusPanel(props: { status: CredentialUpdateStatus }) {
  const rows = () => [
    [
      "Primary",
      props.status.primaryState,
      props.status.hasPrimaryCredential ? "Present" : "Missing",
    ],
    ["Passkeys", props.status.passkeysState, `${props.status.passkeyCount} registered`],
    [
      "TOTP",
      props.status.pendingTotp ? "Pending verification" : "Ready",
      props.status.totpLabels.length
        ? `${props.status.totpLabels.length} registered`
        : "No registered TOTP",
    ],
    [
      "Attested passkeys",
      props.status.attestedPasskeysState,
      `${props.status.attestedPasskeyCount} registered`,
    ],
    [
      "Unix credential",
      props.status.unixCredentialState,
      props.status.hasUnixCredential ? "Present" : "Missing",
    ],
    [
      "Backup codes",
      props.status.pendingBackupCodes.length ? "Generated" : "No staged changes",
      props.status.pendingBackupCodes.length
        ? `${props.status.pendingBackupCodes.length} pending codes`
        : "Use generation controls below",
    ],
    ["SSH public keys", props.status.sshKeysState, `${props.status.sshKeyCount} keys`],
  ];

  return (
    <div class="intent-token">
      <KeyValue label="Account" value={props.status.displayName} />
      <KeyValue label="SPN" value={props.status.spn} />
      <KeyValue label="Commit allowed" value={props.status.canCommit ? "Yes" : "No"} />
      <Show when={props.status.warnings.length}>
        <div class="review-box danger">
          <CircleAlert size={18} />
          <span>{props.status.warnings.join(", ")}</span>
        </div>
      </Show>
      <div class="status-list">
        <For each={rows()}>
          {([label, state, detail]) => (
            <div>
              <span>{label}</span>
              <strong>{state}</strong>
              <small>{detail}</small>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}

function TotpRegistrationPanel(props: {
  registration: NonNullable<CredentialUpdateStatus["pendingTotp"]>;
}) {
  return (
    <div class="totp-registration" aria-label="TOTP registration details">
      <KeyValue label="Issuer" value={props.registration.issuer} />
      <KeyValue label="Account" value={props.registration.accountName} />
      <KeyValue label="Secret" value={props.registration.secret} />
      <KeyValue label="Algorithm" value={props.registration.algorithm} />
      <KeyValue label="Digits" value={props.registration.digits} />
      <KeyValue label="Period" value={`${props.registration.step}s`} />
      <code>{props.registration.uri}</code>
    </div>
  );
}

function totpIssueText(status: CredentialUpdateStatus) {
  if (status.totpIssue === "try-again") return "The TOTP code did not verify.";
  if (status.totpIssue === "name-taken") {
    return status.totpIssueLabel
      ? `A TOTP named ${status.totpIssueLabel} already exists.`
      : "That TOTP name already exists.";
  }
  if (status.totpIssue === "invalid-sha1") {
    return "The authenticator proposed SHA1. Accept only for compatibility with an existing app.";
  }
  return "";
}

function LogoutPage() {
  const { branding, logout } = useConsole();

  onMount(logout);

  return (
    <AuthFrame>
      <section class="auth-card">
        <div class="auth-brand">
          <LogoMark />
          <h1>Signed out</h1>
          <p>Your {branding().companyName} session is closed.</p>
        </div>
        <Link class="primary-action" href="/login">
          Sign in again
        </Link>
      </section>
    </AuthFrame>
  );
}

function PortalPage() {
  const { state, currentUser, getAccessForPerson } = useConsole();
  const access = () => getAccessForPerson(currentUser().id);
  const admin = () => state().role === "admin";

  return (
    <>
      <PageHeader
        eyebrow="Application portal"
        title={`Welcome, ${currentUser().displayName}`}
        action={
          <Show when={admin()}>
            <Link class="primary-action" href="/admin">
              Admin console <ChevronRight size={16} />
            </Link>
          </Show>
        }
      />

      <div class={admin() ? "portal-layout" : "portal-layout portal-layout-single"}>
        <section>
          <Show
            when={access().length}
            fallback={
              <EmptyState
                icon={<AppWindow />}
                title="No linked applications"
                text="Your account does not currently match an application access group."
              />
            }
          >
            <div class="app-grid">
              <For each={access()}>
                {({ app, groups }) => (
                  <Link class="app-card" href={app.landingUrl} target="_blank" rel="noreferrer">
                    <AppIcon app={app} />
                    <div>
                      <h3>{app.displayName}</h3>
                      <p>{app.landingUrl.replace(/^https?:\/\//, "")}</p>
                    </div>
                    <div class="access-strip">
                      <For each={groups}>{(group) => <span>{group.displayName}</span>}</For>
                    </div>
                  </Link>
                )}
              </For>
            </div>
          </Show>

          <Show when={!admin()}>
            <div class="account-strip" aria-label="Account self-service">
              <AccountPanels />
            </div>
          </Show>
        </section>

        <Show when={admin()}>
          <aside class="portal-sidebar">
            <AccountPanels />
          </aside>
        </Show>
      </div>
    </>
  );
}

function AccountPanels() {
  const { currentUser } = useConsole();

  return (
    <>
      <GlassPanel title="Account">
        <KeyValue label="Username" value={currentUser().username} />
        <KeyValue label="Status" value={<StatusBadge status={currentUser().status} />} />
        <KeyValue label="Last auth" value={currentUser().lastAuth} />
        <div class="button-row">
          <Link class="secondary-action" href="/profile">
            Profile
          </Link>
          <Link class="secondary-action" href="/credentials">
            Credentials
          </Link>
        </div>
      </GlassPanel>
      <GlassPanel title="Credential health">
        <CredentialMeter person={currentUser()} />
      </GlassPanel>
    </>
  );
}

function ProfilePage() {
  const { config, state, currentUser, getGroupsForPerson, updateProfile } = useConsole();
  const [draft, setDraft] = createSignal<ProfileUpdateInput>({
    displayName: currentUser().displayName,
    legalName: currentUser().legalName,
    email: currentUser().email,
  });
  const [review, setReview] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");
  const groups = () => getGroupsForPerson(currentUser().id);
  const profileReadOnly = () => config().dataSource.mode === "kanidm" && state().role !== "admin";
  const changedItems = () => {
    if (profileReadOnly()) return [];
    const current = currentUser();
    const items = [];
    if (draft().displayName.trim() !== current.displayName) items.push("Display name");
    if (draft().legalName.trim() !== current.legalName) items.push("Legal name");
    if (draft().email.trim() !== current.email) items.push("Email");
    return items;
  };
  const canSubmit = () =>
    !profileReadOnly() &&
    draft().displayName.trim() &&
    draft().email.trim() &&
    changedItems().length > 0;

  createEffect(() => {
    const current = currentUser();
    setDraft({
      displayName: current.displayName,
      legalName: current.legalName,
      email: current.email,
    });
    setReview(false);
    setError("");
  });

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!canSubmit()) return;
    if (!review()) {
      setReview(true);
      return;
    }

    setBusy(true);
    setError("");
    try {
      await updateProfile(draft());
      setReview(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update profile.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader eyebrow="Self-service" title="Profile" />
      <form class="two-column" onSubmit={submit}>
        <GlassPanel title="Identity">
          <label>
            Display name
            <input
              value={draft().displayName}
              disabled={profileReadOnly()}
              onInput={(event) => setDraft({ ...draft(), displayName: event.currentTarget.value })}
              required
            />
          </label>
          <label>
            Legal name
            <input
              value={draft().legalName}
              disabled={profileReadOnly()}
              onInput={(event) => setDraft({ ...draft(), legalName: event.currentTarget.value })}
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={draft().email}
              disabled={profileReadOnly()}
              onInput={(event) => setDraft({ ...draft(), email: event.currentTarget.value })}
              required
            />
          </label>
          <Show when={profileReadOnly()}>
            <p class="muted">
              Profile attributes are read-only for this Kanidm session. Display name, legal name,
              and email writes require an admin-authorized person update.
            </p>
          </Show>
          <div class="review-box">
            <ClipboardCheck size={18} />
            <span>
              {review()
                ? `Reviewing ${changedItems().join(", ")} before commit.`
                : "Profile changes are staged for confirmation before commit."}
            </span>
          </div>
          <Show when={error()}>
            <div class="review-box danger">
              <CircleAlert size={18} />
              <span>{error()}</span>
            </div>
          </Show>
          <button class="primary-action" type="submit" disabled={!canSubmit() || busy()}>
            {busy() ? "Saving profile" : review() ? "Save profile" : "Review changes"}
          </button>
        </GlassPanel>

        <GlassPanel title="Access groups">
          <div class="relationship-list">
            <For each={groups()}>
              {(group) => (
                <div class="relationship-row">
                  <GitBranch size={17} />
                  <span>{group.displayName}</span>
                  <small>{group.name}</small>
                </div>
              )}
            </For>
          </div>
        </GlassPanel>
      </form>
    </>
  );
}

function CredentialsPage() {
  const { currentUser, logout, getUserAuthTokens, deleteUserAuthToken } = useConsole();
  const { path, navigate } = useNavigation();
  const [sessions, setSessions] = createSignal<UserAuthTokenStatus[]>([]);
  const [busySession, setBusySession] = createSignal("");
  const [sessionError, setSessionError] = createSignal("");

  onMount(() => {
    void loadSessions();
  });

  async function loadSessions() {
    setSessionError("");
    try {
      setSessions(await getUserAuthTokens());
    } catch (err) {
      setSessionError(err instanceof Error ? err.message : "Could not load sessions.");
    }
  }

  async function revokeSession(sessionId: string) {
    setBusySession(sessionId);
    setSessionError("");
    try {
      setSessions(await deleteUserAuthToken(sessionId));
    } catch (err) {
      setSessionError(err instanceof Error ? err.message : "Could not revoke session.");
    } finally {
      setBusySession("");
    }
  }

  function reauthenticate() {
    sessionStorage.setItem(returnAfterLoginKey, path());
    logout();
    navigate("/login");
  }

  return (
    <>
      <PageHeader
        eyebrow="Self-service"
        title="Credentials"
        action={
          <Link class="secondary-action" href="/enrol">
            <QrCode size={16} /> Enrol device
          </Link>
        }
      />
      <div class="credential-grid">
        <CredentialCard
          title="Primary password"
          value={credentialLabel(currentUser().credential.password)}
          icon={<KeyRound />}
          action="Update"
          href="/enrol"
        />
        <CredentialCard
          title="Passkeys"
          value={`${currentUser().credential.passkeys} registered`}
          icon={<Fingerprint />}
          action="Add passkey"
          disabled
        />
        <CredentialCard
          title="TOTP"
          value={currentUser().credential.totp ? "Enabled" : "Missing"}
          icon={<Smartphone />}
          action="Manage TOTP"
          href="/enrol"
        />
        <CredentialCard
          title="Backup codes"
          value={`${currentUser().credential.backupCodes} available`}
          icon={<SquareAsterisk />}
          action="Regenerate"
          href="/enrol"
        />
        <CredentialCard
          title="Unix credential"
          value={currentUser().credential.unixCredential ? "Set" : "Not set"}
          icon={<ServerCog />}
          action="Manage Unix"
          href="/unix-credential"
        />
        <CredentialCard
          title="SSH public keys"
          value={`${currentUser().credential.sshKeys} keys`}
          icon={<LaptopMinimal />}
          action="Manage keys"
          href="/ssh-keys"
        />
        <CredentialCard
          title="RADIUS password"
          value={currentUser().credential.radiusPassword ? "Generated" : "Not generated"}
          icon={<ServerCog />}
          action="Manage RADIUS"
          href="/radius"
        />
      </div>
      <GlassPanel title="Session and token safety">
        <div class="button-row">
          <button class="secondary-action" type="button" onClick={reauthenticate}>
            <RefreshCw size={16} /> Reauth
          </button>
          <button class="secondary-action" type="button" onClick={() => void loadSessions()}>
            <RefreshCw size={16} /> Refresh sessions
          </button>
        </div>
        <Show when={sessionError()}>
          <div class="review-box danger">
            <CircleAlert size={18} />
            <span>{sessionError()}</span>
          </div>
        </Show>
        <div class="session-list">
          <For each={sessions()}>
            {(session) => (
              <div class="session-row">
                <div>
                  <strong>{session.purpose}</strong>
                  <span>{sessionStateLabel(session)}</span>
                  <small>
                    {shortId(session.sessionId)} issued {formatDateTime(session.issuedAt)}
                  </small>
                </div>
                <button
                  class="danger-action"
                  type="button"
                  disabled={session.state === "revoked" || busySession() === session.sessionId}
                  onClick={() => void revokeSession(session.sessionId)}
                >
                  <Trash2 size={16} />
                  {busySession() === session.sessionId ? "Revoking" : "Revoke session"}
                </button>
              </div>
            )}
          </For>
        </div>
        <Show when={!sessions().length && !sessionError()}>
          <p class="muted">No active sessions returned for this account.</p>
        </Show>
      </GlassPanel>
    </>
  );
}

function RadiusPage() {
  const { config, getRadiusPassword, generateRadiusPassword, deleteRadiusPassword } = useConsole();
  const [radiusPassword, setRadiusPassword] = createSignal<string | null>(null);
  const [loaded, setLoaded] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");
  const [policyBlocked, setPolicyBlocked] = createSignal(false);
  const realMode = () => config().dataSource.mode === "kanidm";

  onMount(() => {
    void loadRadiusPassword();
  });

  async function loadRadiusPassword() {
    setBusy(true);
    setError("");
    try {
      setRadiusPassword(await getRadiusPassword());
      setLoaded(true);
    } catch (err) {
      setError(radiusErrorMessage(err, "Could not load RADIUS password.", setPolicyBlocked));
      setLoaded(true);
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    setBusy(true);
    setError("");
    try {
      setRadiusPassword(await generateRadiusPassword());
      setLoaded(true);
    } catch (err) {
      setError(radiusErrorMessage(err, "Could not generate RADIUS password.", setPolicyBlocked));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError("");
    try {
      await deleteRadiusPassword();
      setRadiusPassword(null);
      setLoaded(true);
    } catch (err) {
      setError(radiusErrorMessage(err, "Could not delete RADIUS password.", setPolicyBlocked));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader eyebrow="Self-service" title="RADIUS password" />
      <GlassPanel title="RADIUS credential">
        <div class="secret-display">
          <span>
            {!loaded() ? "Loading RADIUS password" : (radiusPassword() ?? "Not generated")}
          </span>
          <div class="button-row">
            <button
              class="secondary-action"
              type="button"
              disabled={busy() || policyBlocked()}
              onClick={generate}
            >
              {busy() ? "Working" : "Generate new password"}
            </button>
            <button
              class="danger-action"
              type="button"
              disabled={busy() || policyBlocked() || !radiusPassword()}
              onClick={remove}
            >
              Delete password
            </button>
          </div>
        </div>
        <Show when={realMode() && !policyBlocked()}>
          <div class="review-box">
            <ServerCog size={18} />
            <span>
              RADIUS credentials depend on Kanidm policy for this account. If generation is denied,
              the dashboard will leave the current credential unchanged.
            </span>
          </div>
        </Show>
        <ErrorBox error={error} />
      </GlassPanel>
    </>
  );
}

function radiusErrorMessage(
  error: unknown,
  fallback: string,
  setPolicyBlocked: (blocked: boolean) => void,
) {
  const message = error instanceof Error ? error.message : "";
  if (isKanidmPolicyDenial(message)) {
    setPolicyBlocked(true);
    return "Kanidm denied RADIUS credential changes for this account.";
  }
  if (message.includes("missingattribute")) {
    return "Kanidm has no RADIUS credential configured for this account.";
  }
  return message || fallback;
}

function isKanidmPolicyDenial(message: string) {
  return (
    message.includes("accessdenied") ||
    message.includes("AccessDeny") ||
    message.includes("HTTP 403")
  );
}

function UnixCredentialPage() {
  const { config, getUnixAccount, extendUnixAccount, setUnixCredential, deleteUnixCredential } =
    useConsole();
  const [unix, setUnix] = createSignal<UnixAccountSettings>(getUnixAccount());
  const [gidNumber, setGidNumber] = createSignal(unix().gidNumber?.toString() ?? "");
  const [shell, setShell] = createSignal(unix().shell);
  const [password, setPassword] = createSignal("");
  const [busy, setBusy] = createSignal("");
  const [error, setError] = createSignal("");
  const [policyBlocked, setPolicyBlocked] = createSignal(false);
  const realMode = () => config().dataSource.mode === "kanidm";

  async function saveUnixAccount() {
    const parsedGid = gidNumber().trim() ? Number(gidNumber()) : null;
    if (parsedGid !== null && (!Number.isInteger(parsedGid) || parsedGid < 0)) {
      setError("GID number must be a positive integer.");
      return;
    }

    setBusy("account");
    setError("");
    try {
      setUnix(await extendUnixAccount({ gidNumber: parsedGid, shell: shell() }));
    } catch (err) {
      setError(unixErrorMessage(err, "Could not update Unix account.", setPolicyBlocked));
    } finally {
      setBusy("");
    }
  }

  async function saveUnixCredential() {
    setBusy("credential");
    setError("");
    try {
      setUnix(await setUnixCredential(password()));
      setPassword("");
    } catch (err) {
      setError(unixErrorMessage(err, "Could not set Unix credential.", setPolicyBlocked));
    } finally {
      setBusy("");
    }
  }

  async function removeUnixCredential() {
    setBusy("delete");
    setError("");
    try {
      setUnix(await deleteUnixCredential());
    } catch (err) {
      setError(unixErrorMessage(err, "Could not delete Unix credential.", setPolicyBlocked));
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <PageHeader eyebrow="Self-service" title="Unix credential" />
      <div class="two-column">
        <GlassPanel title="Unix account">
          <div class="theme-grid">
            <KeyValue label="GID number" value={unix().gidNumber ?? "Not set"} />
            <KeyValue label="Login shell" value={unix().shell || "Not set"} />
            <KeyValue label="Credential" value={unix().credentialSet ? "Set" : "Not set"} />
          </div>
          <label>
            GID number
            <input
              inputmode="numeric"
              value={gidNumber()}
              onInput={(event) => setGidNumber(event.currentTarget.value)}
              placeholder="10001"
            />
          </label>
          <label>
            Login shell
            <input
              value={shell()}
              onInput={(event) => setShell(event.currentTarget.value)}
              placeholder="/bin/zsh"
            />
          </label>
          <button
            class="primary-action"
            type="button"
            disabled={busy() === "account" || policyBlocked()}
            onClick={() => void saveUnixAccount()}
          >
            <ServerCog size={16} /> {busy() === "account" ? "Saving account" : "Save Unix account"}
          </button>
        </GlassPanel>
        <GlassPanel title="Unix password">
          <p class="muted">
            Sets the Kanidm Unix credential used by Unix/PAM integrations. This is separate from the
            primary web login credential.
          </p>
          <label>
            New Unix password
            <input
              type="password"
              value={password()}
              onInput={(event) => setPassword(event.currentTarget.value)}
              placeholder="New Unix credential"
            />
          </label>
          <div class="button-row">
            <button
              class="primary-action"
              type="button"
              disabled={busy() === "credential" || policyBlocked() || !password().trim()}
              onClick={() => void saveUnixCredential()}
            >
              <KeyRound size={16} />{" "}
              {busy() === "credential" ? "Setting credential" : "Set Unix credential"}
            </button>
            <button
              class="danger-action"
              type="button"
              disabled={busy() === "delete" || policyBlocked() || !unix().credentialSet}
              onClick={() => void removeUnixCredential()}
            >
              <Trash2 size={16} /> Delete Unix credential
            </button>
          </div>
          <Show when={error()}>
            <div class="review-box danger">
              <CircleAlert size={18} />
              <span>{error()}</span>
            </div>
          </Show>
          <Show when={realMode() && !policyBlocked()}>
            <div class="review-box">
              <ServerCog size={18} />
              <span>
                Unix account and credential changes depend on Kanidm policy for this account.
              </span>
            </div>
          </Show>
        </GlassPanel>
      </div>
    </>
  );
}

function unixErrorMessage(
  error: unknown,
  fallback: string,
  setPolicyBlocked: (blocked: boolean) => void,
) {
  const message = error instanceof Error ? error.message : "";
  if (isKanidmPolicyDenial(message)) {
    setPolicyBlocked(true);
    return "Kanidm denied Unix credential changes for this account.";
  }
  return message || fallback;
}

function SshKeysPage() {
  const { config, getSshPublicKeys, addSshPublicKey, deleteSshPublicKey } = useConsole();
  const [keys, setKeys] = createSignal<SshPublicKey[]>([]);
  const [tag, setTag] = createSignal("");
  const [publicKey, setPublicKey] = createSignal("");
  const [loaded, setLoaded] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");
  const [policyBlocked, setPolicyBlocked] = createSignal(false);
  const realMode = () => config().dataSource.mode === "kanidm";

  onMount(() => {
    void loadKeys();
  });

  async function loadKeys() {
    setBusy(true);
    setError("");
    try {
      setKeys(await getSshPublicKeys());
      setPolicyBlocked(false);
      setLoaded(true);
    } catch (err) {
      setError(sshKeyErrorMessage(err, "Could not load SSH public keys.", setPolicyBlocked));
      setLoaded(true);
    } finally {
      setBusy(false);
    }
  }

  async function addKey() {
    setBusy(true);
    setError("");
    try {
      setKeys(await addSshPublicKey(tag(), publicKey()));
      setTag("");
      setPublicKey("");
      setLoaded(true);
    } catch (err) {
      setError(sshKeyErrorMessage(err, "Could not add SSH public key.", setPolicyBlocked));
    } finally {
      setBusy(false);
    }
  }

  async function removeKey(keyTag: string) {
    setBusy(true);
    setError("");
    try {
      setKeys(await deleteSshPublicKey(keyTag));
      setLoaded(true);
    } catch (err) {
      setError(sshKeyErrorMessage(err, "Could not delete SSH public key.", setPolicyBlocked));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader eyebrow="Self-service" title="SSH public keys" />
      <div class="two-column">
        <GlassPanel title="Registered keys">
          <Show when={loaded()} fallback={<div class="empty-state">Loading SSH public keys.</div>}>
            <Show
              when={keys().length}
              fallback={<div class="empty-state">No SSH keys registered.</div>}
            >
              <div class="ssh-key-list">
                <For each={keys()}>
                  {(item) => (
                    <div class="ssh-key-row">
                      <div>
                        <strong>{item.tag}</strong>
                        <code>{item.key}</code>
                      </div>
                      <button
                        class="danger-action icon-only"
                        type="button"
                        aria-label={`Delete ${item.tag}`}
                        disabled={busy() || policyBlocked()}
                        onClick={() => void removeKey(item.tag)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </Show>
        </GlassPanel>
        <GlassPanel title="Add public key">
          <label>
            Key tag
            <input
              value={tag()}
              disabled={policyBlocked()}
              onInput={(event) => setTag(event.currentTarget.value)}
              placeholder="work-laptop"
            />
          </label>
          <label>
            Public key
            <textarea
              rows={6}
              value={publicKey()}
              disabled={policyBlocked()}
              onInput={(event) => setPublicKey(event.currentTarget.value)}
              placeholder="ssh-ed25519 AAAA..."
            />
          </label>
          <button
            class="primary-action"
            type="button"
            disabled={busy() || policyBlocked() || !tag().trim() || !publicKey().trim()}
            onClick={addKey}
          >
            <Plus size={16} /> Add key
          </button>
          <Show when={realMode() && !policyBlocked()}>
            <div class="review-box">
              <KeyRound size={18} />
              <span>
                SSH public-key self-service depends on Kanidm policy for this account. If a write is
                denied, the dashboard leaves existing keys unchanged.
              </span>
            </div>
          </Show>
          <Show when={error()}>
            <div class="review-box danger">
              <CircleAlert size={18} />
              <span>{error()}</span>
            </div>
          </Show>
        </GlassPanel>
      </div>
    </>
  );
}

function sshKeyErrorMessage(
  error: unknown,
  fallback: string,
  setPolicyBlocked: (blocked: boolean) => void,
) {
  const message = error instanceof Error ? error.message : "";
  if (isKanidmPolicyDenial(message)) {
    setPolicyBlocked(true);
    return "Kanidm denied SSH public-key self-service for this account.";
  }
  return message || fallback;
}

function EnrolPage() {
  const { currentUser, issueCredentialUpdateIntent } = useConsole();
  const [intent, setIntent] = createSignal<CredentialUpdateIntent | null>(null);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");

  async function generateIntent() {
    setBusy(true);
    setError("");
    try {
      setIntent(await issueCredentialUpdateIntent(currentUser().id, 3600));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate enrolment token.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader eyebrow="Self-service" title="Enrol device" />
      <div class="two-column">
        <GlassPanel title="Credential update intent">
          <div class="qr-preview">
            <QrCode size={122} />
          </div>
          <p class="muted">Scan to continue credential update on another device.</p>
          <button
            class="primary-action"
            type="button"
            disabled={busy()}
            onClick={() => void generateIntent()}
          >
            <ClipboardCheck size={16} /> {busy() ? "Generating intent" : "Generate intent"}
          </button>
          <Show when={intent()}>
            {(issued) => (
              <div class="intent-token">
                <KeyValue label="Expires" value={formatDateTime(issued().expiryTime)} />
                <label>
                  Reset URL
                  <input
                    readonly
                    value={`${window.location.origin}/reset?token=${encodeURIComponent(issued().token)}`}
                  />
                </label>
              </div>
            )}
          </Show>
          <Show when={error()}>
            <div class="review-box danger">
              <CircleAlert size={18} />
              <span>{error()}</span>
            </div>
          </Show>
        </GlassPanel>
        <GlassPanel title="Allowed updates">
          <Checklist items={["Password", "Passkey", "Security key", "TOTP", "SSH public key"]} />
        </GlassPanel>
      </div>
    </>
  );
}

function AdminOverviewPage() {
  const { state, apiStatus, config } = useConsole();
  const activePeople = () => state().people.filter((person) => person.status === "active").length;
  const appsReady = () => state().apps.filter((app) => app.status === "ready").length;

  return (
    <>
      <PageHeader
        eyebrow="Admin console"
        title="Operations overview"
        action={
          <Link class="primary-action" href="/admin/apps/new">
            <Plus size={16} /> Add application
          </Link>
        }
      />
      <div class="status-line">
        <BadgeCheck size={16} />
        <span>
          Data source: <strong>{apiStatus().mode}</strong> · {apiStatus().message}
        </span>
      </div>
      <div class="stat-grid">
        <StatCard
          icon={<UsersRound />}
          label="People"
          value={state().people.length}
          detail={`${activePeople()} active`}
        />
        <StatCard
          icon={<GitBranch />}
          label="Groups"
          value={state().groups.length}
          detail="Membership-backed access"
        />
        <StatCard
          icon={<AppWindow />}
          label="Applications"
          value={state().apps.length}
          detail={`${appsReady()} ready`}
        />
        <StatCard
          icon={<Palette />}
          label="Theme"
          value={config().theme.preset}
          detail={config().theme.mode}
        />
      </div>
      <div class="two-column">
        <GlassPanel title="Supported Kanidm surfaces">
          <Checklist items={supportedAdminSurfaces} />
        </GlassPanel>
        <GlassPanel title="Excluded from this console">
          <Checklist items={intentionallyExcludedSurfaces} muted />
        </GlassPanel>
      </div>
      <GlassPanel title="Recent access changes">
        <p class="muted">{/* TODO: Wire up activity feed from Kanidm audit log endpoint */}</p>
        <p class="muted">Access audit logging is not available in this dashboard release.</p>
      </GlassPanel>
    </>
  );
}

function PeoplePage() {
  const { state, getAccessForPerson, issueCredentialUpdateIntent } = useConsole();
  const [query, setQuery] = createSignal("");
  const [intentPersonId, setIntentPersonId] = createSignal("");
  const [intentResult, setIntentResult] = createSignal<CredentialUpdateIntent | null>(null);
  const [intentBusy, setIntentBusy] = createSignal(false);
  const [intentError, setIntentError] = createSignal("");
  const people = () =>
    state().people.filter((person) => searchable(person).includes(query().toLowerCase()));
  const intentPerson = () =>
    state().people.find((person) => person.id === intentPersonId()) ?? null;

  async function issueIntent() {
    const person = intentPerson();
    if (!person) return;
    setIntentBusy(true);
    setIntentError("");
    try {
      setIntentResult(await issueCredentialUpdateIntent(person.id, 3600));
    } catch (err) {
      setIntentError(err instanceof Error ? err.message : "Could not issue credential intent.");
    } finally {
      setIntentBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="People"
        action={
          <Link class="primary-action" href="/admin/people/new">
            <UserRoundPlus size={16} /> Add user
          </Link>
        }
      />
      <Toolbar query={query()} onQuery={setQuery} placeholder="Search people" />
      <Show when={intentPerson()}>
        {(person) => (
          <CredentialIntentPanel
            person={person()}
            result={intentResult()}
            busy={intentBusy()}
            error={intentError()}
            onIssue={() => void issueIntent()}
            onCancel={() => {
              setIntentPersonId("");
              setIntentResult(null);
              setIntentError("");
            }}
          />
        )}
      </Show>
      <div class="table-shell">
        <table>
          <thead>
            <tr>
              <th>Person</th>
              <th>Status</th>
              <th>Groups</th>
              <th>Applications</th>
              <th>Credentials</th>
              <th>Last auth</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <For each={people()}>
              {(person) => (
                <tr>
                  <td>
                    <strong>{person.displayName}</strong>
                    <small>
                      {person.username} · {person.email}
                    </small>
                  </td>
                  <td>
                    <StatusBadge status={person.status} />
                  </td>
                  <td>{person.groups.length}</td>
                  <td>{getAccessForPerson(person.id).length}</td>
                  <td>
                    <CredentialMeter person={person} compact />
                  </td>
                  <td>{person.lastAuth}</td>
                  <td>
                    <button
                      class="secondary-action"
                      type="button"
                      onClick={() => {
                        setIntentPersonId(person.id);
                        setIntentResult(null);
                        setIntentError("");
                      }}
                    >
                      <ClipboardCheck size={16} /> Issue reset
                    </button>
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
    </>
  );
}

function CredentialIntentPanel(props: {
  person: Person;
  result: CredentialUpdateIntent | null;
  busy: boolean;
  error: string;
  onIssue: () => void;
  onCancel: () => void;
}) {
  const resetUrl = () =>
    props.result
      ? `${window.location.origin}/reset?token=${encodeURIComponent(props.result.token)}`
      : "";

  return (
    <GlassPanel title="Credential update review">
      <div class="intent-layout">
        <div>
          <strong>{props.person.displayName}</strong>
          <p class="muted">
            This issues a one-hour credential update token for password, passkey, TOTP, Unix, and
            SSH credential recovery flows.
          </p>
          <div class="review-box danger">
            <CircleAlert size={18} />
            <span>
              Anyone with this token can start credential update for {props.person.username} until
              it expires.
            </span>
          </div>
        </div>
        <div class="button-row">
          <button
            class="primary-action"
            type="button"
            disabled={props.busy}
            onClick={props.onIssue}
          >
            <ClipboardCheck size={16} /> {props.busy ? "Issuing token" : "Issue token"}
          </button>
          <button class="secondary-action" type="button" onClick={props.onCancel}>
            Cancel
          </button>
        </div>
      </div>
      <Show when={props.error}>
        <div class="review-box danger">
          <CircleAlert size={18} />
          <span>{props.error}</span>
        </div>
      </Show>
      <Show when={props.result}>
        {(intent) => (
          <div class="intent-token">
            <KeyValue label="Expires" value={formatDateTime(intent().expiryTime)} />
            <label>
              Reset URL
              <input readonly value={resetUrl()} />
            </label>
            <label>
              Token
              <textarea readonly rows={3} value={intent().token} />
            </label>
          </div>
        )}
      </Show>
    </GlassPanel>
  );
}

function GroupsPage() {
  const { state, getPeopleForGroup, toggleGroupMember } = useConsole();
  const [selectedGroupId, setSelectedGroupId] = createSignal(state().groups[0]?.id ?? "");
  const selectedGroup = () =>
    state().groups.find((group) => group.id === selectedGroupId()) ?? state().groups[0];
  const selectedGroupClosure = () => resolveGroupClosure([selectedGroup().id], state().groups);
  const appsUsingGroup = () =>
    state().apps.filter((app) =>
      app.allowedGroups.some((groupId) => selectedGroupClosure().includes(groupId)),
    );

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Groups"
        action={
          <Link class="primary-action" href="/admin/groups/new">
            <Plus size={16} /> Add group
          </Link>
        }
      />
      <div class="split-admin">
        <div class="resource-list">
          <For each={state().groups}>
            {(group) => (
              <button
                class={group.id === selectedGroup().id ? "resource-row active" : "resource-row"}
                type="button"
                onClick={() => setSelectedGroupId(group.id)}
              >
                <GitBranch size={17} />
                <span>
                  <strong>{group.displayName}</strong>
                  <small>{group.name}</small>
                </span>
                <b>{group.members.length}</b>
              </button>
            )}
          </For>
        </div>
        <div class="resource-detail">
          <GlassPanel title={selectedGroup().displayName}>
            <KeyValue label="System name" value={selectedGroup().name} />
            <KeyValue
              label="Managed by"
              value={labelForGroup(state().groups, selectedGroup().managedBy)}
            />
            <KeyValue
              label="Apps unlocked"
              value={
                appsUsingGroup()
                  .map((app) => app.displayName)
                  .join(", ") || "None"
              }
            />
            <p class="muted">{selectedGroup().description}</p>
          </GlassPanel>

          <GlassPanel title="Members">
            <div class="member-grid">
              <For each={state().people}>
                {(person) => {
                  const isMember = () =>
                    getPeopleForGroup(selectedGroup().id).some((member) => member.id === person.id);
                  return (
                    <button
                      class={isMember() ? "member-pill selected" : "member-pill"}
                      type="button"
                      onClick={() => {
                        void toggleGroupMember(selectedGroup().id, person.id);
                      }}
                    >
                      <span class="avatar">{initials(person.displayName)}</span>
                      {person.displayName}
                      <Show when={isMember()} fallback={<Plus size={14} />}>
                        <Check size={14} />
                      </Show>
                    </button>
                  );
                }}
              </For>
            </div>
            <div class="review-box">
              <ClipboardCheck size={18} />
              <span>
                Membership changes immediately update access to {appsUsingGroup().length}{" "}
                application
                {appsUsingGroup().length === 1 ? "" : "s"}.
              </span>
            </div>
          </GlassPanel>
        </div>
      </div>
    </>
  );
}

function ApplicationsPage() {
  const { state, uploadAppImage, resetAppImage } = useConsole();
  const [query, setQuery] = createSignal("");
  const [imageBusy, setImageBusy] = createSignal("");
  const [imageError, setImageError] = createSignal("");
  const apps = () => state().apps.filter((app) => searchable(app).includes(query().toLowerCase()));

  async function handleAppImageUpload(app: Application, event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const validationError = await validateKanidmImageFile(file);
    if (validationError) {
      setImageError(validationError);
      input.value = "";
      return;
    }

    setImageBusy(app.id);
    setImageError("");
    try {
      await uploadAppImage(app.id, file);
      input.value = "";
    } catch (error) {
      setImageError(error instanceof Error ? error.message : "Could not upload application image.");
    } finally {
      setImageBusy("");
    }
  }

  async function handleResetAppImage(app: Application) {
    setImageBusy(app.id);
    setImageError("");
    try {
      await resetAppImage(app.id);
    } catch (error) {
      setImageError(error instanceof Error ? error.message : "Could not reset application image.");
    } finally {
      setImageBusy("");
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Applications"
        action={
          <Link class="primary-action" href="/admin/apps/new">
            <Plus size={16} /> Add application
          </Link>
        }
      />
      <Toolbar query={query()} onQuery={setQuery} placeholder="Search applications" />
      <Show when={imageError()}>
        <div class="review-box danger">
          <CircleAlert size={18} />
          <span>{imageError()}</span>
        </div>
      </Show>
      <div class="table-shell">
        <table>
          <thead>
            <tr>
              <th>Application</th>
              <th>Client</th>
              <th>Access groups</th>
              <th>Scopes</th>
              <th>Status</th>
              <th>Image</th>
            </tr>
          </thead>
          <tbody>
            <For each={apps()}>
              {(app) => (
                <tr>
                  <td>
                    <span class="table-app">
                      <AppIcon app={app} />
                      <span>
                        <strong>{app.displayName}</strong>
                        <small>{app.landingUrl}</small>
                      </span>
                    </span>
                  </td>
                  <td>{app.clientType}</td>
                  <td>
                    {app.allowedGroups
                      .map((groupId) => labelForGroup(state().groups, groupId))
                      .join(", ")}
                  </td>
                  <td>
                    <Show when={app.scopeMaps?.length} fallback={app.scopes.join(", ")}>
                      <div class="scope-map-summary">
                        <For each={app.scopeMaps}>
                          {(scopeMap) => (
                            <span>
                              <strong>{labelForGroup(state().groups, scopeMap.groupId)}</strong>:{" "}
                              {scopeMap.scopes.join(", ")}
                            </span>
                          )}
                        </For>
                      </div>
                    </Show>
                  </td>
                  <td>
                    <AppStatusBadge status={app.status} />
                  </td>
                  <td>
                    <div class="image-action-stack">
                      <label class="file-button compact-file">
                        <Upload size={15} /> Upload
                        <input
                          type="file"
                          accept=".png,.jpg,.jpeg,.gif,.svg,.webp"
                          disabled={imageBusy() === app.id}
                          onChange={(event) => {
                            void handleAppImageUpload(app, event);
                          }}
                        />
                      </label>
                      <button
                        class="secondary-action"
                        type="button"
                        disabled={imageBusy() === app.id}
                        onClick={() => {
                          void handleResetAppImage(app);
                        }}
                      >
                        <Trash2 size={15} /> Reset
                      </button>
                      <Show when={imageBusy() === app.id}>
                        <small>Saving image</small>
                      </Show>
                    </div>
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
    </>
  );
}

function RelationshipsPage() {
  const { state, getAccessForPerson, getGroupsForPerson } = useConsole();
  const [personId, setPersonId] = createSignal(state().people[0]?.id ?? "");
  const person = () =>
    state().people.find((candidate) => candidate.id === personId()) ?? state().people[0];
  const groups = () => getGroupsForPerson(person().id);
  const access = () => getAccessForPerson(person().id);

  return (
    <>
      <PageHeader eyebrow="Admin" title="Relationships" />
      <GlassPanel title="Effective access">
        <label class="compact-select">
          Person
          <select value={person().id} onChange={(event) => setPersonId(event.currentTarget.value)}>
            <For each={state().people}>
              {(candidate) => <option value={candidate.id}>{candidate.displayName}</option>}
            </For>
          </select>
        </label>
        <div class="relationship-map">
          <div class="relation-column">
            <h3>User</h3>
            <NodeCard
              icon={<CircleUserRound />}
              title={person().displayName}
              subtitle={person().username}
            />
          </div>
          <div class="relation-column">
            <h3>Groups</h3>
            <For each={groups()}>
              {(group) => (
                <NodeCard icon={<GitBranch />} title={group.displayName} subtitle={group.name} />
              )}
            </For>
          </div>
          <div class="relation-column">
            <h3>Applications</h3>
            <For each={access()}>
              {({ app, groups: through }) => (
                <NodeCard
                  icon={<AppWindow />}
                  title={app.displayName}
                  subtitle={`via ${through.map((group) => group.displayName).join(", ")}`}
                />
              )}
            </For>
          </div>
        </div>
      </GlassPanel>
    </>
  );
}

function BrandingPage() {
  const {
    state,
    branding,
    config,
    updateNativeBranding,
    uploadDomainImage,
    resetDomainImage,
    themeConfigSnippet,
  } = useConsole();
  const [draft, setDraft] = createSignal<BrandingSettings>(branding());
  const [saveBusy, setSaveBusy] = createSignal(false);
  const [saveError, setSaveError] = createSignal("");
  const [imageBusy, setImageBusy] = createSignal(false);
  const [imageError, setImageError] = createSignal("");
  const contrast = () =>
    contrastRatio(
      config().theme.accentColor,
      config().theme.mode === "light" ? "#ffffff" : "#0b0f14",
    );
  const validContrast = () => contrast() >= 3;
  const previewBranding = () => ({
    ...branding(),
    companyName: draft().companyName,
  });
  const nativeDomainWritable = () =>
    config().dataSource.mode !== "kanidm" || branding().canManageNativeDomainBranding;

  function patchBranding(patch: Partial<Omit<BrandingSettings, "theme">>) {
    setDraft((previous) => ({ ...previous, ...patch }));
  }

  async function handleLogoUpload(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!nativeDomainWritable()) {
      setImageError("Current Kanidm session cannot manage native domain branding.");
      input.value = "";
      return;
    }
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (
      !kanidmImageValidation.formats.includes(extension) ||
      file.size > kanidmImageValidation.maxBytes
    ) {
      window.alert("Image must be png, jpg, gif, svg, or webp and less than 256 KB.");
      return;
    }
    setImageBusy(true);
    setImageError("");
    try {
      await uploadDomainImage(file);
      setDraft((previous) => ({ ...previous, logoUrl: branding().logoUrl }));
    } catch (error) {
      setImageError(error instanceof Error ? error.message : "Could not upload domain image.");
    } finally {
      setImageBusy(false);
      input.value = "";
    }
  }

  async function saveBranding() {
    setSaveBusy(true);
    setSaveError("");
    try {
      if (!nativeDomainWritable()) {
        throw new Error("Current Kanidm session cannot manage native domain branding.");
      }
      await updateNativeBranding({ companyName: draft().companyName });
      setDraft((previous) => ({ ...previous, companyName: branding().companyName }));
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save branding.");
    } finally {
      setSaveBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Branding"
        action={
          <button
            class="primary-action"
            type="button"
            disabled={saveBusy() || !nativeDomainWritable()}
            onClick={() => {
              void saveBranding();
            }}
          >
            {saveBusy() ? "Saving display name" : "Save domain display name"}
          </button>
        }
      />
      <div class="brand-layout">
        <div class="form-stack">
          <GlassPanel title="Branding surfaces">
            <label>
              Kanidm domain display name
              <input
                value={draft().companyName}
                disabled={!nativeDomainWritable()}
                onInput={(event) => patchBranding({ companyName: event.currentTarget.value })}
              />
            </label>
            <Show when={!nativeDomainWritable()}>
              <div class="review-box warning">
                <CircleAlert size={18} />
                <span>
                  This Kanidm session cannot manage native domain branding. Use a domain
                  administrator account for domain display/image changes, or update the static
                  dashboard config for fallback branding.
                </span>
              </div>
            </Show>
            <div class="config-readouts">
              <KeyValue label="Dashboard login message" value={config().loginMessage} />
              <KeyValue label="Static fallback logo URL" value={config().logoUrl || "Not set"} />
            </div>
            <div class="button-row">
              <label class={nativeDomainWritable() ? "file-button" : "file-button disabled"}>
                <Upload size={16} />{" "}
                {imageBusy() ? "Uploading domain image" : "Upload domain image"}
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg,.gif,.svg,.webp"
                  disabled={imageBusy() || !nativeDomainWritable()}
                  onChange={handleLogoUpload}
                />
              </label>
              <button
                class="danger-action"
                type="button"
                disabled={imageBusy() || !nativeDomainWritable()}
                onClick={() => {
                  setImageBusy(true);
                  setImageError("");
                  void resetDomainImage()
                    .then(() =>
                      setDraft((previous) => ({ ...previous, logoUrl: branding().logoUrl })),
                    )
                    .catch((error: unknown) =>
                      setImageError(
                        error instanceof Error ? error.message : "Could not reset domain image.",
                      ),
                    )
                    .finally(() => setImageBusy(false));
                }}
              >
                Reset domain image
              </button>
            </div>
            <p class="muted">
              Domain display name and domain image are saved to Kanidm when allowed. Login message
              and the unauthenticated fallback logo URL are static dashboard config; set{" "}
              <code>loginMessage</code> and <code>logoUrl</code> in{" "}
              <code>/dashboard.config.json</code> for production.
            </p>
            <Show when={imageError()}>
              <div class="review-box danger">
                <CircleAlert size={18} />
                <span>{imageError()}</span>
              </div>
            </Show>
            <Show when={saveError()}>
              <div class="review-box danger">
                <CircleAlert size={18} />
                <span>{saveError()}</span>
              </div>
            </Show>
          </GlassPanel>

          <GlassPanel title="Static dashboard theme">
            <div class="theme-grid">
              <KeyValue label="Mode" value={config().theme.mode} />
              <KeyValue label="Preset" value={config().theme.preset} />
              <KeyValue label="Accent" value={config().theme.accentColor} />
              <KeyValue label="Surface" value={config().theme.surfaceIntensity} />
            </div>
            <div class={validContrast() ? "review-box success" : "review-box danger"}>
              <Show when={validContrast()} fallback={<CircleAlert size={18} />}>
                <BadgeCheck size={18} />
              </Show>
              <span>Accent contrast {contrast().toFixed(2)}:1 against the active background.</span>
            </div>
            <p class="muted">
              Theme is deploy-time static config. Change <code>/dashboard.config.json</code> and
              roll replicas; active users continue on the old loaded config until reload.
            </p>
            <pre class="config-code">{themeConfigSnippet()}</pre>
            <div class="button-row">
              <button class="secondary-action" type="button" onClick={() => setDraft(branding())}>
                <RotateCcw size={16} /> Discard display-name edit
              </button>
            </div>
          </GlassPanel>
        </div>

        <div class="preview-stack" style={themePreviewStyle(config().theme)}>
          <GlassPanel title="Login preview">
            <div class="mini-login">
              <Show
                when={previewBranding().logoUrl}
                fallback={<span>{previewBranding().companyName.slice(0, 1)}</span>}
              >
                {(logoUrl) => <img src={logoUrl()} alt="" />}
              </Show>
              <strong>{previewBranding().companyName}</strong>
              <small>{previewBranding().loginMessage}</small>
              <button type="button">Continue</button>
            </div>
          </GlassPanel>
          <GlassPanel title="Portal preview">
            <div class="mini-portal">
              <For each={state().apps.slice(0, 3)}>
                {(app) => (
                  <div>
                    <AppIcon app={app} />
                    <span>{app.displayName}</span>
                  </div>
                )}
              </For>
            </div>
          </GlassPanel>
        </div>
      </div>
    </>
  );
}

function NewPersonPage() {
  const { state, config, addPerson } = useConsole();
  const { navigate } = useNavigation();
  const [review, setReview] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");
  const [created, setCreated] = createSignal<PersonCreationResult | null>(null);
  const [input, setInput] = createSignal<NewPersonInput>({
    username: "",
    displayName: "",
    legalName: "",
    email: "",
    status: "active",
    groups: [],
    credentialMode: "enrolment-link",
  });
  const canSubmit = () =>
    input().username.trim() && input().displayName.trim() && input().email.trim();
  const previewApps = () =>
    state().apps.filter((app) =>
      app.allowedGroups.some((groupId) => input().groups.includes(groupId)),
    );
  const realKanidm = () => config().dataSource.mode === "kanidm";
  const credentialOptions = () =>
    realKanidm()
      ? [
          {
            value: "enrolment-link" as const,
            label: "Credential update intent link",
          },
          {
            value: "recovery-only" as const,
            label: "Send recovery email",
          },
        ]
      : [
          {
            value: "enrolment-link" as const,
            label: "Credential update intent link",
          },
          {
            value: "temporary-password" as const,
            label: "Temporary password",
          },
          {
            value: "recovery-only" as const,
            label: "Recovery flow only",
          },
        ];
  const createdResetUrl = () =>
    created()?.credentialIntent
      ? `${window.location.origin}/reset?token=${encodeURIComponent(created()?.credentialIntent?.token ?? "")}`
      : "";

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!canSubmit()) return;
    if (!review()) {
      setReview(true);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await addPerson(input());
      setCreated(result);
      setReview(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create user.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader eyebrow="Admin" title="Add user" />
      <form class="wizard-layout" onSubmit={submit}>
        <div class="form-stack">
          <GlassPanel title="Identity">
            <TextField
              label="Username"
              value={input().username}
              onInput={(value) => setInput({ ...input(), username: value })}
              required
            />
            <TextField
              label="Display name"
              value={input().displayName}
              onInput={(value) => setInput({ ...input(), displayName: value })}
              required
            />
            <TextField
              label="Legal name"
              value={input().legalName}
              onInput={(value) => setInput({ ...input(), legalName: value })}
            />
            <TextField
              label="Email"
              value={input().email}
              onInput={(value) => setInput({ ...input(), email: value })}
              type="email"
              required
            />
          </GlassPanel>
          <GlassPanel title="Access">
            <OptionGrid
              options={state().groups.map((group) => ({
                id: group.id,
                label: group.displayName,
                detail: group.name,
              }))}
              selected={input().groups}
              onToggle={(groupId) =>
                setInput({ ...input(), groups: toggleValue(input().groups, groupId) })
              }
            />
          </GlassPanel>
          <GlassPanel title="Initial credential">
            <label>
              Credential path
              <select
                value={input().credentialMode}
                onChange={(event) =>
                  setInput({
                    ...input(),
                    credentialMode: event.currentTarget.value as NewPersonInput["credentialMode"],
                  })
                }
              >
                <For each={credentialOptions()}>
                  {(option) => <option value={option.value}>{option.label}</option>}
                </For>
              </select>
            </label>
            <Show when={realKanidm()}>
              <p class="muted">
                Kanidm setup uses credential update links or recovery email. Dashboard-created
                temporary passwords are not supported by Kanidm.
              </p>
            </Show>
            <label>
              Account state
              <select
                value={input().status}
                onChange={(event) =>
                  setInput({ ...input(), status: event.currentTarget.value as UserStatus })
                }
              >
                <option value="active">Active</option>
                <option value="locked">Locked</option>
                <option value="recovery">Recovery</option>
              </select>
            </label>
          </GlassPanel>
          <Show when={error()}>
            <div class="review-box danger">
              <CircleAlert size={18} />
              <span>{error()}</span>
            </div>
          </Show>
          <Show when={created()}>
            {(result) => (
              <GlassPanel title="User created">
                <div class="review-items">
                  <div>
                    <BadgeCheck size={18} />
                    <span>
                      Created <strong>{result().person.displayName}</strong>
                    </span>
                  </div>
                  <Show when={result().credentialIntent}>
                    {(intent) => (
                      <>
                        <label>
                          Credential setup URL
                          <input readonly value={createdResetUrl()} />
                        </label>
                        <label>
                          Intent token
                          <textarea readonly rows={3} value={intent().token} />
                        </label>
                        <p class="muted">Expires {formatDateTime(intent().expiryTime)}</p>
                      </>
                    )}
                  </Show>
                  <Show when={result().credentialEmailSent}>
                    <div class="review-box success">
                      <BadgeCheck size={18} />
                      <span>Kanidm accepted the recovery email request for this account.</span>
                    </div>
                  </Show>
                  <Show when={result().credentialNotice}>
                    <p class="muted">{result().credentialNotice}</p>
                  </Show>
                  <button
                    class="secondary-action"
                    type="button"
                    onClick={() => navigate("/admin/people")}
                  >
                    Open people
                  </button>
                </div>
              </GlassPanel>
            )}
          </Show>
        </div>
        <ReviewPanel
          active={review()}
          title="User review"
          items={[
            `Create ${input().displayName || "new user"}`,
            `Add to ${input().groups.length} group${input().groups.length === 1 ? "" : "s"}`,
            `Unlock ${previewApps().length} application${previewApps().length === 1 ? "" : "s"}`,
            `Credential path: ${input().credentialMode}`,
          ]}
          action={busy() ? "Creating user" : review() ? "Create user" : "Review user"}
          disabled={!canSubmit() || busy() || Boolean(created())}
        />
      </form>
    </>
  );
}

function NewGroupPage() {
  const { state, addGroup } = useConsole();
  const { navigate } = useNavigation();
  const [review, setReview] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");
  const [created, setCreated] = createSignal<GroupCreationResult | null>(null);
  const [input, setInput] = createSignal<NewGroupInput>({
    name: "",
    displayName: "",
    description: "",
    members: [],
    parentGroups: [],
    managedBy: state().groups[0]?.id ?? "",
  });
  const affectedApps = () => state().apps.filter((app) => app.allowedGroups.includes(input().name));
  const canSubmit = () => input().name.trim() && input().displayName.trim();

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!canSubmit()) return;
    if (!review()) {
      setReview(true);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await addGroup(input());
      setCreated(result);
      setReview(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create group.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader eyebrow="Admin" title="Add group" />
      <form class="wizard-layout" onSubmit={submit}>
        <div class="form-stack">
          <GlassPanel title="Group details">
            <TextField
              label="System name"
              value={input().name}
              onInput={(value) => setInput({ ...input(), name: value })}
              required
            />
            <TextField
              label="Display name"
              value={input().displayName}
              onInput={(value) => setInput({ ...input(), displayName: value })}
              required
            />
            <label>
              Description
              <textarea
                rows={3}
                value={input().description}
                onInput={(event) =>
                  setInput({ ...input(), description: event.currentTarget.value })
                }
              />
            </label>
            <label>
              Managed by
              <select
                value={input().managedBy}
                onChange={(event) => setInput({ ...input(), managedBy: event.currentTarget.value })}
              >
                <For each={state().groups}>
                  {(group) => <option value={group.id}>{group.displayName}</option>}
                </For>
              </select>
            </label>
          </GlassPanel>
          <GlassPanel title="Members">
            <OptionGrid
              options={state().people.map((person) => ({
                id: person.id,
                label: person.displayName,
                detail: person.username,
              }))}
              selected={input().members}
              onToggle={(personId) =>
                setInput({ ...input(), members: toggleValue(input().members, personId) })
              }
            />
          </GlassPanel>
          <GlassPanel title="Parent relationships">
            <OptionGrid
              options={state().groups.map((group) => ({
                id: group.id,
                label: group.displayName,
                detail: group.name,
              }))}
              selected={input().parentGroups}
              onToggle={(groupId) =>
                setInput({ ...input(), parentGroups: toggleValue(input().parentGroups, groupId) })
              }
            />
          </GlassPanel>
          <Show when={error()}>
            <div class="review-box danger">
              <CircleAlert size={18} />
              <span>{error()}</span>
            </div>
          </Show>
          <Show when={created()}>
            {(result) => (
              <GlassPanel title="Group created">
                <div class="review-items">
                  <div>
                    <BadgeCheck size={18} />
                    <span>
                      Created <strong>{result().group.name}</strong>
                    </span>
                  </div>
                  <Show when={result().metadataWarnings.length}>
                    <div class="review-box">
                      <CircleAlert size={18} />
                      <span>
                        Kanidm created the group, but some optional metadata was not accepted:{" "}
                        {result().metadataWarnings.join(" ")}
                      </span>
                    </div>
                  </Show>
                  <Show when={!result().metadataWarnings.length}>
                    <div class="review-box success">
                      <BadgeCheck size={18} />
                      <span>Kanidm accepted the group metadata and relationships.</span>
                    </div>
                  </Show>
                  <button
                    class="secondary-action"
                    type="button"
                    onClick={() => navigate("/admin/groups")}
                  >
                    Open groups
                  </button>
                </div>
              </GlassPanel>
            )}
          </Show>
        </div>
        <ReviewPanel
          active={review()}
          title="Group review"
          items={[
            `Create ${input().displayName || "new group"}`,
            `Add ${input().members.length} direct member${input().members.length === 1 ? "" : "s"}`,
            `Attach ${input().parentGroups.length} parent relationship${input().parentGroups.length === 1 ? "" : "s"}`,
            `Currently affects ${affectedApps().length} application${affectedApps().length === 1 ? "" : "s"}`,
          ]}
          action={busy() ? "Creating group" : review() ? "Create group" : "Review group"}
          disabled={!canSubmit() || busy() || Boolean(created())}
        />
      </form>
    </>
  );
}

function NewApplicationPage() {
  const { state, addApplication } = useConsole();
  const [review, setReview] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [redirectError, setRedirectError] = createSignal("");
  const [redirectText, setRedirectText] = createSignal("");
  const [createdApplication, setCreatedApplication] = createSignal<CreatedApplication | null>(null);
  const [input, setInput] = createSignal<NewApplicationInput>({
    name: "",
    displayName: "",
    landingUrl: "",
    imageUrl: "",
    clientType: "confidential",
    redirectUris: [],
    allowedGroups: [],
    scopes: ["openid", "profile", "email"],
  });
  const redirectUris = () =>
    redirectText()
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  const affectedPeople = () =>
    state().people.filter((person) =>
      person.groups.some((groupId) => input().allowedGroups.includes(groupId)),
    );
  const selectedGroups = () =>
    state().groups.filter((group) => input().allowedGroups.includes(group.id));
  const scopesForGroup = (groupId: string) =>
    input().scopeMaps?.find((scopeMap) => scopeMap.groupId === groupId)?.scopes ?? input().scopes;
  const effectiveScopeMaps = (): ApplicationScopeMap[] =>
    input().allowedGroups.map((groupId) => ({
      groupId,
      scopes: uniqueValues(scopesForGroup(groupId)),
    }));
  const extraScopes = () => {
    const seen = new Set(standardScopes);
    const extra: string[] = [];
    for (const app of state().apps) {
      for (const scope of app.scopes) {
        if (!seen.has(scope)) {
          seen.add(scope);
          extra.push(scope);
        }
      }
    }
    return extra;
  };
  const [customScope, setCustomScope] = createSignal("");
  const customScopes = () => input().scopes.filter((s) => !standardScopes.includes(s));

  function addCustomScope() {
    const scope = customScope().trim();
    if (!scope || input().scopes.includes(scope)) return;
    setInput({ ...input(), scopes: [...input().scopes, scope] });
    setCustomScope("");
  }

  const canSubmit = () =>
    input().name.trim() &&
    input().displayName.trim() &&
    input().landingUrl.trim() &&
    redirectUris().length > 0 &&
    input().allowedGroups.length > 0 &&
    input().scopes.length > 0 &&
    input().scopes.includes("openid");

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    await submitApplication();
  }

  async function submitApplication() {
    if (!canSubmit()) return;
    const appInput = { ...input(), redirectUris: redirectUris(), scopeMaps: effectiveScopeMaps() };
    if (!review()) {
      setReview(true);
      return;
    }
    setBusy(true);
    setRedirectError("");
    try {
      setCreatedApplication(await addApplication(appInput));
    } catch (err) {
      setRedirectError(err instanceof Error ? err.message : "Could not create application.");
    } finally {
      setBusy(false);
    }
  }

  function toggleAccessGroup(groupId: string) {
    const nextGroups = toggleValue(input().allowedGroups, groupId);
    setInput({
      ...input(),
      allowedGroups: nextGroups,
      scopeMaps: input().scopeMaps?.filter((scopeMap) => nextGroups.includes(scopeMap.groupId)),
    });
    setReview(false);
  }

  function toggleGroupScope(groupId: string, scope: string) {
    const nextScopes = toggleValue(scopesForGroup(groupId), scope);
    setInput({
      ...input(),
      scopeMaps: input().allowedGroups.map((allowedGroupId) => ({
        groupId: allowedGroupId,
        scopes: allowedGroupId === groupId ? nextScopes : scopesForGroup(allowedGroupId),
      })),
    });
    setReview(false);
  }

  return (
    <>
      <Show when={createdApplication()} keyed>
        {(app) => <CreatedApplicationSummary app={app} />}
      </Show>
      <div style={{ display: createdApplication() ? "none" : "contents" }}>
        <PageHeader eyebrow="Admin" title="Add application" />
        <form class="wizard-layout" onSubmit={submit}>
          <div class="form-stack">
            <GlassPanel title="Application">
              <TextField
                label="System name"
                value={input().name}
                onInput={(value) => setInput({ ...input(), name: value })}
                required
              />
              <TextField
                label="Display name"
                value={input().displayName}
                onInput={(value) => setInput({ ...input(), displayName: value })}
                required
              />
              <TextField
                label="Landing URL"
                value={input().landingUrl}
                onInput={(value) => setInput({ ...input(), landingUrl: value })}
                type="url"
                required
              />
              <TextField
                label="Image URL"
                value={input().imageUrl}
                onInput={(value) => setInput({ ...input(), imageUrl: value })}
              />
            </GlassPanel>
            <GlassPanel title="OIDC settings">
              <label>
                Client type
                <select
                  value={input().clientType}
                  onChange={(event) =>
                    setInput({
                      ...input(),
                      clientType: event.currentTarget.value as NewApplicationInput["clientType"],
                    })
                  }
                >
                  <option value="confidential">Confidential client</option>
                  <option value="public">Public client</option>
                </select>
              </label>
              <label>
                Redirect URIs
                <textarea
                  rows={4}
                  value={redirectText()}
                  onInput={(event) => setRedirectText(event.currentTarget.value)}
                  placeholder="https://app.example/oauth/callback"
                  required
                />
              </label>
              <label>
                Custom scope
                <input
                  value={customScope()}
                  onInput={(event) => setCustomScope(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addCustomScope();
                    }
                  }}
                  placeholder="Type a scope and press Enter"
                />
              </label>
              <OptionGrid
                options={standardScopes.map((scope) => ({
                  id: scope,
                  label: scope,
                  detail: scopeDetails[scope] ?? "",
                }))}
                selected={input().scopes}
                onToggle={(scope) =>
                  setInput({ ...input(), scopes: toggleValue(input().scopes, scope) })
                }
              />
              <Show when={extraScopes().length > 0}>
                <div class="suggestion-row">
                  <span class="muted">From existing apps:</span>
                  <For each={extraScopes()}>
                    {(scope) => (
                      <button
                        class="tag-button"
                        type="button"
                        disabled={input().scopes.includes(scope)}
                        onClick={() =>
                          setInput({
                            ...input(),
                            scopes: [...new Set([...input().scopes, scope])],
                          })
                        }
                      >
                        + {scope}
                      </button>
                    )}
                  </For>
                </div>
              </Show>
              <Show when={customScopes().length > 0}>
                <div class="option-grid">
                  <For each={customScopes()}>
                    {(scope) => (
                      <button
                        class="option-card custom-scope"
                        type="button"
                        onClick={() =>
                          setInput({
                            ...input(),
                            scopes: input().scopes.filter((s) => s !== scope),
                          })
                        }
                      >
                        <span>
                          <Check size={16} />
                        </span>
                        <strong>{scope}</strong>
                        <small>Custom scope</small>
                      </button>
                    )}
                  </For>
                </div>
              </Show>
            </GlassPanel>
            <GlassPanel title="Access groups">
              <OptionGrid
                options={state().groups.map((group) => ({
                  id: group.id,
                  label: group.displayName,
                  detail: `${group.members.length} members`,
                }))}
                selected={input().allowedGroups}
                onToggle={toggleAccessGroup}
              />
              <Show when={selectedGroups().length}>
                <div class="scope-map-editor">
                  <For each={selectedGroups()}>
                    {(group) => (
                      <div class="scope-map-row">
                        <div>
                          <strong>{group.displayName}</strong>
                          <small>Scopes granted through this access group</small>
                        </div>
                        <div class="scope-map-options">
                          <For each={[...standardScopes, ...extraScopes()]}>
                            {(scope) => {
                              const selected = () => scopesForGroup(group.id).includes(scope);
                              return (
                                <button
                                  aria-pressed={selected()}
                                  class={selected() ? "scope-toggle selected" : "scope-toggle"}
                                  type="button"
                                  onClick={() => toggleGroupScope(group.id, scope)}
                                >
                                  {scope}
                                </button>
                              );
                            }}
                          </For>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </GlassPanel>
            <GlassPanel title="Unsupported surfaces">
              <div class="disabled-chip-row">
                <For each={["Proxy mode", "Flow builder", "SAML provider", "Outbound SCIM"]}>
                  {(surface) => <span>{surface}</span>}
                </For>
              </div>
            </GlassPanel>
            <Show when={redirectError()}>
              <div class="review-box danger">
                <CircleAlert size={18} />
                <span>{redirectError()}</span>
              </div>
            </Show>
          </div>
          <ReviewPanel
            active={review()}
            title="Application review"
            items={[
              `Create OAuth2/OIDC app ${input().displayName || "new application"}`,
              `${redirectUris().length} redirect URI${redirectUris().length === 1 ? "" : "s"}`,
              `${effectiveScopeMaps().length} access scope map${effectiveScopeMaps().length === 1 ? "" : "s"}`,
              `${affectedPeople().length} person${affectedPeople().length === 1 ? "" : "s"} will see this app`,
            ]}
            action={
              busy()
                ? "Creating application"
                : review()
                  ? "Create application"
                  : "Review application"
            }
            disabled={!canSubmit() || busy()}
            onAction={() => {
              void submitApplication();
            }}
          />
        </form>
      </div>
    </>
  );
}

function CreatedApplicationSummary(props: { app: CreatedApplication }) {
  const secret = () => props.app.clientSecret ?? "";
  const issuerUrl = () => `${window.location.origin}/oauth2/openid/${props.app.name}`;
  const tokenEndpoint = () => `${props.app.landingUrl.replace(/\/$/, "")}/v2/token`;
  const snippet = () =>
    [
      "[auth]",
      `issuer_url = "${issuerUrl()}"`,
      `client_id = "${props.app.name}"`,
      props.app.clientType === "confidential"
        ? `client_secret = "${secret() || "<client-secret>"}"`
        : "",
      `token_endpoint_url = "${tokenEndpoint()}"`,
      `redirect_uri = "${props.app.redirectUris[0] ?? ""}"`,
    ]
      .filter(Boolean)
      .join("\n");

  return (
    <>
      <PageHeader eyebrow="Admin" title="Application created" />
      <div class="form-stack">
        <GlassPanel title="Client credentials">
          <div class="theme-grid">
            <KeyValue label="Client ID" value={props.app.name} />
            <KeyValue label="Issuer URL" value={issuerUrl()} />
            <KeyValue label="Redirect URI" value={props.app.redirectUris[0] ?? "Not configured"} />
          </div>
          <Show when={props.app.clientType === "confidential"}>
            <div class="secret-display">
              <span>{secret() || "Client secret was not returned."}</span>
              <button
                class="secondary-action"
                type="button"
                disabled={!secret()}
                onClick={() => navigator.clipboard?.writeText(secret())}
              >
                <ClipboardCheck size={16} /> Copy secret
              </button>
            </div>
          </Show>
          <pre class="config-code">{snippet()}</pre>
          <div class="button-row">
            <Link class="primary-action" href="/admin/apps">
              Open applications <ArrowRight size={16} />
            </Link>
            <Link class="secondary-action" href="/admin/apps/new">
              Add another application
            </Link>
          </div>
        </GlassPanel>
      </div>
    </>
  );
}

function StatCard(props: {
  icon: JSX.Element;
  label: string;
  value: JSX.Element | number | string;
  detail: string;
}) {
  return (
    <div class="stat-card">
      <span>{props.icon}</span>
      <small>{props.label}</small>
      <strong>{props.value}</strong>
      <em>{props.detail}</em>
    </div>
  );
}

function Toolbar(props: { query: string; onQuery: (value: string) => void; placeholder: string }) {
  return (
    <div class="toolbar">
      <Search size={17} />
      <input
        aria-label={props.placeholder}
        value={props.query}
        onInput={(event) => props.onQuery(event.currentTarget.value)}
        placeholder={props.placeholder}
      />
    </div>
  );
}

function EmptyState(props: { icon: JSX.Element; title: string; text: string }) {
  return (
    <div class="empty-state">
      {props.icon}
      <h2>{props.title}</h2>
      <p>{props.text}</p>
    </div>
  );
}

function StatusBadge(props: { status: UserStatus }) {
  return <span class={`status-badge ${props.status}`}>{props.status}</span>;
}

function AppStatusBadge(props: { status: Application["status"] }) {
  return <span class={`status-badge ${props.status}`}>{props.status}</span>;
}

function CredentialMeter(props: { person: Person; compact?: boolean }) {
  const checks = () => [
    props.person.credential.password === "healthy",
    props.person.credential.passkeys > 0,
    props.person.credential.totp,
    props.person.credential.backupCodes > 0,
    props.person.credential.sshKeys > 0,
  ];
  const score = () => checks().filter(Boolean).length;
  return (
    <div class={props.compact ? "credential-meter compact" : "credential-meter"}>
      <span style={{ width: `${(score() / checks().length) * 100}%` }} />
      <Show when={!props.compact}>
        <small>
          {score()}/{checks().length} healthy signals
        </small>
      </Show>
    </div>
  );
}

function CredentialCard(props: {
  title: string;
  value: string;
  icon: JSX.Element;
  action: string;
  href?: string;
  disabled?: boolean;
}) {
  return (
    <div class="credential-card">
      <span>{props.icon}</span>
      <h3>{props.title}</h3>
      <p>{props.value}</p>
      <Show
        when={props.href && !props.disabled ? props.href : undefined}
        fallback={
          <button class="secondary-action" type="button" disabled={props.disabled}>
            {props.action}
          </button>
        }
      >
        {(href) => (
          <Link class="secondary-action" href={href()}>
            {props.action}
          </Link>
        )}
      </Show>
    </div>
  );
}

interface OAuthDisplayRequest {
  app: Application;
  clientId: string;
  redirectUri: string;
  stateValue: string;
  scopes: string[];
}

function oauthRequestFromLocation(apps: Application[]): OAuthDisplayRequest {
  const params = new URLSearchParams(window.location.search);
  const fallbackApp = apps[0];
  const requestedClient = params.get("client_id") || params.get("app") || "";
  const app = apps.find(
    (candidate) =>
      candidate.name === requestedClient ||
      candidate.id === requestedClient ||
      candidate.displayName === requestedClient,
  ) ??
    fallbackApp ?? {
      id: "unknown-oauth-client",
      name: requestedClient || "unknown-oauth-client",
      displayName: requestedClient || "OAuth application",
      landingUrl: "/portal",
      imageUrl: "",
      clientType: "public",
      redirectUris: [],
      allowedGroups: [],
      scopes: ["openid", "profile", "email"],
      status: "attention",
    };

  return {
    app,
    clientId: requestedClient || app.name,
    redirectUri: params.get("redirect_uri") || params.get("resume_uri") || "",
    stateValue: params.get("state") || "",
    scopes: normaliseScopes(params.get("scope") || app.scopes.join(" ")),
  };
}

function normaliseScopes(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[,\s]+/)
        .map((scope) => scope.trim())
        .filter(Boolean),
    ),
  );
}

function oauthConsentHref(request: OAuthDisplayRequest) {
  const params = new URLSearchParams({
    client_id: request.clientId,
    scope: request.scopes.join(" "),
  });
  if (request.redirectUri) params.set("redirect_uri", request.redirectUri);
  if (request.stateValue) params.set("state", request.stateValue);
  return `/oauth/consent?${params.toString()}`;
}

function oauthAccessDeniedHref(request: OAuthDisplayRequest) {
  const params = new URLSearchParams({
    client_id: request.clientId,
    scope: request.scopes.join(" "),
    error_description: "The user denied the authorization request.",
  });
  if (request.redirectUri) params.set("redirect_uri", request.redirectUri);
  if (request.stateValue) params.set("state", request.stateValue);
  return `/oauth/access-denied?${params.toString()}`;
}

function oauthAllowHref(request: OAuthDisplayRequest) {
  if (!request.redirectUri) return request.app.landingUrl || "/portal";
  return appendOauthResult(request.redirectUri, {
    code: `dashboard-preview-${request.clientId}`,
    state: request.stateValue,
  });
}

function oauthDeniedRedirectHref(request: OAuthDisplayRequest) {
  if (!request.redirectUri) return "/login";
  return appendOauthResult(request.redirectUri, {
    error: "access_denied",
    error_description: "The user denied the authorization request.",
    state: request.stateValue,
  });
}

function appendOauthResult(target: string, values: Record<string, string>) {
  const url = new URL(target, window.location.origin);
  for (const [key, value] of Object.entries(values)) {
    if (value) url.searchParams.set(key, value);
  }
  return url.href;
}

function NodeCard(props: { icon: JSX.Element; title: string; subtitle: string }) {
  return (
    <div class="node-card">
      {props.icon}
      <span>
        <strong>{props.title}</strong>
        <small>{props.subtitle}</small>
      </span>
    </div>
  );
}

function methodLabel(method: string) {
  const labels: Record<string, string> = {
    password: "Password",
    passkey: "Passkey",
    "security-key": "Security key",
    backup: "Backup",
    totp: "TOTP",
  };
  return labels[method] ?? method;
}

function mechanismCopy(method: string) {
  if (method === "passkey") return "Use a platform passkey registered to this account.";
  if (method === "security-key") return "Insert or tap a registered security key.";
  if (method === "backup") return "Enter one of your remaining backup codes.";
  return "Enter the current code from your authenticator app.";
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function credentialLabel(status: Person["credential"]["password"]) {
  if (status === "healthy") return "Healthy";
  if (status === "needs-update") return "Needs update";
  return "Missing";
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function sessionStateLabel(session: UserAuthTokenStatus) {
  if (session.state === "revoked") return "Revoked";
  if (session.state === "neverexpires") return "Never expires";
  return `Expires ${formatDateTime(session.state.expiresAt)}`;
}

function shortId(value: string) {
  return value.length > 12 ? value.slice(0, 8) : value;
}

function searchable(value: unknown) {
  return JSON.stringify(value).toLowerCase();
}

function labelForGroup(groups: Group[], groupId: string) {
  return groups.find((group) => group.id === groupId)?.displayName ?? groupId;
}

function toggleValue(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((candidate) => candidate !== value)
    : [...values, value];
}

function uniqueValues(values: string[]) {
  return [...new Set(values)];
}

async function validateKanidmImageFile(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!kanidmImageValidation.formats.includes(extension)) {
    return "Image must be png, jpg, gif, svg, or webp.";
  }

  if (file.size > kanidmImageValidation.maxBytes) {
    return "Image must be less than 256 KB.";
  }

  if (extension === "svg") {
    return null;
  }

  const pixels = await imagePixelCount(file);
  if (pixels > kanidmImageValidation.maxPixels) {
    return "Image dimensions must be no more than 1 megapixel.";
  }

  return null;
}

function imagePixelCount(file: File) {
  return new Promise<number>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image.naturalWidth * image.naturalHeight);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image dimensions."));
    };
    image.src = url;
  });
}

export default App;
