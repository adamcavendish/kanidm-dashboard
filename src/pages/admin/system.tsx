import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { Save, Settings } from "lucide-solid";
import { writableSystemConfigAttrs } from "../../domain";
import type { SystemConfigEntry } from "../../domain";
import { useConsole } from "../../store";
import ErrorBox from "../../components/error-box";
import GlassPanel from "../../components/glass-panel";
import KeyValue from "../../components/key-value";
import PageHeader from "../../components/page-header";

export function SystemPage() {
  const { systemConfig, updateSystemAttribute } = useConsole();
  const [entries, setEntries] = createSignal<SystemConfigEntry[]>([]);
  const [selectedEntryId, setSelectedEntryId] = createSignal("");
  const [selectedAttr, setSelectedAttr] = createSignal("");
  const [draft, setDraft] = createSignal("");
  const [loading, setLoading] = createSignal(true);
  const [busy, setBusy] = createSignal("");
  const [error, setError] = createSignal("");
  const [message, setMessage] = createSignal("");

  const selectedEntry = createMemo(
    () => entries().find((entry) => entry.id === selectedEntryId()) ?? entries()[0],
  );
  const attrRows = createMemo(() =>
    Object.entries(selectedEntry()?.attrs ?? {}).sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  );
  const selectedValues = createMemo(() => selectedEntry()?.attrs[selectedAttr()] ?? []);
  const selectedAttrWritable = () => writableSystemConfigAttrs.includes(selectedAttr());

  createEffect(() => {
    void loadSystemConfig();
  });

  createEffect(() => {
    const entry = selectedEntry();
    if (!entry) return;
    if (!selectedAttr() || !entry.attrs[selectedAttr()]) {
      setSelectedAttr(
        entry.attrs.description ? "description" : (Object.keys(entry.attrs)[0] ?? ""),
      );
    }
  });

  createEffect(() => {
    selectedEntry();
    selectedAttr();
    setDraft(selectedValues().join("\n"));
  });

  async function loadSystemConfig() {
    setLoading(true);
    setError("");
    try {
      const nextEntries = await systemConfig();
      setEntries(nextEntries);
      setSelectedEntryId(nextEntries[0]?.id ?? "");
      const firstAttrs = nextEntries[0]?.attrs ?? {};
      setSelectedAttr(firstAttrs.description ? "description" : (Object.keys(firstAttrs)[0] ?? ""));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load system configuration.");
    } finally {
      setLoading(false);
    }
  }

  async function saveAttribute() {
    const attr = selectedAttr();
    if (!attr) return;
    setBusy("save");
    setError("");
    setMessage("");
    try {
      await updateSystemAttribute(attr, splitValues(draft()));
      setMessage(`Saved ${attr}.`);
      await loadSystemConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not save ${attr}.`);
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <PageHeader eyebrow="Admin" title="System config" />
      <ErrorBox error={error} />
      <Show when={message()}>
        <div class="review-box">
          <Settings size={18} />
          <span>{message()}</span>
        </div>
      </Show>
      <div class="split-admin maintenance-console">
        <div class="resource-list">
          <For
            each={entries()}
            fallback={
              <div class="resource-empty">
                <strong>{loading() ? "Loading system config" : "No system config found"}</strong>
                <small>Kanidm did not return editable system configuration for this session.</small>
              </div>
            }
          >
            {(entry) => (
              <button
                class={entry.id === selectedEntry()?.id ? "resource-row active" : "resource-row"}
                type="button"
                onClick={() => setSelectedEntryId(entry.id)}
              >
                <Settings size={17} />
                <span>
                  <strong>{entry.displayName}</strong>
                  <small>{entry.id}</small>
                </span>
                <b>{Object.keys(entry.attrs).length}</b>
              </button>
            )}
          </For>
        </div>
        <div class="resource-detail">
          <Show
            when={selectedEntry()}
            fallback={
              <GlassPanel title="System config">
                <p class="muted">No system config entry is selected.</p>
              </GlassPanel>
            }
          >
            {(entry) => (
              <>
                <GlassPanel title={entry().displayName}>
                  <KeyValue label="UUID" value={entry().id} variant="detail" />
                  <p class="muted">{entry().description}</p>
                  <div class="system-attr-list">
                    <For each={attrRows()}>
                      {([attr, values]) => (
                        <button
                          class={attr === selectedAttr() ? "attr-select active" : "attr-select"}
                          type="button"
                          onClick={() => setSelectedAttr(attr)}
                        >
                          <strong>{attr}</strong>
                          <small>
                            {values.length} value{values.length === 1 ? "" : "s"}
                            {" · "}
                            {writableSystemConfigAttrs.includes(attr) ? "editable" : "read-only"}
                          </small>
                        </button>
                      )}
                    </For>
                  </div>
                </GlassPanel>
                <GlassPanel title={selectedAttr() || "Attribute"}>
                  <label>
                    Values
                    <textarea
                      rows={8}
                      value={draft()}
                      disabled={!selectedAttrWritable()}
                      onInput={(event) => setDraft(event.currentTarget.value)}
                      placeholder="One value per line"
                    />
                  </label>
                  <div class="button-row">
                    <button
                      class="secondary-action"
                      type="button"
                      disabled={!selectedAttr() || !selectedAttrWritable() || busy() === "save"}
                      onClick={() => {
                        void saveAttribute();
                      }}
                    >
                      <Save size={15} />
                      {busy() === "save" ? "Saving" : "Save attribute"}
                    </button>
                  </div>
                </GlassPanel>
              </>
            )}
          </Show>
        </div>
      </div>
    </>
  );
}

function splitValues(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}
