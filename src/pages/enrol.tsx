import { createSignal, Show } from "solid-js";
import { CircleAlert, ClipboardCheck, KeyRound } from "lucide-solid";
import type { CredentialUpdateStatus } from "../domain";
import { useConsole } from "../store";
import { CredentialUpdateWorkbench } from "../components/credential-update-workbench";
import GlassPanel from "../components/glass-panel";
import PageHeader from "../components/page-header";

export function EnrolPage() {
  const { currentUser, beginCredentialUpdate } = useConsole();
  const [status, setStatus] = createSignal<CredentialUpdateStatus | null>(null);
  const [busy, setBusy] = createSignal(false);
  const [message, setMessage] = createSignal("");
  const [error, setError] = createSignal("");

  async function startUpdate() {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      setStatus(await beginCredentialUpdate(currentUser().id));
      setMessage("Credential update session started.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start credential update.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader eyebrow="Self-service" title="Credential update" />
      <GlassPanel title="Update credentials">
        <Show when={!status()}>
          <div class="field-grid">
            <p class="muted">
              Start a short-lived credential update session to update password, passkeys, TOTP, Unix
              credential, backup codes, or SSH public keys. Staged changes are not applied until you
              commit.
            </p>
            <button
              class="primary-action"
              type="button"
              disabled={busy()}
              onClick={() => void startUpdate()}
            >
              <ClipboardCheck size={16} />
              {busy() ? "Starting update" : "Start credential update"}
            </button>
          </div>
        </Show>
        <Show when={message() && status()}>
          <div class="review-box success" role="status" aria-live="polite">
            <KeyRound size={18} />
            <span>{message()}</span>
          </div>
        </Show>
        <CredentialUpdateWorkbench status={status} setStatus={setStatus} />
        <Show when={error()}>
          <div class="review-box danger" role="alert" aria-live="assertive">
            <CircleAlert size={18} />
            <span>{error()}</span>
          </div>
        </Show>
      </GlassPanel>
    </>
  );
}
