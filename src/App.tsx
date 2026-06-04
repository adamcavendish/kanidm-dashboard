import { createEffect, createMemo, Show } from "solid-js";
import type { ParentProps } from "solid-js";
import {
  AppWindow,
  Brush,
  CircleUserRound,
  GitBranch,
  KeyRound,
  LayoutDashboard,
  Link as LinkIcon,
  LogOut,
  Moon,
  ServerCog,
  ShieldCheck,
  Sun,
  UsersRound,
} from "lucide-solid";
import { ConsoleProvider, useConsole } from "./store";
import { AuthFrame } from "./components/auth-frame";
import { LogoMark } from "./components/logo-mark";
import { isPublicRoute } from "./route-paths";
import { Link, NavLink, NavigationProvider, useNavigation } from "./routing";
import { initials } from "./utils/format";
import { LoginPage } from "./pages/login";
import { LogoutPage } from "./pages/logout";
import { OAuthAccessDeniedPage } from "./pages/oauth-access-denied";
import { OAuthConsentPage } from "./pages/oauth-consent";
import { OAuthResumePage } from "./pages/oauth-resume";
import { RecoveryPage } from "./pages/recovery";
import { ResetCredentialsPage } from "./pages/reset-credentials";
import { CredentialsPage } from "./pages/credentials";
import { EnrolPage } from "./pages/enrol";
import { PortalPage } from "./pages/portal";
import { ProfilePage } from "./pages/profile";
import { RadiusPage } from "./pages/radius";
import { SshKeysPage } from "./pages/ssh-keys";
import { UnixCredentialPage } from "./pages/unix-credential";
import { AdminOverviewPage } from "./pages/admin/overview";
import { ApplicationsPage } from "./pages/admin/apps";
import { BrandingPage } from "./pages/admin/branding";
import { GroupsPage } from "./pages/admin/groups";
import { NewApplicationPage } from "./pages/admin/new-app";
import { NewGroupPage } from "./pages/admin/new-group";
import { NewPersonPage } from "./pages/admin/new-person";
import { NewServiceAccountPage } from "./pages/admin/new-service-account";
import { PeoplePage } from "./pages/admin/people";
import { RelationshipsPage } from "./pages/admin/relationships";
import { ServiceAccountsPage } from "./pages/admin/service-accounts";

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
    if (currentPath === "/admin/service-accounts") return <ServiceAccountsPage />;
    if (currentPath === "/admin/service-accounts/new") return <NewServiceAccountPage />;
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
      <NavLink href="/admin/service-accounts">
        <ServerCog size={17} /> Service accounts
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

export default App;
