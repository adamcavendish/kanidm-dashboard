import { createSignal, Show } from "solid-js";
import { CircleAlert, KeyRound, ServerCog, Trash2 } from "lucide-solid";
import type { UnixAccountSettings } from "../domain";
import { useConsole } from "../store";
import GlassPanel from "../components/glass-panel";
import KeyValue from "../components/key-value";
import PageHeader from "../components/page-header";
import { unixErrorMessage } from "../utils/errors";
export function UnixCredentialPage() {
  const { config, getUnixAccount, extendUnixAccount, setUnixCredential, deleteUnixCredential } =
    useConsole();
  const [unix, setUnix] = createSignal<UnixAccountSettings>(getUnixAccount());
  const [gidNumber, setGidNumber] = createSignal(unix().gidNumber?.toString() ?? "");
  const [shell, setShell] = createSignal(unix().shell);
  const [password, setPassword] = createSignal("");
  const [busy, setBusy] = createSignal("");
  const [error, setError] = createSignal("");
  const [policyBlocked, setPolicyBlocked] = createSignal(false);
  const realMode = () => config().dataSource.mode === "kanidm";

  async function saveUnixAccount() {
    const parsedGid = gidNumber().trim() ? Number(gidNumber()) : null;
    if (parsedGid !== null && (!Number.isInteger(parsedGid) || parsedGid < 0)) {
      setError("GID number must be a positive integer.");
      return;
    }

    setBusy("account");
    setError("");
    try {
      setUnix(await extendUnixAccount({ gidNumber: parsedGid, shell: shell() }));
    } catch (err) {
      setError(unixErrorMessage(err, "Could not update Unix account.", setPolicyBlocked));
    } finally {
      setBusy("");
    }
  }

  async function saveUnixCredential() {
    setBusy("credential");
    setError("");
    try {
      setUnix(await setUnixCredential(password()));
      setPassword("");
    } catch (err) {
      setError(unixErrorMessage(err, "Could not set Unix credential.", setPolicyBlocked));
    } finally {
      setBusy("");
    }
  }

  async function removeUnixCredential() {
    setBusy("delete");
    setError("");
    try {
      setUnix(await deleteUnixCredential());
    } catch (err) {
      setError(unixErrorMessage(err, "Could not delete Unix credential.", setPolicyBlocked));
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <PageHeader eyebrow="Self-service" title="Unix credential" />
      <div class="two-column">
        <GlassPanel title="Unix account">
          <div class="theme-grid">
            <KeyValue label="GID number" value={unix().gidNumber ?? "Not set"} />
            <KeyValue label="Login shell" value={unix().shell || "Not set"} />
            <KeyValue label="Credential" value={unix().credentialSet ? "Set" : "Not set"} />
          </div>
          <label>
            GID number
            <input
              inputmode="numeric"
              value={gidNumber()}
              onInput={(event) => setGidNumber(event.currentTarget.value)}
              placeholder="10001"
            />
          </label>
          <label>
            Login shell
            <input
              value={shell()}
              onInput={(event) => setShell(event.currentTarget.value)}
              placeholder="/bin/zsh"
            />
          </label>
          <button
            class="primary-action"
            type="button"
            disabled={busy() === "account" || policyBlocked()}
            onClick={() => void saveUnixAccount()}
          >
            <ServerCog size={16} /> {busy() === "account" ? "Saving account" : "Save Unix account"}
          </button>
        </GlassPanel>
        <GlassPanel title="Unix password">
          <p class="muted">
            Sets the Kanidm Unix credential used by Unix/PAM integrations. This is separate from the
            primary web login credential.
          </p>
          <label>
            New Unix password
            <input
              type="password"
              value={password()}
              onInput={(event) => setPassword(event.currentTarget.value)}
              placeholder="New Unix credential"
            />
          </label>
          <div class="button-row">
            <button
              class="primary-action"
              type="button"
              disabled={busy() === "credential" || policyBlocked() || !password().trim()}
              onClick={() => void saveUnixCredential()}
            >
              <KeyRound size={16} />{" "}
              {busy() === "credential" ? "Setting credential" : "Set Unix credential"}
            </button>
            <button
              class="danger-action"
              type="button"
              disabled={busy() === "delete" || policyBlocked() || !unix().credentialSet}
              onClick={() => void removeUnixCredential()}
            >
              <Trash2 size={16} /> Delete Unix credential
            </button>
          </div>
          <Show when={error()}>
            <div class="review-box danger">
              <CircleAlert size={18} />
              <span>{error()}</span>
            </div>
          </Show>
          <Show when={realMode() && !policyBlocked()}>
            <div class="review-box">
              <ServerCog size={18} />
              <span>
                Unix account and credential changes depend on Kanidm policy for this account.
              </span>
            </div>
          </Show>
        </GlassPanel>
      </div>
    </>
  );
}
