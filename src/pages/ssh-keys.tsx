import { createSignal, For, onMount, Show } from "solid-js";
import { CircleAlert, KeyRound, Plus, Trash2 } from "lucide-solid";
import type { SshPublicKey } from "../domain";
import { useConsole } from "../store";
import GlassPanel from "../components/glass-panel";
import PageHeader from "../components/page-header";
import { sshKeyErrorMessage } from "../utils/errors";
export function SshKeysPage() {
  const { config, getSshPublicKeys, addSshPublicKey, deleteSshPublicKey } = useConsole();
  const [keys, setKeys] = createSignal<SshPublicKey[]>([]);
  const [tag, setTag] = createSignal("");
  const [publicKey, setPublicKey] = createSignal("");
  const [loaded, setLoaded] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");
  const [policyBlocked, setPolicyBlocked] = createSignal(false);
  const realMode = () => config().dataSource.mode === "kanidm";

  onMount(() => {
    void loadKeys();
  });

  async function loadKeys() {
    setBusy(true);
    setError("");
    try {
      setKeys(await getSshPublicKeys());
      setPolicyBlocked(false);
      setLoaded(true);
    } catch (err) {
      setError(sshKeyErrorMessage(err, "Could not load SSH public keys.", setPolicyBlocked));
      setLoaded(true);
    } finally {
      setBusy(false);
    }
  }

  async function addKey() {
    setBusy(true);
    setError("");
    try {
      setKeys(await addSshPublicKey(tag(), publicKey()));
      setTag("");
      setPublicKey("");
      setLoaded(true);
    } catch (err) {
      setError(sshKeyErrorMessage(err, "Could not add SSH public key.", setPolicyBlocked));
    } finally {
      setBusy(false);
    }
  }

  async function removeKey(keyTag: string) {
    setBusy(true);
    setError("");
    try {
      setKeys(await deleteSshPublicKey(keyTag));
      setLoaded(true);
    } catch (err) {
      setError(sshKeyErrorMessage(err, "Could not delete SSH public key.", setPolicyBlocked));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader eyebrow="Self-service" title="SSH public keys" />
      <div class="two-column">
        <GlassPanel title="Registered keys">
          <Show when={loaded()} fallback={<div class="empty-state">Loading SSH public keys.</div>}>
            <Show
              when={keys().length}
              fallback={<div class="empty-state">No SSH keys registered.</div>}
            >
              <div class="ssh-key-list">
                <For each={keys()}>
                  {(item) => (
                    <div class="ssh-key-row">
                      <div>
                        <strong>{item.tag}</strong>
                        <code>{item.key}</code>
                      </div>
                      <button
                        class="danger-action icon-only"
                        type="button"
                        aria-label={`Delete ${item.tag}`}
                        disabled={busy() || policyBlocked()}
                        onClick={() => void removeKey(item.tag)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </Show>
        </GlassPanel>
        <GlassPanel title="Add public key">
          <label>
            Key tag
            <input
              value={tag()}
              disabled={policyBlocked()}
              onInput={(event) => setTag(event.currentTarget.value)}
              placeholder="work-laptop"
            />
          </label>
          <label>
            Public key
            <textarea
              rows={6}
              value={publicKey()}
              disabled={policyBlocked()}
              onInput={(event) => setPublicKey(event.currentTarget.value)}
              placeholder="ssh-ed25519 AAAA..."
            />
          </label>
          <button
            class="primary-action"
            type="button"
            disabled={busy() || policyBlocked() || !tag().trim() || !publicKey().trim()}
            onClick={addKey}
          >
            <Plus size={16} /> Add key
          </button>
          <Show when={realMode() && !policyBlocked()}>
            <div class="review-box">
              <KeyRound size={18} />
              <span>
                SSH public-key self-service depends on Kanidm policy for this account. If a write is
                denied, the dashboard leaves existing keys unchanged.
              </span>
            </div>
          </Show>
          <Show when={error()}>
            <div class="review-box danger">
              <CircleAlert size={18} />
              <span>{error()}</span>
            </div>
          </Show>
        </GlassPanel>
      </div>
    </>
  );
}
