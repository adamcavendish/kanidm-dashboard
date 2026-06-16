import { createSignal, For, onMount, Show } from "solid-js";
import { AppWindow, ChevronRight } from "lucide-solid";
import type { UserAuthTokenStatus } from "../domain";
import { useConsole } from "../store";
import AppIcon from "../components/app-icon";
import GlassPanel from "../components/glass-panel";
import KeyValue from "../components/key-value";
import PageHeader from "../components/page-header";
import { CredentialMeter } from "../components/credential-meter";
import { EmptyState } from "../components/empty-state";
import { StatusBadge } from "../components/status-badge";
import { Link } from "../routing";
import { latestSessionLabel } from "../utils/format";

function AccountPanels() {
  const { currentUser, getUserAuthTokens } = useConsole();
  const [sessions, setSessions] = createSignal<UserAuthTokenStatus[]>([]);
  const [sessionStatus, setSessionStatus] = createSignal("Loading sessions");

  onMount(async () => {
    try {
      setSessions(await getUserAuthTokens());
      setSessionStatus("");
    } catch {
      setSessionStatus("Unavailable");
    }
  });

  const latestSession = () => sessionStatus() || latestSessionLabel(sessions());

  return (
    <>
      <GlassPanel title="Account">
        <KeyValue label="Username" value={currentUser().username} />
        <KeyValue label="Status" value={<StatusBadge status={currentUser().status} />} />
        <KeyValue label="Latest session" value={latestSession()} />
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

export function PortalPage() {
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
