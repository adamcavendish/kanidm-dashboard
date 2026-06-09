import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { History, RefreshCw } from "lucide-solid";
import type { RecycleBinEntry } from "../../domain";
import { useConsole } from "../../store";
import ErrorBox from "../../components/error-box";
import GlassPanel from "../../components/glass-panel";
import KeyValue from "../../components/key-value";
import PageHeader from "../../components/page-header";
import { Toolbar } from "../../components/toolbar";
import { searchable } from "../../utils/search";

export function RecycleBinPage() {
  const { recycleBinEntries, recycleBinEntry, reviveRecycleBinEntry } = useConsole();
  const [entries, setEntries] = createSignal<RecycleBinEntry[]>([]);
  const [selectedId, setSelectedId] = createSignal("");
  const [selectedEntry, setSelectedEntry] = createSignal<RecycleBinEntry | null>(null);
  const [query, setQuery] = createSignal("");
  const [confirmName, setConfirmName] = createSignal("");
  const [loading, setLoading] = createSignal(true);
  const [busy, setBusy] = createSignal("");
  const [error, setError] = createSignal("");
  const [message, setMessage] = createSignal("");
  let detailRequest = 0;

  const filteredEntries = createMemo(() =>
    entries().filter((entry) => searchable(entry).includes(query().toLowerCase())),
  );
  const visibleSelectedEntry = createMemo(() => {
    const entry = selectedEntry();
    if (!entry) return null;
    return filteredEntries().some((item) => item.id === entry.id) ? entry : null;
  });
  const attrRows = createMemo(() =>
    Object.entries(visibleSelectedEntry()?.attrs ?? {}).sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  );
  const canRevive = () =>
    visibleSelectedEntry() && confirmName().trim() === visibleSelectedEntry()!.name;

  createEffect(() => {
    void loadEntries();
  });

  createEffect(() => {
    const id = selectedId();
    if (!id) return;
    void loadEntry(id);
  });

  createEffect(() => {
    const filtered = filteredEntries();
    if (!filtered.length) return;
    if (!filtered.some((entry) => entry.id === selectedId())) {
      setSelectedId(filtered[0]!.id);
    }
  });

  async function loadEntries() {
    setLoading(true);
    setError("");
    try {
      const nextEntries = await recycleBinEntries();
      setEntries(nextEntries);
      setSelectedId((previous) =>
        nextEntries.some((entry) => entry.id === previous) ? previous : (nextEntries[0]?.id ?? ""),
      );
      if (!nextEntries.length) {
        detailRequest += 1;
        setSelectedEntry(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load recycle bin.");
    } finally {
      setLoading(false);
    }
  }

  async function loadEntry(id: string) {
    const requestId = ++detailRequest;
    setBusy("detail");
    setError("");
    setConfirmName("");
    try {
      const entry = (await recycleBinEntry(id)) ?? entries().find((item) => item.id === id) ?? null;
      if (requestId !== detailRequest || selectedId() !== id) return;
      setSelectedEntry(entry);
    } catch (err) {
      if (requestId !== detailRequest || selectedId() !== id) return;
      setError(err instanceof Error ? err.message : "Could not load recycle bin entry.");
    } finally {
      if (requestId === detailRequest && selectedId() === id) setBusy("");
    }
  }

  async function reviveSelected() {
    const entry = selectedEntry();
    if (!entry || !canRevive()) return;
    setBusy("revive");
    setError("");
    setMessage("");
    try {
      await reviveRecycleBinEntry(entry.id);
      setMessage(`Revived ${entry.displayName}.`);
      await loadEntries();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not revive recycle bin entry.");
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <PageHeader eyebrow="Admin" title="Recycle bin" />
      <Toolbar query={query()} onQuery={setQuery} placeholder="Search recycle bin" />
      <ErrorBox error={error} />
      <Show when={message()}>
        <div class="review-box">
          <RefreshCw size={18} />
          <span>{message()}</span>
        </div>
      </Show>
      <div class="split-admin maintenance-console">
        <div class="resource-list">
          <For
            each={filteredEntries()}
            fallback={
              <div class="resource-empty">
                <strong>{loading() ? "Loading recycle bin" : "No recycled entries found"}</strong>
                <small>
                  {query().trim()
                    ? `No recycled entries match "${query().trim()}".`
                    : "Kanidm did not return deleted entries for this session."}
                </small>
              </div>
            }
          >
            {(entry) => (
              <button
                class={
                  entry.id === selectedId()
                    ? "resource-row count-row active"
                    : "resource-row count-row"
                }
                type="button"
                onClick={() => setSelectedId(entry.id)}
              >
                <History size={17} />
                <span>
                  <strong>{entry.displayName}</strong>
                  <small>{entry.name}</small>
                </span>
                <b>{entry.classes.length}</b>
              </button>
            )}
          </For>
        </div>
        <div class="resource-detail">
          <Show
            when={visibleSelectedEntry()}
            fallback={
              <GlassPanel title="Recycle bin entry">
                <p class="muted">No recycled entry is selected.</p>
              </GlassPanel>
            }
          >
            {(entry) => (
              <>
                <GlassPanel title={entry().displayName}>
                  <KeyValue label="Name" value={entry().name} variant="detail" />
                  <KeyValue label="UUID" value={entry().id} variant="detail" />
                  <p class="muted">{entry().description || "No description returned."}</p>
                  <div class="chip-row recycle-classes">
                    <For each={entry().classes}>{(item) => <span class="chip">{item}</span>}</For>
                  </div>
                </GlassPanel>
                <GlassPanel title="Revive entry">
                  <p class="muted">
                    Type the entry name to confirm revive. Kanidm restores the deleted object to
                    active directory storage.
                  </p>
                  <label>
                    Entry name
                    <input
                      value={confirmName()}
                      onInput={(event) => setConfirmName(event.currentTarget.value)}
                      placeholder={entry().name}
                    />
                  </label>
                  <div class="button-row">
                    <button
                      class="secondary-action"
                      type="button"
                      disabled={!canRevive() || busy() === "revive"}
                      onClick={() => {
                        void reviveSelected();
                      }}
                    >
                      <RefreshCw size={15} />
                      {busy() === "revive" ? "Reviving" : "Revive"}
                    </button>
                  </div>
                </GlassPanel>
                <GlassPanel title="Attributes">
                  <div class="attr-table">
                    <For each={attrRows()}>
                      {([attr, values]) => (
                        <div class="attr-row">
                          <strong>{attr}</strong>
                          <span>{values.join(", ") || "Empty"}</span>
                        </div>
                      )}
                    </For>
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
