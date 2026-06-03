import { createEffect, createMemo, createSignal, For, onMount, Show } from "solid-js";
import type { ParentProps } from "solid-js";
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
  ApplicationPatch,
  ApplicationScopeMap,
  BrandingSettings,
  CreatedApplication,
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
import { KanidmDataSource } from "./data-source";
import ErrorBox from "./components/error-box";
import Checklist from "./components/checklist";
import OptionGrid from "./components/option-grid";
import GlassPanel from "./components/glass-panel";
import PageHeader from "./components/page-header";
import TextField from "./components/text-field";
import KeyValue from "./components/key-value";
import ReviewPanel from "./components/review-panel";
import AppIcon from "./components/app-icon";
import { AuthFrame } from "./components/auth-frame";
import { CredentialCard } from "./components/credential-card";
import { CredentialMeter } from "./components/credential-meter";
import { CredentialUpdateStatusPanel } from "./components/credential-update-status-panel";
import { EmptyState } from "./components/empty-state";
import { LogoMark } from "./components/logo-mark";
import { NodeCard } from "./components/node-card";
import { StatCard } from "./components/stat-card";
import { AppStatusBadge, StatusBadge } from "./components/status-badge";
import { Toolbar } from "./components/toolbar";
import { TotpRegistrationPanel, totpIssueText } from "./components/totp-registration-panel";
import { isPublicRoute } from "./route-paths";
import { scopeDetails, standardScopes } from "./oauth-scopes";
import { Link, NavLink, NavigationProvider, useNavigation } from "./routing";
import { LogoutPage } from "./pages/logout";
import { OAuthAccessDeniedPage } from "./pages/oauth-access-denied";
import { OAuthConsentPage } from "./pages/oauth-consent";
import { OAuthResumePage } from "./pages/oauth-resume";
import { RecoveryPage } from "./pages/recovery";
import { LoginPage } from "./pages/login";
import { PortalPage } from "./pages/portal";
import { ProfilePage } from "./pages/profile";
import { CredentialsPage } from "./pages/credentials";
import { RadiusPage } from "./pages/radius";
import { UnixCredentialPage } from "./pages/unix-credential";
import { SshKeysPage } from "./pages/ssh-keys";
import { EnrolPage } from "./pages/enrol";
import { AdminOverviewPage } from "./pages/admin/overview";
import { BrandingPage } from "./pages/admin/branding";
import { NewApplicationPage } from "./pages/admin/new-app";
import { NewGroupPage } from "./pages/admin/new-group";
import { NewPersonPage } from "./pages/admin/new-person";
import { RelationshipsPage } from "./pages/admin/relationships";
import { ApplicationsPage } from "./pages/admin/apps";
import { GroupsPage } from "./pages/admin/groups";
import { PeoplePage } from "./pages/admin/people";

const returnAfterLoginKey = "kanidm-dashboard-return-after-login";

type LoginMethod = "password" | "totp" | "backup" | "passkey" | "security-key";

function App() {
  return (
    <ConsoleProvider>
      <NavigationProvider>
        <AppRoutes />
      </NavigationProvider>
    </ConsoleProvider>
  );
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
