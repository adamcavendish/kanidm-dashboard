import { createSignal, For, onMount, Show } from "solid-js";
import {
  CircleAlert,
  Fingerprint,
  KeyRound,
  LaptopMinimal,
  QrCode,
  RefreshCw,
  ServerCog,
  Smartphone,
  SquareAsterisk,
  Trash2,
} from "lucide-solid";
import type { UserAuthTokenStatus } from "../domain";
import { useConsole } from "../store";
import GlassPanel from "../components/glass-panel";
import PageHeader from "../components/page-header";
import { CredentialCard } from "../components/credential-card";
import { Link, useNavigation } from "../routing";
import { rememberReturnAfterLogin } from "../auth-return";
import { credentialLabel, formatDateTime, sessionStateLabel, shortId } from "../utils/format";
export function CredentialsPage() {
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
    rememberReturnAfterLogin(path());
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
