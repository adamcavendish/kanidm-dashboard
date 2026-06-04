import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { BookOpen, Database } from "lucide-solid";
import type { SchemaCatalog, SchemaItem } from "../../domain";
import { useConsole } from "../../store";
import ErrorBox from "../../components/error-box";
import GlassPanel from "../../components/glass-panel";
import KeyValue from "../../components/key-value";
import PageHeader from "../../components/page-header";
import { Toolbar } from "../../components/toolbar";
import { searchable } from "../../utils/search";

export function SchemaPage() {
  const { schemaCatalog } = useConsole();
  const [catalog, setCatalog] = createSignal<SchemaCatalog>({ attributes: [], classes: [] });
  const [query, setQuery] = createSignal("");
  const [selectedKey, setSelectedKey] = createSignal("");
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal("");

  const items = createMemo(() => [
    ...catalog().attributes.map((item) => ({ ...item, listKey: schemaKey(item) })),
    ...catalog().classes.map((item) => ({ ...item, listKey: schemaKey(item) })),
  ]);
  const filteredItems = createMemo(() =>
    items().filter((item) => searchable(item).includes(query().toLowerCase())),
  );
  const selectedItem = createMemo(
    () => filteredItems().find((item) => item.listKey === selectedKey()) ?? filteredItems()[0],
  );
  const selectedAttrs = createMemo(() =>
    Object.entries(selectedItem()?.attrs ?? {}).sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  );

  createEffect(() => {
    void loadSchema();
  });

  createEffect(() => {
    const filtered = filteredItems();
    if (!filtered.length) {
      setSelectedKey("");
      return;
    }
    if (!selectedKey() || !filtered.some((item) => item.listKey === selectedKey())) {
      setSelectedKey(filtered[0]!.listKey);
    }
  });

  async function loadSchema() {
    setLoading(true);
    setError("");
    try {
      const nextCatalog = await schemaCatalog();
      setCatalog(nextCatalog);
      const firstItem = nextCatalog.attributes[0] ?? nextCatalog.classes[0];
      setSelectedKey(firstItem ? schemaKey(firstItem) : "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load Kanidm schema.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader eyebrow="Admin" title="Schema browser" />
      <Toolbar query={query()} onQuery={setQuery} placeholder="Search schema" />
      <ErrorBox error={error} />
      <div class="split-admin maintenance-console">
        <div class="resource-list">
          <For
            each={filteredItems()}
            fallback={
              <div class="resource-empty">
                <strong>{loading() ? "Loading schema" : "No schema entries found"}</strong>
                <small>
                  {query().trim()
                    ? `No schema entries match "${query().trim()}".`
                    : "Kanidm returned an empty schema catalog for this session."}
                </small>
              </div>
            }
          >
            {(item) => (
              <button
                class={
                  item.listKey === selectedItem()?.listKey ? "resource-row active" : "resource-row"
                }
                type="button"
                onClick={() => setSelectedKey(item.listKey)}
              >
                <Show when={item.kind === "attribute"} fallback={<BookOpen size={17} />}>
                  <Database size={17} />
                </Show>
                <span>
                  <strong>{item.displayName}</strong>
                  <small>{item.name}</small>
                </span>
                <b class="schema-kind">{item.kind}</b>
              </button>
            )}
          </For>
        </div>
        <div class="resource-detail">
          <Show
            when={selectedItem()}
            fallback={
              <GlassPanel title="Schema">
                <p class="muted">No schema entry is selected.</p>
              </GlassPanel>
            }
          >
            {(item) => (
              <GlassPanel title={item().displayName}>
                <KeyValue label="Name" value={item().name} variant="detail" />
                <KeyValue label="Kind" value={item().kind} variant="detail" />
                <p class="muted">{item().description}</p>
                <div class="attr-table">
                  <For each={selectedAttrs()}>
                    {([attr, values]) => (
                      <div class="attr-row">
                        <strong>{attr}</strong>
                        <span>{values.join(", ") || "Empty"}</span>
                      </div>
                    )}
                  </For>
                </div>
              </GlassPanel>
            )}
          </Show>
        </div>
      </div>
    </>
  );
}

function schemaKey(item: Pick<SchemaItem, "kind" | "id">) {
  return `${item.kind}:${item.id}`;
}
