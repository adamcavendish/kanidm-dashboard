import { createEffect, createSignal, For, Show } from "solid-js";
import { Check, CircleAlert, Plus, Trash2, Upload } from "lucide-solid";
import type { Application, ApplicationPatch, ApplicationScopeMap } from "../../domain";
import { useConsole } from "../../store";
import { KanidmDataSource } from "../../data-source";
import AppIcon from "../../components/app-icon";
import ErrorBox from "../../components/error-box";
import GlassPanel from "../../components/glass-panel";
import KeyValue from "../../components/key-value";
import PageHeader from "../../components/page-header";
import TextField from "../../components/text-field";
import { AppStatusBadge } from "../../components/status-badge";
import { Toolbar } from "../../components/toolbar";
import { Link, useNavigation } from "../../routing";
import { standardScopes } from "../../oauth-scopes";
import { toggleValue } from "../../utils/collections";
import { validateKanidmImageFile } from "../../utils/image-validation";
import { labelForGroup } from "../../utils/labels";
import { searchable } from "../../utils/search";
export function ApplicationsPage() {
  const { state, config, uploadAppImage, resetAppImage, updateApplication, deleteApplication } =
    useConsole();
  const { navigate } = useNavigation();
  const [query, setQuery] = createSignal("");
  const [selectedAppId, setSelectedAppId] = createSignal(state().apps[0]?.id ?? "");
  const [editDisplayName, setEditDisplayName] = createSignal("");
  const [editLandingUrl, setEditLandingUrl] = createSignal("");
  const [editRedirectText, setEditRedirectText] = createSignal("");
  const [editAllowedGroups, setEditAllowedGroups] = createSignal<string[]>([]);
  const [editScopeMaps, setEditScopeMaps] = createSignal<ApplicationScopeMap[]>([]);
  const [editing, setEditing] = createSignal(false);
  const [deleting, setDeleting] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");
  const [imageBusy, setImageBusy] = createSignal(false);
  const [imageError, setImageError] = createSignal("");
  const [customScope, setCustomScope] = createSignal("");

  const apps = () => state().apps.filter((app) => searchable(app).includes(query().toLowerCase()));
  const selectedApp = () =>
    state().apps.find((app) => app.id === selectedAppId()) ?? state().apps[0];

  const editRedirectUris = () =>
    editRedirectText()
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

  const scopesForEditingGroup = (groupId: string) =>
    editScopeMaps().find((sm) => sm.groupId === groupId)?.scopes ?? [];

  const extraScopes = () => {
    const seen = new Set(standardScopes);
    const extra: string[] = [];
    for (const app of state().apps) {
      for (const scope of app.scopes) {
        if (!seen.has(scope)) {
          seen.add(scope);
          extra.push(scope);
        }
      }
    }
    return extra;
  };

  createEffect(() => {
    const app = selectedApp();
    if (app) {
      setEditDisplayName(app.displayName);
      setEditLandingUrl(app.landingUrl);
      setEditRedirectText(app.redirectUris.join("\n"));
      setEditAllowedGroups([...app.allowedGroups]);
      setEditScopeMaps(structuredClone(app.scopeMaps ?? []));
      setEditing(false);
      setDeleting(false);
      setError("");
      setImageError("");
    }
  });

  async function handleAppImageUpload(app: Application, event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const validationError = await validateKanidmImageFile(file);
    if (validationError) {
      setImageError(validationError);
      input.value = "";
      return;
    }

    setImageBusy(true);
    setImageError("");
    try {
      await uploadAppImage(app.id, file);
      input.value = "";
    } catch (err) {
      setImageError(err instanceof Error ? err.message : "Could not upload application image.");
    } finally {
      setImageBusy(false);
    }
  }

  async function handleResetAppImage(app: Application) {
    setImageBusy(true);
    setImageError("");
    try {
      await resetAppImage(app.id);
    } catch (err) {
      setImageError(err instanceof Error ? err.message : "Could not reset application image.");
    } finally {
      setImageBusy(false);
    }
  }

  function toggleAccessGroup(groupId: string) {
    const nextGroups = toggleValue(editAllowedGroups(), groupId);
    setEditAllowedGroups(nextGroups);
    setEditScopeMaps(editScopeMaps().filter((sm) => nextGroups.includes(sm.groupId)));
  }

  function toggleGroupScope(groupId: string, scope: string) {
    const currentScopes = scopesForEditingGroup(groupId);
    const nextScopes = toggleValue(currentScopes, scope);
    if (nextScopes.length === 0) return;
    const existing = editScopeMaps().find((sm) => sm.groupId === groupId);
    if (existing) {
      setEditScopeMaps(
        editScopeMaps().map((sm) => (sm.groupId === groupId ? { ...sm, scopes: nextScopes } : sm)),
      );
    } else {
      setEditScopeMaps([...editScopeMaps(), { groupId, scopes: nextScopes }]);
    }
  }

  function addCustomScopeToGroup(groupId: string) {
    const scope = customScope().trim();
    if (!scope) return;
    toggleGroupScope(groupId, scope);
    setCustomScope("");
  }

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Applications"
        action={
          <Link class="primary-action" href="/admin/apps/new">
            <Plus size={16} /> Add application
          </Link>
        }
      />
      <Toolbar query={query()} onQuery={setQuery} placeholder="Search applications" />
      <Show when={imageError()}>
        <div class="review-box danger">
          <CircleAlert size={18} />
          <span>{imageError()}</span>
        </div>
      </Show>
      <div class="split-admin">
        <div class="resource-list">
          <For
            each={apps()}
            fallback={
              <div class="resource-empty">
                <strong>No applications found</strong>
                <small>
                  {query().trim()
                    ? `No applications match "${query().trim()}".`
                    : "No applications are available."}
                </small>
              </div>
            }
          >
            {(app) => (
              <button
                class={app.id === selectedApp()?.id ? "resource-row active" : "resource-row"}
                type="button"
                onClick={() => setSelectedAppId(app.id)}
              >
                <AppIcon app={app} />
                <span>
                  <strong>{app.displayName}</strong>
                  <small>{app.name}</small>
                </span>
                <AppStatusBadge status={app.status} />
              </button>
            )}
          </For>
        </div>
        <div class="resource-detail">
          <GlassPanel title={selectedApp()?.displayName ?? "Application"}>
            <KeyValue label="System name" value={selectedApp()?.name ?? ""} variant="detail" />
            <KeyValue
              label="Client type"
              value={selectedApp()?.clientType ?? ""}
              variant="detail"
            />
            <Show
              when={editing()}
              fallback={
                <>
                  <KeyValue
                    label="Display name"
                    value={selectedApp()?.displayName ?? ""}
                    variant="detail"
                  />
                  <KeyValue
                    label="Landing URL"
                    value={selectedApp()?.landingUrl ?? ""}
                    variant="detail"
                  />
                  <KeyValue
                    label="Redirect URIs"
                    value={
                      selectedApp()?.redirectUris.length
                        ? selectedApp()!.redirectUris.join(", ")
                        : "None"
                    }
                    variant="detail"
                  />
                  <KeyValue
                    label="Access groups"
                    value={
                      selectedApp()
                        ?.allowedGroups.map((groupId) => labelForGroup(state().groups, groupId))
                        .join(", ") || "None"
                    }
                    variant="detail"
                  />
                  <KeyValue
                    label="Status"
                    value={<AppStatusBadge status={selectedApp()?.status ?? "attention"} />}
                    variant="detail"
                  />
                  <Show when={selectedApp()?.scopeMaps?.length}>
                    <div class="scope-map-summary">
                      <h4>Scope maps</h4>
                      <For each={selectedApp()?.scopeMaps ?? []}>
                        {(scopeMap) => (
                          <div class="scope-map-summary-row">
                            <strong>{labelForGroup(state().groups, scopeMap.groupId)}</strong>
                            <div class="chip-row">
                              <For each={scopeMap.scopes}>
                                {(scope) => <span class="chip">{scope}</span>}
                              </For>
                            </div>
                          </div>
                        )}
                      </For>
                    </div>
                  </Show>
                  <div class="detail-actions">
                    <div class="detail-action-row image-action-row">
                      <label class="file-button compact-file">
                        <Upload size={15} /> Upload image
                        <input
                          type="file"
                          accept=".png,.jpg,.jpeg,.gif,.svg,.webp"
                          disabled={imageBusy()}
                          onChange={(event) => {
                            const app = selectedApp();
                            if (app) void handleAppImageUpload(app, event);
                          }}
                        />
                      </label>
                      <button
                        class="secondary-action"
                        type="button"
                        disabled={imageBusy()}
                        onClick={() => {
                          const app = selectedApp();
                          if (app) void handleResetAppImage(app);
                        }}
                      >
                        <Trash2 size={15} /> Reset image
                      </button>
                      <Show when={imageBusy()}>
                        <small>Saving image</small>
                      </Show>
                    </div>
                    <ErrorBox error={error} />
                    <div class="detail-action-row">
                      <button
                        class="secondary-action"
                        type="button"
                        onClick={() => setEditing(true)}
                      >
                        Edit
                      </button>
                      <Show when={!deleting()}>
                        <button
                          class="danger-action"
                          type="button"
                          onClick={() => setDeleting(true)}
                        >
                          <Trash2 size={14} /> Delete application
                        </button>
                      </Show>
                      <Show when={deleting()}>
                        <span class="muted">Confirm delete?</span>
                        <button
                          class="danger-action"
                          type="button"
                          disabled={busy()}
                          onClick={async () => {
                            setBusy(true);
                            setError("");
                            try {
                              await deleteApplication(selectedApp()!.id);
                              navigate("/admin/apps");
                            } catch (err) {
                              setError(
                                err instanceof Error
                                  ? err.message
                                  : "Could not delete application.",
                              );
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          {busy() ? "Deleting…" : "Yes, delete"}
                        </button>
                        <button
                          class="secondary-action"
                          type="button"
                          disabled={busy()}
                          onClick={() => setDeleting(false)}
                        >
                          Cancel
                        </button>
                      </Show>
                    </div>
                  </div>
                </>
              }
            >
              <div class="field-stack">
                <TextField
                  label="Display name"
                  value={editDisplayName()}
                  onInput={setEditDisplayName}
                />
                <TextField
                  label="Landing URL"
                  value={editLandingUrl()}
                  onInput={setEditLandingUrl}
                  type="url"
                />
                <ErrorBox error={error} />
                <label>
                  Redirect URIs
                  <textarea
                    rows={4}
                    value={editRedirectText()}
                    onInput={(e) => setEditRedirectText(e.currentTarget.value)}
                    placeholder="https://app.example/oauth/callback"
                  />
                </label>
              </div>
            </Show>
          </GlassPanel>

          <Show when={editing()}>
            <GlassPanel title="Access groups and scopes">
              <div class="option-grid">
                <For each={state().groups}>
                  {(group) => {
                    const selected = () => editAllowedGroups().includes(group.id);
                    return (
                      <button
                        class={selected() ? "option-card selected" : "option-card"}
                        type="button"
                        onClick={() => toggleAccessGroup(group.id)}
                      >
                        <span>
                          <Show when={selected()} fallback={<Plus size={16} />}>
                            <Check size={16} />
                          </Show>
                        </span>
                        <strong>{group.displayName}</strong>
                        <small>{group.name}</small>
                      </button>
                    );
                  }}
                </For>
              </div>

              <Show when={editAllowedGroups().length > 0}>
                <h4>Scopes per group</h4>
                <For each={editAllowedGroups()}>
                  {(groupId) => (
                    <div class="scope-map-editor">
                      <strong>{labelForGroup(state().groups, groupId)}</strong>
                      <div class="scope-toggle-row">
                        <For each={standardScopes}>
                          {(scope) => {
                            const active = () => scopesForEditingGroup(groupId).includes(scope);
                            return (
                              <button
                                class={active() ? "scope-toggle selected" : "scope-toggle"}
                                type="button"
                                onClick={() => toggleGroupScope(groupId, scope)}
                              >
                                {scope}
                              </button>
                            );
                          }}
                        </For>
                        <For each={extraScopes()}>
                          {(scope) => {
                            const active = () => scopesForEditingGroup(groupId).includes(scope);
                            return (
                              <button
                                class={active() ? "scope-toggle selected" : "scope-toggle"}
                                type="button"
                                onClick={() => toggleGroupScope(groupId, scope)}
                              >
                                {scope}
                              </button>
                            );
                          }}
                        </For>
                      </div>
                      <div class="custom-scope-row">
                        <input
                          type="text"
                          placeholder="Custom scope name"
                          value={customScope()}
                          onInput={(e) => setCustomScope(e.currentTarget.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addCustomScopeToGroup(groupId);
                            }
                          }}
                        />
                        <button
                          class="secondary-action"
                          type="button"
                          onClick={() => addCustomScopeToGroup(groupId)}
                        >
                          <Plus size={14} /> Add
                        </button>
                      </div>
                    </div>
                  )}
                </For>
              </Show>
            </GlassPanel>
          </Show>

          <Show when={editing()}>
            <div class="edit-toolbar">
              <button
                class="primary-action"
                type="button"
                disabled={busy()}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    const app = selectedApp();
                    if (!app) return;

                    const patch: ApplicationPatch = {};
                    if (editDisplayName() !== app.displayName) {
                      patch.displayName = editDisplayName();
                    }
                    if (editLandingUrl() !== app.landingUrl) {
                      patch.landingUrl = editLandingUrl();
                    }
                    const newRedirectUris = editRedirectUris();
                    const redirectsChanged =
                      newRedirectUris.length !== app.redirectUris.length ||
                      newRedirectUris.some((uri, i) => uri !== app.redirectUris[i]);
                    if (redirectsChanged) {
                      patch.redirectUris = newRedirectUris;
                    }

                    if (Object.keys(patch).length > 0) {
                      await updateApplication(app.id, patch);
                    }

                    // Handle scope map changes (Kanidm mode only)
                    if (config().dataSource.mode === "kanidm") {
                      const nextGroupIds = new Set(editAllowedGroups());
                      const groupNames = new Map(state().groups.map((g) => [g.id, g.name]));

                      const ds = new KanidmDataSource(
                        config().dataSource,
                        sessionStorage.getItem("kanidm-dashboard-kanidm-token") ?? undefined,
                      );

                      // Remove scope maps for deselected groups
                      for (const removed of app.allowedGroups) {
                        if (!nextGroupIds.has(removed)) {
                          const groupName = groupNames.get(removed) ?? removed;
                          await ds.deleteOAuth2ApplicationScopeMap(app.name, groupName);
                        }
                      }

                      // Add/update scope maps for selected groups
                      for (const groupId of editAllowedGroups()) {
                        const groupName = groupNames.get(groupId) ?? groupId;
                        const editSM = editScopeMaps().find((sm) => sm.groupId === groupId);
                        const origSM = app.scopeMaps?.find((sm) => sm.groupId === groupId);
                        const newScopes = editSM?.scopes ?? [];
                        const oldScopes = origSM?.scopes ?? [];

                        const scopesChanged =
                          newScopes.length !== oldScopes.length ||
                          newScopes.some((s, i) => s !== oldScopes[i]);

                        if (!origSM || scopesChanged) {
                          await ds.updateOAuth2ApplicationScopeMap(app.name, groupName, newScopes);
                        }
                      }
                    }

                    setEditing(false);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Could not save application.");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy() ? "Saving…" : "Save changes"}
              </button>
              <button
                class="secondary-action"
                type="button"
                disabled={busy()}
                onClick={() => {
                  setEditing(false);
                  const app = selectedApp();
                  if (app) {
                    setEditDisplayName(app.displayName);
                    setEditLandingUrl(app.landingUrl);
                    setEditRedirectText(app.redirectUris.join("\n"));
                    setEditAllowedGroups([...app.allowedGroups]);
                    setEditScopeMaps(structuredClone(app.scopeMaps ?? []));
                  }
                }}
              >
                Cancel
              </button>
            </div>
          </Show>
        </div>
      </div>
    </>
  );
}
