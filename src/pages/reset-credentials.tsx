import { createSignal } from "solid-js";
import type { CredentialUpdateStatus } from "../domain";
import { useConsole } from "../store";
import ErrorBox from "../components/error-box";
import { AuthFrame } from "../components/auth-frame";
import { LogoMark } from "../components/logo-mark";
import { CredentialUpdateWorkbench } from "../components/credential-update-workbench";
import { Link } from "../routing";

export function ResetCredentialsPage() {
  const { exchangeCredentialUpdateIntent } = useConsole();
  const [token, setToken] = createSignal(
    new URLSearchParams(window.location.search).get("token") ?? "",
  );
  const [status, setStatus] = createSignal<CredentialUpdateStatus | null>(null);
  const [busy, setBusy] = createSignal("");
  const [error, setError] = createSignal("");
  const [workbenchMessageResetKey, setWorkbenchMessageResetKey] = createSignal(0);

  async function verifyToken() {
    setBusy("verify");
    setError("");
    try {
      setStatus(await exchangeCredentialUpdateIntent(token()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify reset token.");
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
              setError("");
              setWorkbenchMessageResetKey((value) => value + 1);
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
        <CredentialUpdateWorkbench
          status={status}
          setStatus={setStatus}
          messageResetKey={workbenchMessageResetKey}
        />
        <ErrorBox error={error} />
        <Link class="quiet-link" href="/login">
          Return to login
        </Link>
      </form>
    </AuthFrame>
  );
}
