import { createEffect, createMemo, createSignal, Show } from "solid-js";
import QRCode from "qrcode";
import { CircleAlert, ClipboardCheck } from "lucide-solid";
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
  const [qrCodeUrl, setQrCodeUrl] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");
  let qrRenderRequest = 0;
  const resetUrl = createMemo(() => {
    const issued = intent();
    if (!issued) return "";
    return `${window.location.origin}/reset?token=${encodeURIComponent(issued.token)}`;
  });

  createEffect(() => {
    const url = resetUrl();
    if (!url) {
      setQrCodeUrl("");
      return;
    }
    const requestId = ++qrRenderRequest;
    void QRCode.toDataURL(url, {
      errorCorrectionLevel: "M",
      margin: 2,
      scale: 8,
      color: {
        dark: "#111827",
        light: "#ffffff",
      },
    })
      .then((dataUrl) => {
        if (requestId === qrRenderRequest) setQrCodeUrl(dataUrl);
      })
      .catch(() => {
        if (requestId === qrRenderRequest) {
          setQrCodeUrl("");
          setError("Could not render enrolment QR code.");
        }
      });
  });

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
            <Show
              when={qrCodeUrl()}
              fallback={<span>Generate an intent to show the enrolment QR code.</span>}
            >
              {(src) => <img src={src()} alt="Credential update reset URL QR code" />}
            </Show>
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
                  <input readonly value={resetUrl()} />
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
