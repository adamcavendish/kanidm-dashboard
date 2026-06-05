import { createSignal, For, onMount, Show } from "solid-js";
import {
  BadgeCheck,
  CircleAlert,
  ClipboardCheck,
  Fingerprint,
  KeyRound,
  LaptopMinimal,
  QrCode,
  RefreshCw,
  RotateCcw,
  ServerCog,
  ShieldCheck,
  Smartphone,
  SquareAsterisk,
  Trash2,
} from "lucide-solid";
import type { CredentialUpdateStatus, PasskeyRegistration, UserAuthTokenStatus } from "../domain";
import { useConsole } from "../store";
import GlassPanel from "../components/glass-panel";
import PageHeader from "../components/page-header";
import { CredentialCard } from "../components/credential-card";
import { CredentialUpdateStatusPanel } from "../components/credential-update-status-panel";
import { Link, useNavigation } from "../routing";
import { rememberReturnAfterLogin } from "../auth-return";
import { KanidmHttpError } from "../kanidm-error";
import { credentialLabel, formatDateTime, sessionStateLabel, shortId } from "../utils/format";
import {
  createPasskeyRegistration,
  mockPasskeyRegistration,
  passkeyRegistrationHint,
} from "../utils/webauthn";

const credentialDeniedMessage =
  "Kanidm denied credential self-service for this account. Use an administrator-issued reset link.";

function isCredentialSelfServiceDenial(err: unknown) {
  if (err instanceof KanidmHttpError) {
    const body = err.responseBody.toLowerCase();
    const hasDenialBody =
      body.includes("notauthorised") ||
      body.includes("not authorised") ||
      body.includes("notauthorized");
    return err.status === 401 || err.status === 403 || (err.status === 500 && hasDenialBody);
  }

  const message = err instanceof Error ? err.message : "";
  const lower = message.toLowerCase();
  return (
    lower.includes("notauthorised") ||
    lower.includes("not authorised") ||
    lower.includes("notauthorized")
  );
}

function credentialSelfServiceError(err: unknown, fallback: string) {
  if (isCredentialSelfServiceDenial(err)) return credentialDeniedMessage;
  if (err instanceof KanidmHttpError) {
    return err.message || fallback;
  }

  const message = err instanceof Error ? err.message : "";
  if (message === "Response returned an error code") {
    return `${fallback} Kanidm returned an error for this account.`;
  }
  return message || fallback;
}

export function CredentialsPage() {
  const {
    config,
    currentUser,
    refreshSessionData,
    logout,
    getUserAuthTokens,
    deleteUserAuthToken,
    issueCredentialUpdateIntent,
    exchangeCredentialUpdateIntent,
    generateCredentialBackupCodes,
    removeCredentialBackupCodes,
    startCredentialPasskey,
    finishCredentialPasskey,
    removeCredentialPasskey,
    removeCredentialAttestedPasskey,
    commitCredentialUpdate,
    cancelCredentialUpdate,
  } = useConsole();
  const { path, navigate } = useNavigation();
  const [sessions, setSessions] = createSignal<UserAuthTokenStatus[]>([]);
  const [busySession, setBusySession] = createSignal("");
  const [sessionError, setSessionError] = createSignal("");
  const [credentialStatus, setCredentialStatus] = createSignal<CredentialUpdateStatus | null>(null);
  const [passkeyLabel, setPasskeyLabel] = createSignal("Portal passkey");
  const [passkeyRemoveId, setPasskeyRemoveId] = createSignal("");
  const [attestedPasskeyRemoveId, setAttestedPasskeyRemoveId] = createSignal("");
  const [credentialBusy, setCredentialBusy] = createSignal("");
  const [credentialMessage, setCredentialMessage] = createSignal("");
  const [credentialError, setCredentialError] = createSignal("");
  const [credentialSelfServiceDenied, setCredentialSelfServiceDenied] = createSignal(false);
  const credentialControlsLocked = () => Boolean(credentialBusy()) || credentialSelfServiceDenied();

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

  function syncCredentialControls(nextStatus: CredentialUpdateStatus) {
    setPasskeyRemoveId(nextStatus.passkeys[0]?.uuid ?? "");
    setAttestedPasskeyRemoveId(nextStatus.attestedPasskeys[0]?.uuid ?? "");
  }

  async function startSelfServiceUpdate(message = "Credential update session started.") {
    if (credentialSelfServiceDenied()) return null;
    setCredentialBusy("start");
    setCredentialMessage("");
    setCredentialError("");
    setCredentialSelfServiceDenied(false);
    try {
      const intent = await issueCredentialUpdateIntent(currentUser().id, 3600);
      const nextStatus = await exchangeCredentialUpdateIntent(intent.token);
      setCredentialStatus(nextStatus);
      syncCredentialControls(nextStatus);
      setCredentialMessage(message);
      return nextStatus;
    } catch (err) {
      setCredentialError(credentialSelfServiceError(err, "Could not start credential update."));
      setCredentialSelfServiceDenied(isCredentialSelfServiceDenial(err));
      return null;
    } finally {
      setCredentialBusy("");
    }
  }

  async function currentCredentialStatus() {
    return (
      credentialStatus() ??
      (await startSelfServiceUpdate(
        "Credential update session started. Review staged changes before committing.",
      ))
    );
  }

  async function generateBackupCodes() {
    const current = await currentCredentialStatus();
    if (!current) return;

    setCredentialBusy("backup-codes");
    setCredentialMessage("");
    setCredentialError("");
    try {
      const nextStatus = await generateCredentialBackupCodes(current.sessionToken);
      setCredentialStatus(nextStatus);
      syncCredentialControls(nextStatus);
      setCredentialSelfServiceDenied(false);
      setCredentialMessage("Backup codes staged. Store them securely, then commit.");
    } catch (err) {
      setCredentialError(credentialSelfServiceError(err, "Could not generate backup codes."));
    } finally {
      setCredentialBusy("");
    }
  }

  async function removeBackupCodes() {
    const current = await currentCredentialStatus();
    if (!current) return;

    setCredentialBusy("backup-code-remove");
    setCredentialMessage("");
    setCredentialError("");
    try {
      const nextStatus = await removeCredentialBackupCodes(current.sessionToken);
      setCredentialStatus(nextStatus);
      syncCredentialControls(nextStatus);
      setCredentialSelfServiceDenied(false);
      setCredentialMessage("Backup code removal staged. Review the update, then commit.");
    } catch (err) {
      setCredentialError(credentialSelfServiceError(err, "Could not remove backup codes."));
    } finally {
      setCredentialBusy("");
    }
  }

  async function startPasskey(kind: PasskeyRegistration["kind"]) {
    const current = await currentCredentialStatus();
    if (!current) return;

    setCredentialBusy(kind === "attested-passkey" ? "attested-passkey-start" : "passkey-start");
    setCredentialMessage("");
    setCredentialError("");
    try {
      const nextStatus = await startCredentialPasskey(current.sessionToken, kind);
      setCredentialStatus(nextStatus);
      syncCredentialControls(nextStatus);
      setCredentialSelfServiceDenied(false);
      setCredentialMessage(
        kind === "attested-passkey"
          ? "Attested passkey setup started. Complete browser registration before commit."
          : "Passkey setup started. Complete browser registration before commit.",
      );
    } catch (err) {
      setCredentialError(
        credentialSelfServiceError(
          err,
          kind === "attested-passkey"
            ? "Could not start attested passkey setup."
            : "Could not start passkey setup.",
        ),
      );
    } finally {
      setCredentialBusy("");
    }
  }

  async function finishPasskeyRegistration() {
    const current = credentialStatus();
    if (!current?.pendingPasskey) return;

    setCredentialBusy("passkey-finish");
    setCredentialMessage("");
    setCredentialError("");
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
      setCredentialStatus(nextStatus);
      syncCredentialControls(nextStatus);
      setCredentialSelfServiceDenied(false);
      setCredentialMessage(
        current.pendingPasskey.kind === "attested-passkey"
          ? "Attested passkey staged. Review the update, then commit."
          : "Passkey staged. Review the update, then commit.",
      );
    } catch (err) {
      setCredentialError(credentialSelfServiceError(err, "Could not register passkey."));
    } finally {
      setCredentialBusy("");
    }
  }

  async function removePasskey() {
    const current = credentialStatus();
    if (!current) return;

    setCredentialBusy("passkey-remove");
    setCredentialMessage("");
    setCredentialError("");
    try {
      const nextStatus = await removeCredentialPasskey(current.sessionToken, passkeyRemoveId());
      setCredentialStatus(nextStatus);
      syncCredentialControls(nextStatus);
      setCredentialSelfServiceDenied(false);
      setCredentialMessage("Passkey removal staged. Review the update, then commit.");
    } catch (err) {
      setCredentialError(credentialSelfServiceError(err, "Could not remove passkey."));
    } finally {
      setCredentialBusy("");
    }
  }

  async function removeAttestedPasskey() {
    const current = credentialStatus();
    if (!current) return;

    setCredentialBusy("attested-passkey-remove");
    setCredentialMessage("");
    setCredentialError("");
    try {
      const nextStatus = await removeCredentialAttestedPasskey(
        current.sessionToken,
        attestedPasskeyRemoveId(),
      );
      setCredentialStatus(nextStatus);
      syncCredentialControls(nextStatus);
      setCredentialSelfServiceDenied(false);
      setCredentialMessage("Attested passkey removal staged. Review the update, then commit.");
    } catch (err) {
      setCredentialError(credentialSelfServiceError(err, "Could not remove attested passkey."));
    } finally {
      setCredentialBusy("");
    }
  }

  async function commitSelfServiceUpdate() {
    const current = credentialStatus();
    if (!current) return;

    setCredentialBusy("commit");
    setCredentialMessage("");
    setCredentialError("");
    try {
      await commitCredentialUpdate(current.sessionToken);
      setCredentialStatus(null);
      setCredentialSelfServiceDenied(false);
      await refreshSessionData();
      setCredentialMessage("Credential update committed.");
      void loadSessions();
    } catch (err) {
      setCredentialError(credentialSelfServiceError(err, "Could not commit credential update."));
    } finally {
      setCredentialBusy("");
    }
  }

  async function cancelSelfServiceUpdate() {
    const current = credentialStatus();
    if (!current) return;

    setCredentialBusy("cancel");
    setCredentialMessage("");
    setCredentialError("");
    try {
      await cancelCredentialUpdate(current.sessionToken);
      setCredentialStatus(null);
      setCredentialSelfServiceDenied(false);
      setCredentialMessage("Credential update cancelled.");
    } catch (err) {
      setCredentialError(credentialSelfServiceError(err, "Could not cancel credential update."));
    } finally {
      setCredentialBusy("");
    }
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
          action="Manage"
          disabled={Boolean(credentialStatus()) || credentialControlsLocked()}
          onClick={() =>
            void startSelfServiceUpdate(
              "Credential update session started. Add or remove passkeys below.",
            )
          }
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
          disabled={credentialControlsLocked()}
          onClick={() => void generateBackupCodes()}
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
      <div class="credential-panel-stack">
        <GlassPanel title="Credential update">
          <Show
            when={credentialStatus()}
            fallback={
              <div class="field-grid">
                <p class="muted">
                  Start a short-lived credential update session to add or remove passkeys and
                  regenerate backup codes. Staged changes are not applied until you commit.
                </p>
                <div class="button-row">
                  <button
                    class="primary-action"
                    type="button"
                    disabled={credentialControlsLocked()}
                    onClick={() => void startSelfServiceUpdate()}
                  >
                    <ClipboardCheck size={16} />
                    {credentialBusy() === "start" ? "Starting update" : "Start credential update"}
                  </button>
                  <button
                    class="secondary-action"
                    type="button"
                    disabled={credentialControlsLocked()}
                    onClick={() => void generateBackupCodes()}
                  >
                    <SquareAsterisk size={16} />
                    {credentialBusy() === "backup-codes" ? "Generating codes" : "Regenerate codes"}
                  </button>
                </div>
              </div>
            }
          >
            {(verified) => (
              <>
                <CredentialUpdateStatusPanel status={verified()} />
                <div class="field-grid">
                  <Show when={verified().passkeys.length}>
                    <label>
                      Registered passkey
                      <select
                        aria-label="Registered passkey"
                        disabled={credentialControlsLocked()}
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
                      Registered attested passkey
                      <select
                        aria-label="Registered attested passkey"
                        disabled={credentialControlsLocked()}
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
                      disabled={credentialControlsLocked()}
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
                        credentialControlsLocked() ||
                        credentialBusy() === "passkey-start" ||
                        Boolean(verified().pendingPasskey)
                      }
                      onClick={() => void startPasskey("passkey")}
                    >
                      <Fingerprint size={16} />
                      {credentialBusy() === "passkey-start" ? "Starting passkey" : "Start passkey"}
                    </button>
                    <button
                      class="secondary-action"
                      type="button"
                      disabled={
                        credentialControlsLocked() ||
                        credentialBusy() === "attested-passkey-start" ||
                        Boolean(verified().pendingPasskey)
                      }
                      onClick={() => void startPasskey("attested-passkey")}
                    >
                      <Fingerprint size={16} />
                      {credentialBusy() === "attested-passkey-start"
                        ? "Starting attested passkey"
                        : "Start attested passkey"}
                    </button>
                    <button
                      class="secondary-action"
                      type="button"
                      disabled={
                        credentialControlsLocked() ||
                        credentialBusy() === "passkey-finish" ||
                        !verified().pendingPasskey ||
                        !passkeyLabel().trim()
                      }
                      onClick={() => void finishPasskeyRegistration()}
                    >
                      <ShieldCheck size={16} />
                      {credentialBusy() === "passkey-finish"
                        ? "Registering passkey"
                        : verified().pendingPasskey?.kind === "attested-passkey"
                          ? "Register attested passkey"
                          : "Register passkey"}
                    </button>
                    <button
                      class="danger-action"
                      type="button"
                      disabled={
                        credentialControlsLocked() ||
                        credentialBusy() === "passkey-remove" ||
                        !verified().passkeys.length ||
                        !passkeyRemoveId().trim()
                      }
                      onClick={() => void removePasskey()}
                    >
                      <Trash2 size={16} />
                      {credentialBusy() === "passkey-remove"
                        ? "Removing passkey"
                        : "Remove passkey"}
                    </button>
                    <button
                      class="danger-action"
                      type="button"
                      disabled={
                        credentialControlsLocked() ||
                        credentialBusy() === "attested-passkey-remove" ||
                        !verified().attestedPasskeys.length ||
                        !attestedPasskeyRemoveId().trim()
                      }
                      onClick={() => void removeAttestedPasskey()}
                    >
                      <Trash2 size={16} />
                      {credentialBusy() === "attested-passkey-remove"
                        ? "Removing attested passkey"
                        : "Remove attested passkey"}
                    </button>
                  </div>
                </div>
                <div class="field-grid">
                  <div class="button-row">
                    <button
                      class="secondary-action"
                      type="button"
                      disabled={credentialControlsLocked()}
                      onClick={() => void generateBackupCodes()}
                    >
                      <SquareAsterisk size={16} />
                      {credentialBusy() === "backup-codes"
                        ? "Generating codes"
                        : "Regenerate backup codes"}
                    </button>
                    <button
                      class="danger-action"
                      type="button"
                      disabled={credentialControlsLocked()}
                      onClick={() => void removeBackupCodes()}
                    >
                      <Trash2 size={16} />
                      {credentialBusy() === "backup-code-remove"
                        ? "Removing codes"
                        : "Remove backup codes"}
                    </button>
                  </div>
                  <Show when={verified().pendingBackupCodes.length}>
                    <div class="code-grid" aria-label="Generated backup codes">
                      <For each={verified().pendingBackupCodes}>
                        {(code) => <code>{code}</code>}
                      </For>
                    </div>
                  </Show>
                </div>
                <div class="button-row">
                  <button
                    class="primary-action"
                    type="button"
                    disabled={!verified().canCommit || credentialControlsLocked()}
                    onClick={() => void commitSelfServiceUpdate()}
                  >
                    <ClipboardCheck size={16} />
                    {credentialBusy() === "commit" ? "Committing" : "Commit credential update"}
                  </button>
                  <button
                    class="danger-action"
                    type="button"
                    disabled={credentialControlsLocked()}
                    onClick={() => void cancelSelfServiceUpdate()}
                  >
                    <RotateCcw size={16} />
                    {credentialBusy() === "cancel" ? "Cancelling" : "Cancel update"}
                  </button>
                </div>
              </>
            )}
          </Show>
          <Show when={credentialMessage()}>
            <div class="review-box success" role="status" aria-live="polite">
              <BadgeCheck size={18} />
              <span>{credentialMessage()}</span>
            </div>
          </Show>
          <Show when={credentialError()}>
            <div class="review-box danger" role="alert" aria-live="assertive">
              <CircleAlert size={18} />
              <span>{credentialError()}</span>
            </div>
          </Show>
        </GlassPanel>
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
            <div class="review-box danger" role="alert" aria-live="assertive">
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
      </div>
    </>
  );
}
