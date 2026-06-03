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
  const {
    state,
    getPeopleForGroup,
    deleteGroup,
    updateGroup,
    addGroupMembers,
    removeGroupMembers,
  } = useConsole();
  const { navigate } = useNavigation();
  const [selectedGroupId, setSelectedGroupId] = createSignal(state().groups[0]?.id ?? "");
  const [editDisplayName, setEditDisplayName] = createSignal("");
  const [editDescription, setEditDescription] = createSignal("");
  const [editManagedBy, setEditManagedBy] = createSignal("");
  const [editParentGroups, setEditParentGroups] = createSignal<string[]>([]);
  const [editMembers, setEditMembers] = createSignal<string[]>([]);
  const [editing, setEditing] = createSignal(false);
  const [deleting, setDeleting] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");
  const selectedGroup = () =>
    state().groups.find((group) => group.id === selectedGroupId()) ?? state().groups[0];
  const selectedGroupClosure = () => resolveGroupClosure([selectedGroup().id], state().groups);
  const appsUsingGroup = () =>
    state().apps.filter((app) =>
      app.allowedGroups.some((groupId) => selectedGroupClosure().includes(groupId)),
    );

  createEffect(() => {
    const g = selectedGroup();
    if (g) {
      setEditDisplayName(g.displayName);
      setEditDescription(g.description);
      setEditManagedBy(state().groups.find((p) => p.id === g.managedBy)?.name ?? "");
      setEditParentGroups([...g.parentGroups]);
      setEditMembers([...g.members]);
      setEditing(false);
      setDeleting(false);
      setError("");
    }
  });

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
            <Show
              when={editing()}
              fallback={
                <>
                  <KeyValue label="Display name" value={selectedGroup().displayName} />
                  <KeyValue
                    label="Managed by"
                    value={labelForGroup(state().groups, selectedGroup().managedBy) || "None"}
                  />
                  <KeyValue
                    label="Apps unlocked"
                    value={
                      appsUsingGroup()
                        .map((app) => app.displayName)
                        .join(", ") || "None"
                    }
                  />
                  <p class="muted">{selectedGroup().description || "No description"}</p>
                  <ErrorBox error={error} />
                  <div class="button-row">
                    <button class="secondary-action" type="button" onClick={() => setEditing(true)}>
                      Edit
                    </button>
                    <Show when={!deleting()}>
                      <button class="danger-action" type="button" onClick={() => setDeleting(true)}>
                        <Trash2 size={14} /> Delete group
                      </button>
                    </Show>
                    <Show when={deleting()}>
                      <span class="muted">Confirm delete?</span>
                      <button
                        class="danger-action"
                        type="button"
                        disabled={busy()}
                        onClick={async () => {
                          setBusy(true);
                          setError("");
                          try {
                            await deleteGroup(selectedGroup().id, selectedGroup().name);
                            navigate("/admin/groups");
                          } catch (err) {
                            setError(
                              err instanceof Error ? err.message : "Could not delete group.",
                            );
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        {busy() ? "Deleting…" : "Yes, delete"}
                      </button>
                      <button
                        class="secondary-action"
                        type="button"
                        disabled={busy()}
                        onClick={() => setDeleting(false)}
                      >
                        Cancel
                      </button>
                    </Show>
                  </div>
                </>
              }
            >
              <div class="field-stack">
                <TextField
                  label="Display name"
                  value={editDisplayName()}
                  onInput={setEditDisplayName}
                />
                <ErrorBox error={error} />
                <label>
                  Description
                  <textarea
                    rows={3}
                    value={editDescription()}
                    onInput={(e) => setEditDescription(e.currentTarget.value)}
                  />
                </label>
                <label>
                  Managed by
                  <select
                    value={editManagedBy()}
                    onChange={(e) => setEditManagedBy(e.currentTarget.value)}
                  >
                    <option value="">None</option>
                    <For each={state().groups.filter((g) => g.id !== selectedGroup().id)}>
                      {(g) => <option value={g.name}>{g.displayName}</option>}
                    </For>
                  </select>
                </label>
              </div>
            </Show>
          </GlassPanel>

          <Show when={editing()}>
            <GlassPanel title="Parent groups">
              <div class="option-grid">
                <For each={state().groups.filter((g) => g.id !== selectedGroup().id)}>
                  {(parent) => {
                    const isParent = () => editParentGroups().includes(parent.id);
                    return (
                      <button
                        class={isParent() ? "option-card selected" : "option-card"}
                        type="button"
                        onClick={() => {
                          const adding = !isParent();
                          setEditParentGroups(
                            adding
                              ? [...editParentGroups(), parent.id]
                              : editParentGroups().filter((id) => id !== parent.id),
                          );
                        }}
                      >
                        <span>
                          <Show when={isParent()} fallback={<Plus size={16} />}>
                            <Check size={16} />
                          </Show>
                        </span>
                        <strong>{parent.displayName}</strong>
                        <small>{parent.name}</small>
                      </button>
                    );
                  }}
                </For>
              </div>
            </GlassPanel>
          </Show>

          <GlassPanel title="Members">
            <div class="member-grid">
              <For each={state().people}>
                {(person) => {
                  const isDirectMember = () =>
                    editing()
                      ? editMembers().some((ref) => ref === person.id || ref.includes(person.id))
                      : selectedGroup().members.some(
                          (ref) =>
                            ref === person.id ||
                            ref === person.username ||
                            ref.includes(person.id) ||
                            ref.includes(person.username),
                        );
                  const isInheritedMember = () =>
                    !isDirectMember() &&
                    getPeopleForGroup(selectedGroup().id).some((m) => m.id === person.id);
                  const inheritedFrom = () => {
                    if (!isInheritedMember()) return "";
                    const parent = state().groups.find(
                      (g) =>
                        g.id !== selectedGroup().id &&
                        g.members.some((ref) => ref === person.id || ref.includes(person.id)) &&
                        getPeopleForGroup(selectedGroup().id).some((m) => m.id === person.id),
                    );
                    return parent ? `Inherited from ${parent.displayName}` : "Inherited";
                  };
                  return (
                    <button
                      class={
                        isDirectMember()
                          ? "member-pill selected"
                          : isInheritedMember()
                            ? "member-pill inherited"
                            : "member-pill"
                      }
                      type="button"
                      disabled={!editing()}
                      onClick={() => {
                        if (!editing()) return;
                        const adding = !isDirectMember();
                        setEditMembers(
                          adding
                            ? [...editMembers(), person.id]
                            : editMembers().filter((id) => id !== person.id),
                        );
                      }}
                    >
                      <span class="avatar">{initials(person.displayName)}</span>
                      {person.displayName}
                      <Show when={isDirectMember()}>
                        <small class="member-kind">Direct</small>
                      </Show>
                      <Show when={isInheritedMember()}>
                        <small class="member-kind">{inheritedFrom()}</small>
                      </Show>
                      <Show when={editing() && !isDirectMember()}>
                        <Plus size={14} />
                      </Show>
                      <Show when={editing() && isDirectMember()}>
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

          <Show when={editing()}>
            <div class="edit-toolbar">
              <button
                class="primary-action"
                type="button"
                disabled={busy()}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    const g = selectedGroup();
                    const patch: Partial<Pick<Group, "displayName" | "description" | "managedBy">> =
                      {};
                    if (editDisplayName() !== g.displayName) {
                      patch.displayName = editDisplayName();
                    }
                    if (editDescription() !== g.description) {
                      patch.description = editDescription();
                    }
                    const origManagedByName =
                      state().groups.find((p) => p.id === g.managedBy)?.name ?? "";
                    if (editManagedBy() !== origManagedByName) {
                      patch.managedBy = editManagedBy();
                    }
                    if (Object.keys(patch).length > 0) {
                      await updateGroup(g.id, g.name, patch);
                    }
                    const prevParents = new Set(g.parentGroups);
                    const nextParents = new Set(editParentGroups());
                    for (const added of editParentGroups()) {
                      if (!prevParents.has(added)) {
                        const parent = state().groups.find((p) => p.id === added);
                        if (parent) await addGroupMembers(parent.name, [g.name]);
                      }
                    }
                    for (const removed of g.parentGroups) {
                      if (!nextParents.has(removed)) {
                        const parent = state().groups.find((p) => p.id === removed);
                        if (parent) await removeGroupMembers(parent.name, [g.name]);
                      }
                    }
                    for (const added of editMembers()) {
                      if (!g.members.some((m) => m === added || m.includes(added))) {
                        await addGroupMembers(g.name, [added]);
                      }
                    }
                    for (const removed of g.members) {
                      if (!editMembers().some((m) => m === removed || m.includes(removed))) {
                        await removeGroupMembers(g.name, [removed]);
                      }
                    }
                    setEditing(false);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Could not update group.");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy() ? "Saving…" : "Save"}
              </button>
              <button
                class="secondary-action"
                type="button"
                disabled={busy()}
                onClick={() => setEditing(false)}
              >
                Cancel
              </button>
            </div>
          </Show>
        </div>
      </div>
    </>
  );
}

function ApplicationsPage() {
  const { state, config, uploadAppImage, resetAppImage, updateApplication, deleteApplication } =
    useConsole();
  const { navigate } = useNavigation();
  const [query, setQuery] = createSignal("");
  const [selectedAppId, setSelectedAppId] = createSignal(state().apps[0]?.id ?? "");
  const [editDisplayName, setEditDisplayName] = createSignal("");
  const [editLandingUrl, setEditLandingUrl] = createSignal("");
  const [editRedirectText, setEditRedirectText] = createSignal("");
  const [editAllowedGroups, setEditAllowedGroups] = createSignal<string[]>([]);
  const [editScopeMaps, setEditScopeMaps] = createSignal<ApplicationScopeMap[]>([]);
  const [editing, setEditing] = createSignal(false);
  const [deleting, setDeleting] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");
  const [imageBusy, setImageBusy] = createSignal(false);
  const [imageError, setImageError] = createSignal("");
  const [customScope, setCustomScope] = createSignal("");

  const apps = () => state().apps.filter((app) => searchable(app).includes(query().toLowerCase()));
  const selectedApp = () =>
    state().apps.find((app) => app.id === selectedAppId()) ?? state().apps[0];

  const editRedirectUris = () =>
    editRedirectText()
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

  const scopesForEditingGroup = (groupId: string) =>
    editScopeMaps().find((sm) => sm.groupId === groupId)?.scopes ?? [];

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

  createEffect(() => {
    const app = selectedApp();
    if (app) {
      setEditDisplayName(app.displayName);
      setEditLandingUrl(app.landingUrl);
      setEditRedirectText(app.redirectUris.join("\n"));
      setEditAllowedGroups([...app.allowedGroups]);
      setEditScopeMaps(structuredClone(app.scopeMaps ?? []));
      setEditing(false);
      setDeleting(false);
      setError("");
      setImageError("");
    }
  });

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

    setImageBusy(true);
    setImageError("");
    try {
      await uploadAppImage(app.id, file);
      input.value = "";
    } catch (err) {
      setImageError(err instanceof Error ? err.message : "Could not upload application image.");
    } finally {
      setImageBusy(false);
    }
  }

  async function handleResetAppImage(app: Application) {
    setImageBusy(true);
    setImageError("");
    try {
      await resetAppImage(app.id);
    } catch (err) {
      setImageError(err instanceof Error ? err.message : "Could not reset application image.");
    } finally {
      setImageBusy(false);
    }
  }

  function toggleAccessGroup(groupId: string) {
    const nextGroups = toggleValue(editAllowedGroups(), groupId);
    setEditAllowedGroups(nextGroups);
    setEditScopeMaps(editScopeMaps().filter((sm) => nextGroups.includes(sm.groupId)));
  }

  function toggleGroupScope(groupId: string, scope: string) {
    const currentScopes = scopesForEditingGroup(groupId);
    const nextScopes = toggleValue(currentScopes, scope);
    if (nextScopes.length === 0) return;
    const existing = editScopeMaps().find((sm) => sm.groupId === groupId);
    if (existing) {
      setEditScopeMaps(
        editScopeMaps().map((sm) => (sm.groupId === groupId ? { ...sm, scopes: nextScopes } : sm)),
      );
    } else {
      setEditScopeMaps([...editScopeMaps(), { groupId, scopes: nextScopes }]);
    }
  }

  function addCustomScopeToGroup(groupId: string) {
    const scope = customScope().trim();
    if (!scope) return;
    toggleGroupScope(groupId, scope);
    setCustomScope("");
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
      <div class="split-admin">
        <div class="resource-list">
          <For each={apps()}>
            {(app) => (
              <button
                class={app.id === selectedApp()?.id ? "resource-row active" : "resource-row"}
                type="button"
                onClick={() => setSelectedAppId(app.id)}
              >
                <AppIcon app={app} />
                <span>
                  <strong>{app.displayName}</strong>
                  <small>{app.name}</small>
                </span>
                <AppStatusBadge status={app.status} />
              </button>
            )}
          </For>
        </div>
        <div class="resource-detail">
          <GlassPanel title={selectedApp()?.displayName ?? "Application"}>
            <KeyValue label="System name" value={selectedApp()?.name ?? ""} variant="detail" />
            <KeyValue
              label="Client type"
              value={selectedApp()?.clientType ?? ""}
              variant="detail"
            />
            <Show
              when={editing()}
              fallback={
                <>
                  <KeyValue
                    label="Display name"
                    value={selectedApp()?.displayName ?? ""}
                    variant="detail"
                  />
                  <KeyValue
                    label="Landing URL"
                    value={selectedApp()?.landingUrl ?? ""}
                    variant="detail"
                  />
                  <KeyValue
                    label="Redirect URIs"
                    value={
                      selectedApp()?.redirectUris.length
                        ? selectedApp()!.redirectUris.join(", ")
                        : "None"
                    }
                    variant="detail"
                  />
                  <KeyValue
                    label="Access groups"
                    value={
                      selectedApp()
                        ?.allowedGroups.map((groupId) => labelForGroup(state().groups, groupId))
                        .join(", ") || "None"
                    }
                    variant="detail"
                  />
                  <KeyValue
                    label="Status"
                    value={<AppStatusBadge status={selectedApp()?.status ?? "attention"} />}
                    variant="detail"
                  />
                  <Show when={selectedApp()?.scopeMaps?.length}>
                    <div class="scope-map-summary">
                      <h4>Scope maps</h4>
                      <For each={selectedApp()?.scopeMaps ?? []}>
                        {(scopeMap) => (
                          <div class="scope-map-summary-row">
                            <strong>{labelForGroup(state().groups, scopeMap.groupId)}</strong>
                            <div class="chip-row">
                              <For each={scopeMap.scopes}>
                                {(scope) => <span class="chip">{scope}</span>}
                              </For>
                            </div>
                          </div>
                        )}
                      </For>
                    </div>
                  </Show>
                  <div class="detail-actions">
                    <div class="detail-action-row image-action-row">
                      <label class="file-button compact-file">
                        <Upload size={15} /> Upload image
                        <input
                          type="file"
                          accept=".png,.jpg,.jpeg,.gif,.svg,.webp"
                          disabled={imageBusy()}
                          onChange={(event) => {
                            const app = selectedApp();
                            if (app) void handleAppImageUpload(app, event);
                          }}
                        />
                      </label>
                      <button
                        class="secondary-action"
                        type="button"
                        disabled={imageBusy()}
                        onClick={() => {
                          const app = selectedApp();
                          if (app) void handleResetAppImage(app);
                        }}
                      >
                        <Trash2 size={15} /> Reset image
                      </button>
                      <Show when={imageBusy()}>
                        <small>Saving image</small>
                      </Show>
                    </div>
                    <ErrorBox error={error} />
                    <div class="detail-action-row">
                      <button
                        class="secondary-action"
                        type="button"
                        onClick={() => setEditing(true)}
                      >
                        Edit
                      </button>
                      <Show when={!deleting()}>
                        <button
                          class="danger-action"
                          type="button"
                          onClick={() => setDeleting(true)}
                        >
                          <Trash2 size={14} /> Delete application
                        </button>
                      </Show>
                      <Show when={deleting()}>
                        <span class="muted">Confirm delete?</span>
                        <button
                          class="danger-action"
                          type="button"
                          disabled={busy()}
                          onClick={async () => {
                            setBusy(true);
                            setError("");
                            try {
                              await deleteApplication(selectedApp()!.id);
                              navigate("/admin/apps");
                            } catch (err) {
                              setError(
                                err instanceof Error
                                  ? err.message
                                  : "Could not delete application.",
                              );
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          {busy() ? "Deleting…" : "Yes, delete"}
                        </button>
                        <button
                          class="secondary-action"
                          type="button"
                          disabled={busy()}
                          onClick={() => setDeleting(false)}
                        >
                          Cancel
                        </button>
                      </Show>
                    </div>
                  </div>
                </>
              }
            >
              <div class="field-stack">
                <TextField
                  label="Display name"
                  value={editDisplayName()}
                  onInput={setEditDisplayName}
                />
                <TextField
                  label="Landing URL"
                  value={editLandingUrl()}
                  onInput={setEditLandingUrl}
                  type="url"
                />
                <ErrorBox error={error} />
                <label>
                  Redirect URIs
                  <textarea
                    rows={4}
                    value={editRedirectText()}
                    onInput={(e) => setEditRedirectText(e.currentTarget.value)}
                    placeholder="https://app.example/oauth/callback"
                  />
                </label>
              </div>
            </Show>
          </GlassPanel>

          <Show when={editing()}>
            <GlassPanel title="Access groups and scopes">
              <div class="option-grid">
                <For each={state().groups}>
                  {(group) => {
                    const selected = () => editAllowedGroups().includes(group.id);
                    return (
                      <button
                        class={selected() ? "option-card selected" : "option-card"}
                        type="button"
                        onClick={() => toggleAccessGroup(group.id)}
                      >
                        <span>
                          <Show when={selected()} fallback={<Plus size={16} />}>
                            <Check size={16} />
                          </Show>
                        </span>
                        <strong>{group.displayName}</strong>
                        <small>{group.name}</small>
                      </button>
                    );
                  }}
                </For>
              </div>

              <Show when={editAllowedGroups().length > 0}>
                <h4>Scopes per group</h4>
                <For each={editAllowedGroups()}>
                  {(groupId) => (
                    <div class="scope-map-editor">
                      <strong>{labelForGroup(state().groups, groupId)}</strong>
                      <div class="scope-toggle-row">
                        <For each={standardScopes}>
                          {(scope) => {
                            const active = () => scopesForEditingGroup(groupId).includes(scope);
                            return (
                              <button
                                class={active() ? "scope-toggle selected" : "scope-toggle"}
                                type="button"
                                onClick={() => toggleGroupScope(groupId, scope)}
                              >
                                {scope}
                              </button>
                            );
                          }}
                        </For>
                        <For each={extraScopes()}>
                          {(scope) => {
                            const active = () => scopesForEditingGroup(groupId).includes(scope);
                            return (
                              <button
                                class={active() ? "scope-toggle selected" : "scope-toggle"}
                                type="button"
                                onClick={() => toggleGroupScope(groupId, scope)}
                              >
                                {scope}
                              </button>
                            );
                          }}
                        </For>
                      </div>
                      <div class="custom-scope-row">
                        <input
                          type="text"
                          placeholder="Custom scope name"
                          value={customScope()}
                          onInput={(e) => setCustomScope(e.currentTarget.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addCustomScopeToGroup(groupId);
                            }
                          }}
                        />
                        <button
                          class="secondary-action"
                          type="button"
                          onClick={() => addCustomScopeToGroup(groupId)}
                        >
                          <Plus size={14} /> Add
                        </button>
                      </div>
                    </div>
                  )}
                </For>
              </Show>
            </GlassPanel>
          </Show>

          <Show when={editing()}>
            <div class="edit-toolbar">
              <button
                class="primary-action"
                type="button"
                disabled={busy()}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    const app = selectedApp();
                    if (!app) return;

                    const patch: ApplicationPatch = {};
                    if (editDisplayName() !== app.displayName) {
                      patch.displayName = editDisplayName();
                    }
                    if (editLandingUrl() !== app.landingUrl) {
                      patch.landingUrl = editLandingUrl();
                    }
                    const newRedirectUris = editRedirectUris();
                    const redirectsChanged =
                      newRedirectUris.length !== app.redirectUris.length ||
                      newRedirectUris.some((uri, i) => uri !== app.redirectUris[i]);
                    if (redirectsChanged) {
                      patch.redirectUris = newRedirectUris;
                    }

                    if (Object.keys(patch).length > 0) {
                      await updateApplication(app.id, patch);
                    }

                    // Handle scope map changes (Kanidm mode only)
                    if (config().dataSource.mode === "kanidm") {
                      const nextGroupIds = new Set(editAllowedGroups());
                      const groupNames = new Map(state().groups.map((g) => [g.id, g.name]));

                      const ds = new KanidmDataSource(
                        config().dataSource,
                        sessionStorage.getItem("kanidm-dashboard-kanidm-token") ?? undefined,
                      );

                      // Remove scope maps for deselected groups
                      for (const removed of app.allowedGroups) {
                        if (!nextGroupIds.has(removed)) {
                          const groupName = groupNames.get(removed) ?? removed;
                          await ds.deleteOAuth2ApplicationScopeMap(app.name, groupName);
                        }
                      }

                      // Add/update scope maps for selected groups
                      for (const groupId of editAllowedGroups()) {
                        const groupName = groupNames.get(groupId) ?? groupId;
                        const editSM = editScopeMaps().find((sm) => sm.groupId === groupId);
                        const origSM = app.scopeMaps?.find((sm) => sm.groupId === groupId);
                        const newScopes = editSM?.scopes ?? [];
                        const oldScopes = origSM?.scopes ?? [];

                        const scopesChanged =
                          newScopes.length !== oldScopes.length ||
                          newScopes.some((s, i) => s !== oldScopes[i]);

                        if (!origSM || scopesChanged) {
                          await ds.updateOAuth2ApplicationScopeMap(app.name, groupName, newScopes);
                        }
                      }
                    }

                    setEditing(false);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Could not save application.");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy() ? "Saving…" : "Save changes"}
              </button>
              <button
                class="secondary-action"
                type="button"
                disabled={busy()}
                onClick={() => {
                  setEditing(false);
                  const app = selectedApp();
                  if (app) {
                    setEditDisplayName(app.displayName);
                    setEditLandingUrl(app.landingUrl);
                    setEditRedirectText(app.redirectUris.join("\n"));
                    setEditAllowedGroups([...app.allowedGroups]);
                    setEditScopeMaps(structuredClone(app.scopeMaps ?? []));
                  }
                }}
              >
                Cancel
              </button>
            </div>
          </Show>
        </div>
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
      setDraft((previous) => ({
        ...previous,
        companyName: branding().companyName,
      }));
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
                      setDraft((previous) => ({
                        ...previous,
                        logoUrl: branding().logoUrl,
                      })),
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
                setInput({
                  ...input(),
                  groups: toggleValue(input().groups, groupId),
                })
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
                  setInput({
                    ...input(),
                    status: event.currentTarget.value as UserStatus,
                  })
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
      navigate("/admin/groups");
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
                  setInput({
                    ...input(),
                    description: event.currentTarget.value,
                  })
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
                setInput({
                  ...input(),
                  members: toggleValue(input().members, personId),
                })
              }
            />
          </GlassPanel>
          <GlassPanel title="Parent groups">
            <OptionGrid
              options={state().groups.map((group) => ({
                id: group.id,
                label: group.displayName,
                detail: group.name,
              }))}
              selected={input().parentGroups}
              onToggle={(groupId) =>
                setInput({
                  ...input(),
                  parentGroups: toggleValue(input().parentGroups, groupId),
                })
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
            `Attach ${input().parentGroups.length} parent group${input().parentGroups.length === 1 ? "" : "s"}`,
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
    const appInput = {
      ...input(),
      redirectUris: redirectUris(),
      scopeMaps: effectiveScopeMaps(),
    };
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
                  setInput({
                    ...input(),
                    scopes: toggleValue(input().scopes, scope),
                  })
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
                          <For each={input().scopes}>
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
