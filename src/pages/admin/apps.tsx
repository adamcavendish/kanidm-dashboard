import { createEffect, createSignal, For, Show, untrack } from "solid-js";
import { Check, CircleAlert, KeyRound, Plus, RotateCw, Trash2, Upload } from "lucide-solid";
import { defaultApplicationPolicyToggles } from "../../domain";
import type {
  Application,
  ApplicationKeyAction,
  ApplicationClaimMapJoin,
  ApplicationPatch,
  ApplicationPolicyInput,
  ApplicationPolicyToggles,
  ApplicationScopeMap,
} from "../../domain";
import { useConsole } from "../../store";
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

type ApplicationPolicyToggleKey = Exclude<keyof ApplicationPolicyToggles, "refreshTokenExpiry">;

const oauthPolicyToggleOptions: Array<{
  key: ApplicationPolicyToggleKey;
  label: string;
  attr: string;
  publicOnly?: boolean;
}> = [
  {
    key: "preferShortUsername",
    label: "Prefer short username",
    attr: "oauth2_prefer_short_username",
  },
  {
    key: "consentPrompt",
    label: "Consent prompt",
    attr: "oauth2_consent_prompt_enable",
  },
  {
    key: "jwtLegacyCrypto",
    label: "JWT legacy crypto",
    attr: "oauth2_jwt_legacy_crypto_enable",
  },
  {
    key: "strictRedirectUri",
    label: "Strict redirect URI",
    attr: "oauth2_strict_redirect_uri",
  },
  {
    key: "deviceFlow",
    label: "Device flow",
    attr: "oauth2_device_flow_enable",
  },
  {
    key: "allowInsecureClientDisablePkce",
    label: "Allow disabling PKCE",
    attr: "oauth2_allow_insecure_client_disable_pkce",
  },
  {
    key: "allowLocalhostRedirect",
    label: "Localhost redirect",
    attr: "oauth2_allow_localhost_redirect",
    publicOnly: true,
  },
];

type KeyActionState = {
  appId: string;
  action: ApplicationKeyAction;
};

type KeyActionNotice = {
  appId: string;
  text: string;
};

export function ApplicationsPage() {
  const {
    state,
    uploadAppImage,
    resetAppImage,
    updateApplication,
    updateApplicationPolicy,
    updateApplicationKeyAction,
    getApplicationClientSecret,
    deleteApplication,
  } = useConsole();
  const { navigate } = useNavigation();
  const [query, setQuery] = createSignal("");
  const [selectedAppId, setSelectedAppId] = createSignal(state().apps[0]?.id ?? "");
  const [editDisplayName, setEditDisplayName] = createSignal("");
  const [editLandingUrl, setEditLandingUrl] = createSignal("");
  const [editRedirectText, setEditRedirectText] = createSignal("");
  const [editAllowedGroups, setEditAllowedGroups] = createSignal<string[]>([]);
  const [editScopeMaps, setEditScopeMaps] = createSignal<ApplicationScopeMap[]>([]);
  const [editSupplementalScopeMaps, setEditSupplementalScopeMaps] = createSignal<
    ApplicationScopeMap[]
  >([]);
  const [editClaimMaps, setEditClaimMaps] = createSignal<ApplicationPolicyInput["claimMaps"]>([]);
  const [editPolicyToggles, setEditPolicyToggles] = createSignal<ApplicationPolicyToggles>({
    ...defaultApplicationPolicyToggles,
  });
  const [editing, setEditing] = createSignal(false);
  const [deleting, setDeleting] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");
  const [imageBusy, setImageBusy] = createSignal(false);
  const [imageError, setImageError] = createSignal("");
  const [customScope, setCustomScope] = createSignal("");
  const [customSupplementalScope, setCustomSupplementalScope] = createSignal("");
  const [claimName, setClaimName] = createSignal("roles");
  const [claimGroupId, setClaimGroupId] = createSignal("");
  const [claimValues, setClaimValues] = createSignal("");
  const [claimJoin, setClaimJoin] = createSignal<ApplicationClaimMapJoin>("array");
  const [clientSecret, setClientSecret] = createSignal("");
  const [secretBusy, setSecretBusy] = createSignal(false);
  const [secretError, setSecretError] = createSignal("");
  const [keyActionBusy, setKeyActionBusy] = createSignal<KeyActionState | null>(null);
  const [keyActionError, setKeyActionError] = createSignal<KeyActionNotice | null>(null);
  const [keyActionMessage, setKeyActionMessage] = createSignal<KeyActionNotice | null>(null);
  const [confirmKeyRevoke, setConfirmKeyRevoke] = createSignal(false);

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

  const supplementalScopesForEditingGroup = (groupId: string) =>
    editSupplementalScopeMaps().find((sm) => sm.groupId === groupId)?.scopes ?? [];

  const keyActionBusyForSelectedApp = (action: ApplicationKeyAction) =>
    keyActionBusy()?.appId === selectedApp()?.id && keyActionBusy()?.action === action;

  const selectedKeyActionError = () =>
    keyActionError()?.appId === selectedApp()?.id ? (keyActionError()?.text ?? "") : "";

  const selectedKeyActionMessage = () =>
    keyActionMessage()?.appId === selectedApp()?.id ? (keyActionMessage()?.text ?? "") : "";

  const operationLocked = () => busy() || Boolean(keyActionBusy());

  const policyChanged = (app: Application, policy: ApplicationPolicyInput) =>
    JSON.stringify(policy) !==
    JSON.stringify(
      normalizePolicyInput(
        app.scopeMaps ?? [],
        app.supplementalScopeMaps ?? [],
        app.claimMaps ?? [],
        app.policyToggles ?? defaultApplicationPolicyToggles,
        app.clientType,
      ),
    );

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

  function syncEditorFromApp(app: Application, options: { closeEditor: boolean }) {
    setEditDisplayName(app.displayName);
    setEditLandingUrl(app.landingUrl);
    setEditRedirectText(app.redirectUris.join("\n"));
    setEditAllowedGroups([...app.allowedGroups]);
    setEditScopeMaps(structuredClone(app.scopeMaps ?? []));
    setEditSupplementalScopeMaps(structuredClone(app.supplementalScopeMaps ?? []));
    setEditClaimMaps(structuredClone(app.claimMaps ?? []));
    setEditPolicyToggles(policyTogglesForApp(app));
    if (options.closeEditor) setEditing(false);
    setDeleting(false);
    setError("");
    setImageError("");
    setSecretError("");
    setKeyActionError(null);
    setKeyActionMessage(null);
    setConfirmKeyRevoke(false);
    setClientSecret("");
    setClaimGroupId(app.allowedGroups[0] ?? "");
  }

  createEffect(() => {
    const app = selectedApp();
    if (!app) return;
    if (untrack(editing) && (untrack(busy) || untrack(keyActionBusy))) return;
    syncEditorFromApp(app, { closeEditor: true });
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
    setEditSupplementalScopeMaps(
      editSupplementalScopeMaps().filter((sm) => nextGroups.includes(sm.groupId)),
    );
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

  function toggleSupplementalScope(groupId: string, scope: string) {
    const currentScopes = supplementalScopesForEditingGroup(groupId);
    const nextScopes = toggleValue(currentScopes, scope);
    const existing = editSupplementalScopeMaps().find((sm) => sm.groupId === groupId);
    if (existing) {
      setEditSupplementalScopeMaps(
        editSupplementalScopeMaps()
          .map((sm) => (sm.groupId === groupId ? { ...sm, scopes: nextScopes } : sm))
          .filter((sm) => sm.scopes.length > 0),
      );
    } else if (nextScopes.length) {
      setEditSupplementalScopeMaps([
        ...editSupplementalScopeMaps(),
        { groupId, scopes: nextScopes },
      ]);
    }
  }

  function addCustomSupplementalScopeToGroup(groupId: string) {
    const scope = customSupplementalScope().trim();
    if (!scope) return;
    toggleSupplementalScope(groupId, scope);
    setCustomSupplementalScope("");
  }

  function upsertClaimRule() {
    const name = claimName().trim();
    const groupId = claimGroupId() || editAllowedGroups()[0] || state().groups[0]?.id || "";
    const values = claimValues()
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (!name || !groupId || !values.length) return;
    const existing = editClaimMaps().find((claimMap) => claimMap.claimName === name);
    if (existing) {
      setEditClaimMaps(
        editClaimMaps().map((claimMap) =>
          claimMap.claimName === name
            ? {
                ...claimMap,
                join: claimJoin(),
                rules: [
                  ...claimMap.rules.filter((rule) => rule.groupId !== groupId),
                  { groupId, values },
                ],
              }
            : claimMap,
        ),
      );
    } else {
      setEditClaimMaps([
        ...editClaimMaps(),
        { claimName: name, join: claimJoin(), rules: [{ groupId, values }] },
      ]);
    }
    setClaimValues("");
  }

  function removeClaimRule(claimName: string, groupId: string) {
    setEditClaimMaps(
      editClaimMaps()
        .map((claimMap) =>
          claimMap.claimName === claimName
            ? { ...claimMap, rules: claimMap.rules.filter((rule) => rule.groupId !== groupId) }
            : claimMap,
        )
        .filter((claimMap) => claimMap.rules.length > 0),
    );
  }

  function setPolicyToggle(key: ApplicationPolicyToggleKey, value: boolean) {
    setEditPolicyToggles((current) => ({ ...current, [key]: value }));
  }

  function setRefreshTokenExpiry(value: string) {
    setEditPolicyToggles((current) => ({ ...current, refreshTokenExpiry: value }));
  }

  async function revealClientSecret(app: Application) {
    setSecretBusy(true);
    setSecretError("");
    setClientSecret("");
    try {
      const secret = await getApplicationClientSecret(app.id);
      setClientSecret(secret ?? "No secret returned.");
    } catch (err) {
      setSecretError(err instanceof Error ? err.message : "Could not reveal client secret.");
    } finally {
      setSecretBusy(false);
    }
  }

  async function runKeyAction(app: Application, action: ApplicationKeyAction) {
    if (editing()) return;
    setKeyActionBusy({ appId: app.id, action });
    setKeyActionError(null);
    setKeyActionMessage(null);
    try {
      await updateApplicationKeyAction(app.id, action);
      setConfirmKeyRevoke(false);
      setKeyActionMessage({
        appId: app.id,
        text: action === "rotate" ? "OAuth keys rotated." : "OAuth keys revoked.",
      });
    } catch (err) {
      setKeyActionError({
        appId: app.id,
        text: err instanceof Error ? err.message : "Could not update OAuth keys.",
      });
    } finally {
      setKeyActionBusy(null);
    }
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
                disabled={operationLocked()}
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
                  <Show when={selectedApp()?.supplementalScopeMaps?.length}>
                    <div class="scope-map-summary">
                      <h4>Supplemental scope maps</h4>
                      <For each={selectedApp()?.supplementalScopeMaps ?? []}>
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
                  <Show when={selectedApp()?.claimMaps?.length}>
                    <div class="scope-map-summary">
                      <h4>Claim maps</h4>
                      <For each={selectedApp()?.claimMaps ?? []}>
                        {(claimMap) => (
                          <div class="scope-map-summary-row">
                            <strong>
                              {claimMap.claimName} ({claimMap.join})
                            </strong>
                            <div class="chip-row">
                              <For each={claimMap.rules}>
                                {(rule) => (
                                  <span class="chip">
                                    {labelForGroup(state().groups, rule.groupId)}:{" "}
                                    {rule.values.join(", ")}
                                  </span>
                                )}
                              </For>
                            </div>
                          </div>
                        )}
                      </For>
                    </div>
                  </Show>
                  <div class="scope-map-summary">
                    <h4>OAuth policy</h4>
                    <div class="chip-row">
                      <For
                        each={enabledPolicyLabels(selectedApp())}
                        fallback={<span class="chip">Default policy</span>}
                      >
                        {(label) => <span class="chip">{label}</span>}
                      </For>
                      <Show when={selectedApp()?.policyToggles?.refreshTokenExpiry}>
                        <span class="chip">
                          Refresh expiry: {selectedApp()?.policyToggles?.refreshTokenExpiry}
                        </span>
                      </Show>
                    </div>
                  </div>
                  <div class="detail-actions">
                    <div class="detail-action-row image-action-row">
                      <label class="file-button compact-file">
                        <Upload size={15} /> Upload image
                        <input
                          type="file"
                          accept=".png,.jpg,.jpeg,.gif,.svg,.webp"
                          disabled={imageBusy() || operationLocked()}
                          onChange={(event) => {
                            const app = selectedApp();
                            if (app) void handleAppImageUpload(app, event);
                          }}
                        />
                      </label>
                      <button
                        class="secondary-action"
                        type="button"
                        disabled={imageBusy() || operationLocked()}
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
                        disabled={operationLocked()}
                        onClick={() => setEditing(true)}
                      >
                        Edit
                      </button>
                      <Show when={selectedApp()?.clientType === "confidential"}>
                        <button
                          class="secondary-action"
                          type="button"
                          disabled={secretBusy()}
                          onClick={() => {
                            const app = selectedApp();
                            if (app) void revealClientSecret(app);
                          }}
                        >
                          {secretBusy() ? "Reading…" : "Reveal secret"}
                        </button>
                      </Show>
                      <button
                        class="secondary-action"
                        type="button"
                        disabled={operationLocked()}
                        onClick={() => {
                          const app = selectedApp();
                          if (app) void runKeyAction(app, "rotate");
                        }}
                      >
                        <RotateCw size={14} />{" "}
                        {keyActionBusyForSelectedApp("rotate") ? "Rotating…" : "Rotate keys"}
                      </button>
                      <Show
                        when={confirmKeyRevoke()}
                        fallback={
                          <button
                            class="secondary-action"
                            type="button"
                            disabled={operationLocked()}
                            onClick={() => setConfirmKeyRevoke(true)}
                          >
                            <KeyRound size={14} /> Revoke keys
                          </button>
                        }
                      >
                        <span class="muted">Confirm revoke?</span>
                        <button
                          class="danger-action"
                          type="button"
                          disabled={operationLocked()}
                          onClick={() => {
                            const app = selectedApp();
                            if (app) void runKeyAction(app, "revoke");
                          }}
                        >
                          {keyActionBusyForSelectedApp("revoke") ? "Revoking…" : "Yes, revoke"}
                        </button>
                        <button
                          class="secondary-action"
                          type="button"
                          disabled={operationLocked()}
                          onClick={() => setConfirmKeyRevoke(false)}
                        >
                          Cancel
                        </button>
                      </Show>
                      <Show when={!deleting()}>
                        <button
                          class="danger-action"
                          type="button"
                          disabled={operationLocked()}
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
                          disabled={operationLocked()}
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
                          disabled={operationLocked()}
                          onClick={() => setDeleting(false)}
                        >
                          Cancel
                        </button>
                      </Show>
                    </div>
                    <Show when={clientSecret()}>
                      <div class="secret-display">
                        <span>{clientSecret()}</span>
                      </div>
                    </Show>
                    <ErrorBox error={secretError} />
                    <ErrorBox error={selectedKeyActionError} />
                    <Show when={selectedKeyActionMessage()}>
                      <small class="muted">{selectedKeyActionMessage()}</small>
                    </Show>
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
            <GlassPanel title="Supplemental scopes">
              <Show
                when={editAllowedGroups().length > 0}
                fallback={
                  <p class="muted">Select an access group before adding supplemental scopes.</p>
                }
              >
                <For each={editAllowedGroups()}>
                  {(groupId) => (
                    <div class="scope-map-editor">
                      <strong>{labelForGroup(state().groups, groupId)}</strong>
                      <div class="scope-toggle-row">
                        <For each={[...standardScopes, ...extraScopes()]}>
                          {(scope) => {
                            const active = () =>
                              supplementalScopesForEditingGroup(groupId).includes(scope);
                            return (
                              <button
                                class={active() ? "scope-toggle selected" : "scope-toggle"}
                                type="button"
                                onClick={() => toggleSupplementalScope(groupId, scope)}
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
                          placeholder="Supplemental scope"
                          value={customSupplementalScope()}
                          onInput={(e) => setCustomSupplementalScope(e.currentTarget.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addCustomSupplementalScopeToGroup(groupId);
                            }
                          }}
                        />
                        <button
                          class="secondary-action"
                          type="button"
                          onClick={() => addCustomSupplementalScopeToGroup(groupId)}
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
            <GlassPanel title="Claim maps">
              <div class="claim-map-form">
                <TextField label="Claim name" value={claimName()} onInput={setClaimName} />
                <label>
                  Group
                  <select
                    value={claimGroupId() || editAllowedGroups()[0] || ""}
                    onInput={(event) => setClaimGroupId(event.currentTarget.value)}
                  >
                    <For each={state().groups}>
                      {(group) => <option value={group.id}>{group.displayName}</option>}
                    </For>
                  </select>
                </label>
                <label>
                  Join
                  <select
                    value={claimJoin()}
                    onInput={(event) =>
                      setClaimJoin(event.currentTarget.value as ApplicationClaimMapJoin)
                    }
                  >
                    <option value="array">Array</option>
                    <option value="csv">CSV</option>
                    <option value="ssv">Space-separated</option>
                  </select>
                </label>
                <label>
                  Claim values
                  <input
                    type="text"
                    value={claimValues()}
                    onInput={(event) => setClaimValues(event.currentTarget.value)}
                    placeholder="admin, owner"
                  />
                </label>
                <button class="secondary-action" type="button" onClick={upsertClaimRule}>
                  <Plus size={14} /> Add claim rule
                </button>
              </div>
              <For each={editClaimMaps()} fallback={<p class="muted">No claim maps configured.</p>}>
                {(claimMap) => (
                  <div class="scope-map-summary-row claim-map-row">
                    <strong>
                      {claimMap.claimName} ({claimMap.join})
                    </strong>
                    <div class="chip-row">
                      <For each={claimMap.rules}>
                        {(rule) => (
                          <button
                            class="chip removable-chip"
                            type="button"
                            onClick={() => removeClaimRule(claimMap.claimName, rule.groupId)}
                          >
                            {labelForGroup(state().groups, rule.groupId)}: {rule.values.join(", ")}
                          </button>
                        )}
                      </For>
                    </div>
                  </div>
                )}
              </For>
            </GlassPanel>
          </Show>

          <Show when={editing()}>
            <GlassPanel title="OAuth policy">
              <div class="oauth-policy-grid toggle-row">
                <For each={oauthPolicyToggleOptions}>
                  {(option) => {
                    const blocked = () =>
                      option.publicOnly && selectedApp()?.clientType !== "public";
                    return (
                      <label
                        class={blocked() ? "oauth-policy-toggle disabled" : "oauth-policy-toggle"}
                      >
                        <input
                          type="checkbox"
                          checked={!blocked() && editPolicyToggles()[option.key]}
                          disabled={blocked()}
                          onChange={(event) =>
                            setPolicyToggle(option.key, event.currentTarget.checked)
                          }
                        />
                        <span>
                          <strong>{option.label}</strong>
                          <small>
                            {option.attr}
                            <Show when={blocked()}> · Public clients only</Show>
                          </small>
                        </span>
                      </label>
                    );
                  }}
                </For>
              </div>
              <div class="field-stack compact-fields">
                <label>
                  Refresh token expiry
                  <input
                    type="text"
                    value={editPolicyToggles().refreshTokenExpiry}
                    onInput={(event) => setRefreshTokenExpiry(event.currentTarget.value)}
                    placeholder="3600"
                  />
                </label>
              </div>
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
                    const nextPolicy = normalizePolicyInput(
                      editScopeMaps(),
                      editSupplementalScopeMaps(),
                      editClaimMaps(),
                      editPolicyToggles(),
                      app.clientType,
                    );
                    if (refreshTokenExpiryClearUnsupported(app, nextPolicy.policyToggles)) {
                      setError(
                        [
                          "Kanidm OAuth2 does not expose a clear operation for refresh token",
                          "expiry. Enter a replacement value instead.",
                        ].join(" "),
                      );
                      return;
                    }
                    const shouldUpdatePolicy = policyChanged(app, nextPolicy);

                    if (Object.keys(patch).length > 0) {
                      await updateApplication(app.id, patch);
                    }

                    if (shouldUpdatePolicy) {
                      await updateApplicationPolicy(app.id, nextPolicy);
                    }

                    const savedApp = selectedApp();
                    if (savedApp) {
                      syncEditorFromApp(savedApp, { closeEditor: true });
                    } else {
                      setEditing(false);
                    }
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
                  const app = selectedApp();
                  if (app) syncEditorFromApp(app, { closeEditor: true });
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

function normalizePolicyInput(
  scopeMaps: ApplicationScopeMap[],
  supplementalScopeMaps: ApplicationScopeMap[],
  claimMaps: ApplicationPolicyInput["claimMaps"],
  policyToggles: ApplicationPolicyToggles,
  clientType: Application["clientType"],
): ApplicationPolicyInput {
  return {
    scopeMaps: normalizeScopeMaps(scopeMaps),
    supplementalScopeMaps: normalizeScopeMaps(supplementalScopeMaps),
    claimMaps: claimMaps
      .map((claimMap) => ({
        claimName: claimMap.claimName.trim(),
        join: claimMap.join,
        rules: claimMap.rules
          .map((rule) => ({
            groupId: rule.groupId,
            values: [...new Set(rule.values.map((value) => value.trim()).filter(Boolean))],
          }))
          .filter((rule) => rule.groupId && rule.values.length)
          .sort((left, right) => left.groupId.localeCompare(right.groupId)),
      }))
      .filter((claimMap) => claimMap.claimName && claimMap.rules.length)
      .sort((left, right) => left.claimName.localeCompare(right.claimName)),
    policyToggles: normalizePolicyToggles(policyToggles, clientType),
  };
}

function normalizeScopeMaps(scopeMaps: ApplicationScopeMap[]) {
  return scopeMaps
    .map((scopeMap) => ({
      groupId: scopeMap.groupId,
      scopes: [...new Set(scopeMap.scopes.map((scope) => scope.trim()).filter(Boolean))].sort(),
    }))
    .filter((scopeMap) => scopeMap.groupId && scopeMap.scopes.length)
    .sort((left, right) => left.groupId.localeCompare(right.groupId));
}

function policyTogglesForApp(app: Application): ApplicationPolicyToggles {
  return {
    ...defaultApplicationPolicyToggles,
    ...app.policyToggles,
  };
}

function normalizePolicyToggles(
  policyToggles: ApplicationPolicyToggles,
  clientType: Application["clientType"],
): ApplicationPolicyToggles {
  return {
    ...policyToggles,
    allowLocalhostRedirect: clientType === "public" ? policyToggles.allowLocalhostRedirect : false,
    refreshTokenExpiry: policyToggles.refreshTokenExpiry.trim(),
  };
}

function refreshTokenExpiryClearUnsupported(
  app: Application,
  policyToggles: ApplicationPolicyToggles,
) {
  return Boolean(app.policyToggles?.refreshTokenExpiry && !policyToggles.refreshTokenExpiry);
}

function enabledPolicyLabels(app: Application | undefined) {
  if (!app) return [];
  const toggles = normalizePolicyToggles(policyTogglesForApp(app), app.clientType);
  return oauthPolicyToggleOptions
    .filter((option) => toggles[option.key])
    .map((option) => option.label);
}
