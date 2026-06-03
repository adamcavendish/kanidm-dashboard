import { createSignal, For, Show } from "solid-js";
import { ArrowRight, Check, CircleAlert, ClipboardCheck } from "lucide-solid";
import type { ApplicationScopeMap, CreatedApplication, NewApplicationInput } from "../../domain";
import { useConsole } from "../../store";
import GlassPanel from "../../components/glass-panel";
import KeyValue from "../../components/key-value";
import OptionGrid from "../../components/option-grid";
import PageHeader from "../../components/page-header";
import ReviewPanel from "../../components/review-panel";
import TextField from "../../components/text-field";
import { Link } from "../../routing";
import { scopeDetails, standardScopes } from "../../oauth-scopes";
import { toggleValue, uniqueValues } from "../../utils/collections";
export function NewApplicationPage() {
  const { state, addApplication } = useConsole();
  const [review, setReview] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [redirectError, setRedirectError] = createSignal("");
  const [redirectText, setRedirectText] = createSignal("");
  const [createdApplication, setCreatedApplication] = createSignal<CreatedApplication | null>(null);
  const [input, setInput] = createSignal<NewApplicationInput>({
    name: "",
    displayName: "",
    landingUrl: "",
    imageUrl: "",
    clientType: "confidential",
    redirectUris: [],
    allowedGroups: [],
    scopes: ["openid", "profile", "email"],
  });
  const redirectUris = () =>
    redirectText()
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  const affectedPeople = () =>
    state().people.filter((person) =>
      person.groups.some((groupId) => input().allowedGroups.includes(groupId)),
    );
  const selectedGroups = () =>
    state().groups.filter((group) => input().allowedGroups.includes(group.id));
  const scopesForGroup = (groupId: string) =>
    input().scopeMaps?.find((scopeMap) => scopeMap.groupId === groupId)?.scopes ?? input().scopes;
  const effectiveScopeMaps = (): ApplicationScopeMap[] =>
    input().allowedGroups.map((groupId) => ({
      groupId,
      scopes: uniqueValues(scopesForGroup(groupId)),
    }));
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
  const [customScope, setCustomScope] = createSignal("");
  const customScopes = () => input().scopes.filter((s) => !standardScopes.includes(s));

  function addCustomScope() {
    const scope = customScope().trim();
    if (!scope || input().scopes.includes(scope)) return;
    setInput({ ...input(), scopes: [...input().scopes, scope] });
    setCustomScope("");
  }

  const canSubmit = () =>
    input().name.trim() &&
    input().displayName.trim() &&
    input().landingUrl.trim() &&
    redirectUris().length > 0 &&
    input().allowedGroups.length > 0 &&
    input().scopes.length > 0 &&
    input().scopes.includes("openid");

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    await submitApplication();
  }

  async function submitApplication() {
    if (!canSubmit()) return;
    const appInput = {
      ...input(),
      redirectUris: redirectUris(),
      scopeMaps: effectiveScopeMaps(),
    };
    if (!review()) {
      setReview(true);
      return;
    }
    setBusy(true);
    setRedirectError("");
    try {
      setCreatedApplication(await addApplication(appInput));
    } catch (err) {
      setRedirectError(err instanceof Error ? err.message : "Could not create application.");
    } finally {
      setBusy(false);
    }
  }

  function toggleAccessGroup(groupId: string) {
    const nextGroups = toggleValue(input().allowedGroups, groupId);
    setInput({
      ...input(),
      allowedGroups: nextGroups,
      scopeMaps: input().scopeMaps?.filter((scopeMap) => nextGroups.includes(scopeMap.groupId)),
    });
    setReview(false);
  }

  function toggleGroupScope(groupId: string, scope: string) {
    const nextScopes = toggleValue(scopesForGroup(groupId), scope);
    setInput({
      ...input(),
      scopeMaps: input().allowedGroups.map((allowedGroupId) => ({
        groupId: allowedGroupId,
        scopes: allowedGroupId === groupId ? nextScopes : scopesForGroup(allowedGroupId),
      })),
    });
    setReview(false);
  }

  return (
    <>
      <Show when={createdApplication()} keyed>
        {(app) => <CreatedApplicationSummary app={app} />}
      </Show>
      <div style={{ display: createdApplication() ? "none" : "contents" }}>
        <PageHeader eyebrow="Admin" title="Add application" />
        <form class="wizard-layout" onSubmit={submit}>
          <div class="form-stack">
            <GlassPanel title="Application">
              <TextField
                label="System name"
                value={input().name}
                onInput={(value) => setInput({ ...input(), name: value })}
                required
              />
              <TextField
                label="Display name"
                value={input().displayName}
                onInput={(value) => setInput({ ...input(), displayName: value })}
                required
              />
              <TextField
                label="Landing URL"
                value={input().landingUrl}
                onInput={(value) => setInput({ ...input(), landingUrl: value })}
                type="url"
                required
              />
              <TextField
                label="Image URL"
                value={input().imageUrl}
                onInput={(value) => setInput({ ...input(), imageUrl: value })}
              />
            </GlassPanel>
            <GlassPanel title="OIDC settings">
              <label>
                Client type
                <select
                  value={input().clientType}
                  onChange={(event) =>
                    setInput({
                      ...input(),
                      clientType: event.currentTarget.value as NewApplicationInput["clientType"],
                    })
                  }
                >
                  <option value="confidential">Confidential client</option>
                  <option value="public">Public client</option>
                </select>
              </label>
              <label>
                Redirect URIs
                <textarea
                  rows={4}
                  value={redirectText()}
                  onInput={(event) => setRedirectText(event.currentTarget.value)}
                  placeholder="https://app.example/oauth/callback"
                  required
                />
              </label>
              <label>
                Custom scope
                <input
                  value={customScope()}
                  onInput={(event) => setCustomScope(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addCustomScope();
                    }
                  }}
                  placeholder="Type a scope and press Enter"
                />
              </label>
              <OptionGrid
                options={standardScopes.map((scope) => ({
                  id: scope,
                  label: scope,
                  detail: scopeDetails[scope] ?? "",
                }))}
                selected={input().scopes}
                onToggle={(scope) =>
                  setInput({
                    ...input(),
                    scopes: toggleValue(input().scopes, scope),
                  })
                }
              />
              <Show when={extraScopes().length > 0}>
                <div class="suggestion-row">
                  <span class="muted">From existing apps:</span>
                  <For each={extraScopes()}>
                    {(scope) => (
                      <button
                        class="tag-button"
                        type="button"
                        disabled={input().scopes.includes(scope)}
                        onClick={() =>
                          setInput({
                            ...input(),
                            scopes: [...new Set([...input().scopes, scope])],
                          })
                        }
                      >
                        + {scope}
                      </button>
                    )}
                  </For>
                </div>
              </Show>
              <Show when={customScopes().length > 0}>
                <div class="option-grid">
                  <For each={customScopes()}>
                    {(scope) => (
                      <button
                        class="option-card custom-scope"
                        type="button"
                        onClick={() =>
                          setInput({
                            ...input(),
                            scopes: input().scopes.filter((s) => s !== scope),
                          })
                        }
                      >
                        <span>
                          <Check size={16} />
                        </span>
                        <strong>{scope}</strong>
                        <small>Custom scope</small>
                      </button>
                    )}
                  </For>
                </div>
              </Show>
            </GlassPanel>
            <GlassPanel title="Access groups">
              <OptionGrid
                options={state().groups.map((group) => ({
                  id: group.id,
                  label: group.displayName,
                  detail: `${group.members.length} members`,
                }))}
                selected={input().allowedGroups}
                onToggle={toggleAccessGroup}
              />
              <Show when={selectedGroups().length}>
                <div class="scope-map-editor">
                  <For each={selectedGroups()}>
                    {(group) => (
                      <div class="scope-map-row">
                        <div>
                          <strong>{group.displayName}</strong>
                          <small>Scopes granted through this access group</small>
                        </div>
                        <div class="scope-map-options">
                          <For each={input().scopes}>
                            {(scope) => {
                              const selected = () => scopesForGroup(group.id).includes(scope);
                              return (
                                <button
                                  aria-pressed={selected()}
                                  class={selected() ? "scope-toggle selected" : "scope-toggle"}
                                  type="button"
                                  onClick={() => toggleGroupScope(group.id, scope)}
                                >
                                  {scope}
                                </button>
                              );
                            }}
                          </For>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </GlassPanel>
            <GlassPanel title="Unsupported surfaces">
              <div class="disabled-chip-row">
                <For each={["Proxy mode", "Flow builder", "SAML provider", "Outbound SCIM"]}>
                  {(surface) => <span>{surface}</span>}
                </For>
              </div>
            </GlassPanel>
            <Show when={redirectError()}>
              <div class="review-box danger">
                <CircleAlert size={18} />
                <span>{redirectError()}</span>
              </div>
            </Show>
          </div>
          <ReviewPanel
            active={review()}
            title="Application review"
            items={[
              `Create OAuth2/OIDC app ${input().displayName || "new application"}`,
              `${redirectUris().length} redirect URI${redirectUris().length === 1 ? "" : "s"}`,
              `${effectiveScopeMaps().length} access scope map${effectiveScopeMaps().length === 1 ? "" : "s"}`,
              `${affectedPeople().length} person${affectedPeople().length === 1 ? "" : "s"} will see this app`,
            ]}
            action={
              busy()
                ? "Creating application"
                : review()
                  ? "Create application"
                  : "Review application"
            }
            disabled={!canSubmit() || busy()}
            onAction={() => {
              void submitApplication();
            }}
          />
        </form>
      </div>
    </>
  );
}

export function CreatedApplicationSummary(props: { app: CreatedApplication }) {
  const secret = () => props.app.clientSecret ?? "";
  const issuerUrl = () => `${window.location.origin}/oauth2/openid/${props.app.name}`;
  const tokenEndpoint = () => `${props.app.landingUrl.replace(/\/$/, "")}/v2/token`;
  const snippet = () =>
    [
      "[auth]",
      `issuer_url = "${issuerUrl()}"`,
      `client_id = "${props.app.name}"`,
      props.app.clientType === "confidential"
        ? `client_secret = "${secret() || "<client-secret>"}"`
        : "",
      `token_endpoint_url = "${tokenEndpoint()}"`,
      `redirect_uri = "${props.app.redirectUris[0] ?? ""}"`,
    ]
      .filter(Boolean)
      .join("\n");

  return (
    <>
      <PageHeader eyebrow="Admin" title="Application created" />
      <div class="form-stack">
        <GlassPanel title="Client credentials">
          <div class="theme-grid">
            <KeyValue label="Client ID" value={props.app.name} />
            <KeyValue label="Issuer URL" value={issuerUrl()} />
            <KeyValue label="Redirect URI" value={props.app.redirectUris[0] ?? "Not configured"} />
          </div>
          <Show when={props.app.clientType === "confidential"}>
            <div class="secret-display">
              <span>{secret() || "Client secret was not returned."}</span>
              <button
                class="secondary-action"
                type="button"
                disabled={!secret()}
                onClick={() => navigator.clipboard?.writeText(secret())}
              >
                <ClipboardCheck size={16} /> Copy secret
              </button>
            </div>
          </Show>
          <pre class="config-code">{snippet()}</pre>
          <div class="button-row">
            <Link class="primary-action" href="/admin/apps">
              Open applications <ArrowRight size={16} />
            </Link>
            <Link class="secondary-action" href="/admin/apps/new">
              Add another application
            </Link>
          </div>
        </GlassPanel>
      </div>
    </>
  );
}
