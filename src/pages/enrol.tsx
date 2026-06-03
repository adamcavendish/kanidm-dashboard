import { createSignal, Show } from "solid-js";
import { CircleAlert, ClipboardCheck, QrCode } from "lucide-solid";
import type { CredentialUpdateIntent } from "../domain";
import { useConsole } from "../store";
import Checklist from "../components/checklist";
import GlassPanel from "../components/glass-panel";
import KeyValue from "../components/key-value";
import PageHeader from "../components/page-header";
import { formatDateTime } from "../utils/format";
export function EnrolPage() {
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
