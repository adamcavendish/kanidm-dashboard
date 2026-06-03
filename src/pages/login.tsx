import { createEffect, createSignal, For, Show } from "solid-js";
import { ArrowRight, Fingerprint, KeyRound } from "lucide-solid";
import type { Role } from "../domain";
import { useConsole } from "../store";
import ErrorBox from "../components/error-box";
import { AuthFrame } from "../components/auth-frame";
import { LogoMark } from "../components/logo-mark";
import { Link, useNavigation } from "../routing";
import { consumeReturnAfterLoginPath } from "../auth-return";
import { createPasskeyAssertion, mockPasskeyAssertion } from "../utils/webauthn";
import { mechanismCopy, methodLabel } from "../utils/format";

type LoginMethod = "password" | "totp" | "backup" | "passkey" | "security-key";

export function LoginPage() {
  const {
    branding,
    config,
    configReady,
    loginWithPassword,
    startPasskeyLogin,
    finishPasskeyLogin,
    startSecurityKeyLogin,
    finishSecurityKeyLogin,
  } = useConsole();
  const { navigate } = useNavigation();
  const [role, setSelectedRole] = createSignal<Role>("admin");
  const [method, setMethod] = createSignal<LoginMethod>("password");
  const [username, setUsername] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [totpCode, setTotpCode] = createSignal("");
  const [backupCode, setBackupCode] = createSignal("");
  const [error, setError] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const enabledMethod = () =>
    method() === "password" ||
    method() === "totp" ||
    method() === "backup" ||
    method() === "passkey" ||
    method() === "security-key";
  const canSubmit = () => {
    if (!configReady() || busy() || !enabledMethod() || !username().trim()) {
      return false;
    }
    if (method() === "passkey") return true;
    if (!password().trim()) return false;
    if (method() === "totp") return Boolean(totpCode().trim());
    if (method() === "backup") return Boolean(backupCode().trim());
    return true;
  };

  createEffect(() => {
    if (!configReady() || config().dataSource.mode !== "mock") return;
    if (!username().trim()) setUsername(role() === "admin" ? "ava" : "mika");
    if (!password().trim()) setPassword("correct horse battery staple");
  });

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!canSubmit()) return;
    setBusy(true);
    setError("");
    try {
      if (method() === "passkey") {
        const challenge = await startPasskeyLogin(username(), role() === "admin");
        const assertion =
          config().dataSource.mode === "mock"
            ? mockPasskeyAssertion()
            : await createPasskeyAssertion(challenge.challenge);
        await finishPasskeyLogin(challenge, assertion);
      } else if (method() === "security-key") {
        const challenge = await startSecurityKeyLogin(username(), role() === "admin");
        const assertion =
          config().dataSource.mode === "mock"
            ? mockPasskeyAssertion()
            : await createPasskeyAssertion(challenge.challenge);
        await finishSecurityKeyLogin(challenge, assertion, password());
      } else {
        await loginWithPassword(username(), password(), role() === "admin", {
          method: method() === "totp" ? "totp" : method() === "backup" ? "backup" : "password",
          totpCode: totpCode(),
          backupCode: backupCode(),
        });
      }
      navigate(consumeReturnAfterLoginPath());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame>
      <form class="auth-card" onSubmit={submit}>
        <div class="auth-brand">
          <LogoMark />
          <h1>{branding().companyName}</h1>
          <p>{branding().loginMessage}</p>
        </div>

        <div class="segmented">
          <For each={["password", "totp", "backup", "passkey", "security-key"] as LoginMethod[]}>
            {(item) => (
              <button
                class={method() === item ? "active" : ""}
                type="button"
                onClick={() => setMethod(item)}
              >
                {methodLabel(item)}
              </button>
            )}
          </For>
        </div>

        <label>
          Username
          <input
            value={username()}
            autocomplete="username"
            onInput={(event) => setUsername(event.currentTarget.value)}
          />
        </label>

        <Show
          when={
            method() === "password" ||
            method() === "totp" ||
            method() === "backup" ||
            method() === "security-key"
          }
          fallback={
            <div class="mechanism-box">
              <Show when={method() === "passkey"} fallback={<KeyRound />}>
                <Fingerprint />
              </Show>
              <span>{mechanismCopy(method())}</span>
              <Show
                when={
                  config().dataSource.mode === "kanidm" &&
                  (method() === "passkey" || method() === "security-key")
                }
              >
                <a class="secondary-action" href="/ui/login">
                  Use Kanidm native login <ArrowRight size={16} />
                </a>
              </Show>
            </div>
          }
        >
          <>
            <label>
              Password
              <input
                type="password"
                value={password()}
                autocomplete="current-password"
                onInput={(event) => setPassword(event.currentTarget.value)}
              />
            </label>
            <Show when={method() === "totp"}>
              <label>
                TOTP code
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autocomplete="one-time-code"
                  value={totpCode()}
                  onInput={(event) => setTotpCode(event.currentTarget.value)}
                  placeholder="123456"
                />
              </label>
            </Show>
            <Show when={method() === "backup"}>
              <label>
                Backup code
                <input
                  autocomplete="one-time-code"
                  value={backupCode()}
                  onInput={(event) => setBackupCode(event.currentTarget.value)}
                />
              </label>
            </Show>
          </>
        </Show>

        <label>
          {config().dataSource.mode === "kanidm" ? "Session scope" : "Demo session"}
          <select
            value={role()}
            onChange={(event) => {
              const nextRole = event.currentTarget.value as Role;
              setSelectedRole(nextRole);
              if (config().dataSource.mode === "mock") {
                setUsername(nextRole === "admin" ? "ava" : "mika");
              }
            }}
          >
            <option value="admin">
              {config().dataSource.mode === "kanidm" ? "Admin console access" : "Admin user"}
            </option>
            <option value="user">
              {config().dataSource.mode === "kanidm" ? "Portal session" : "Non-admin user"}
            </option>
          </select>
        </label>

        <ErrorBox error={error} />

        <button class="primary-action" type="submit" disabled={!canSubmit()}>
          {!configReady() ? "Loading config" : busy() ? "Authenticating" : "Continue"}{" "}
          <ArrowRight size={16} />
        </button>

        <div class="auth-links">
          <Link href="/recover">Recover account</Link>
          <Link href="/reset">Use reset token</Link>
          <Link href="/oauth/consent">OAuth consent</Link>
        </div>
      </form>
    </AuthFrame>
  );
}
