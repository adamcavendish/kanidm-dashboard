import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import {
  BadgeCheck,
  CircleAlert,
  ClipboardCheck,
  KeyRound,
  Plus,
  RefreshCw,
  Save,
  ServerCog,
  ShieldCheck,
  Terminal,
  Trash2,
} from "lucide-solid";
import type {
  ServiceAccount,
  ServiceAccountApiToken,
  ServiceAccountCredentialStatus,
  SshPublicKey,
} from "../../domain";
import { useConsole } from "../../store";
import GlassPanel from "../../components/glass-panel";
import KeyValue from "../../components/key-value";
import PageHeader from "../../components/page-header";
import { AppStatusBadge } from "../../components/status-badge";
import { Toolbar } from "../../components/toolbar";
import { Link } from "../../routing";
import { formatDateTime, shortId } from "../../utils/format";
import { labelForGroup } from "../../utils/labels";
import { searchable } from "../../utils/search";

type BusyState =
  | ""
  | "profile"
  | "delete"
  | "groups"
  | "tokens"
  | "token-delete"
  | "credential"
  | "ssh"
  | "unix";

export function ServiceAccountsPage() {
  const {
    state,
    updateServiceAccount,
    deleteServiceAccount,
    toggleServiceAccountGroup,
    getServiceAccountApiTokens,
    generateServiceAccountApiToken,
    deleteServiceAccountApiToken,
    getServiceAccountCredentialStatus,
    generateServiceAccountPassword,
    getServiceAccountSshPublicKeys,
    addServiceAccountSshPublicKey,
    deleteServiceAccountSshPublicKey,
    extendServiceAccountUnixAccount,
  } = useConsole();
  const [query, setQuery] = createSignal("");
  const [selectedServiceAccountId, setSelectedServiceAccountId] = createSignal(
    state().serviceAccounts[0]?.id ?? "",
  );
  const [editing, setEditing] = createSignal(false);
  const [displayName, setDisplayName] = createSignal("");
  const [description, setDescription] = createSignal("");
  const [managedBy, setManagedBy] = createSignal("");
  const [apiTokens, setApiTokens] = createSignal<ServiceAccountApiToken[]>([]);
  const [generatedToken, setGeneratedToken] = createSignal("");
  const [tokenLabel, setTokenLabel] = createSignal("automation token");
  const [tokenExpiry, setTokenExpiry] = createSignal("");
  const [tokenReadWrite, setTokenReadWrite] = createSignal(true);
  const [tokenCompact, setTokenCompact] = createSignal(false);
  const [credentialStatus, setCredentialStatus] =
    createSignal<ServiceAccountCredentialStatus | null>(null);
  const [sshKeys, setSshKeys] = createSignal<SshPublicKey[]>([]);
  const [sshTag, setSshTag] = createSignal("deploy-host");
  const [sshKey, setSshKey] = createSignal("");
  const [unixGid, setUnixGid] = createSignal("");
  const [unixShell, setUnixShell] = createSignal("");
  const [deleteText, setDeleteText] = createSignal("");
  const [tokenDeleteId, setTokenDeleteId] = createSignal("");
  const [busy, setBusy] = createSignal<BusyState>("");
  const [error, setError] = createSignal("");
  const [message, setMessage] = createSignal("");
  const [operationWarnings, setOperationWarnings] = createSignal<string[]>([]);
  let vaultRefreshRequest = 0;

  const serviceAccounts = () =>
    state().serviceAccounts.filter((serviceAccount) =>
      searchable(serviceAccount).includes(query().toLowerCase()),
    );
  const selectedServiceAccount = () =>
    serviceAccounts().find((serviceAccount) => serviceAccount.id === selectedServiceAccountId()) ??
    serviceAccounts()[0];
  const selectedGroups = createMemo(() => {
    const serviceAccount = selectedServiceAccount();
    if (!serviceAccount) return [];
    return state().groups.filter((group) => serviceAccount.groups.includes(group.id));
  });

  function isSelectedServiceAccount(serviceAccountId: string) {
    return selectedServiceAccount()?.id === serviceAccountId;
  }

  createEffect(() => {
    const first = state().serviceAccounts[0]?.id ?? "";
    if (!selectedServiceAccountId() && first) setSelectedServiceAccountId(first);
    if (
      selectedServiceAccountId() &&
      !state().serviceAccounts.some(
        (serviceAccount) => serviceAccount.id === selectedServiceAccountId(),
      )
    ) {
      setSelectedServiceAccountId(first);
    }
  });

  createEffect(() => {
    const serviceAccount = selectedServiceAccount();
    if (!serviceAccount) return;
    setDisplayName(serviceAccount.displayName);
    setDescription(serviceAccount.description);
    setManagedBy(serviceAccount.managedBy);
    setApiTokens([]);
    setGeneratedToken("");
    setCredentialStatus(null);
    setSshKeys([]);
    setUnixGid(serviceAccount.unix.gidNumber === null ? "" : String(serviceAccount.unix.gidNumber));
    setUnixShell(serviceAccount.unix.shell);
    setOperationWarnings([]);
    setError("");
    setMessage("");
    setEditing(false);
    setDeleteText("");
    setTokenDeleteId("");
    void refreshVaultData(serviceAccount.id);
  });

  async function refreshVaultData(serviceAccountId = selectedServiceAccount()?.id) {
    if (!serviceAccountId) return;
    const requestId = ++vaultRefreshRequest;
    const warnings: string[] = [];
    setBusy("tokens");
    setError("");
    setOperationWarnings([]);
    const optionalRead = async <T,>(
      label: string,
      fallback: T,
      operation: () => Promise<T>,
    ): Promise<T> => {
      try {
        return await operation();
      } catch (err) {
        const detail = err instanceof Error ? err.message : "not available";
        warnings.push(`${label}: ${detail}`);
        return fallback;
      }
    };
    try {
      const [nextTokens, nextKeys, nextStatus] = await Promise.all([
        optionalRead("API tokens", [] as ServiceAccountApiToken[], () =>
          getServiceAccountApiTokens(serviceAccountId),
        ),
        optionalRead("SSH keys", [] as SshPublicKey[], () =>
          getServiceAccountSshPublicKeys(serviceAccountId),
        ),
        optionalRead("Credential status", null as ServiceAccountCredentialStatus | null, () =>
          getServiceAccountCredentialStatus(serviceAccountId),
        ),
      ]);
      if (requestId !== vaultRefreshRequest || selectedServiceAccount()?.id !== serviceAccountId) {
        return;
      }
      setApiTokens(nextTokens);
      setSshKeys(nextKeys);
      setCredentialStatus(nextStatus);
      setOperationWarnings(warnings);
    } catch (err) {
      if (requestId !== vaultRefreshRequest) return;
      setError(err instanceof Error ? err.message : "Could not load service account operations.");
    } finally {
      if (requestId === vaultRefreshRequest) setBusy("");
    }
  }

  async function saveProfile(serviceAccount: ServiceAccount) {
    setBusy("profile");
    setError("");
    setMessage("");
    try {
      await updateServiceAccount(serviceAccount.id, {
        displayName: displayName(),
        description: description(),
        managedBy: managedBy(),
      });
      setEditing(false);
      setMessage("Service account updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update service account.");
    } finally {
      setBusy("");
    }
  }

  async function toggleMembership(serviceAccount: ServiceAccount, groupId: string) {
    setBusy("groups");
    setError("");
    try {
      await toggleServiceAccountGroup(serviceAccount.id, groupId);
      setMessage("Group membership updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update group membership.");
    } finally {
      setBusy("");
    }
  }

  async function generateToken(serviceAccount: ServiceAccount) {
    const serviceAccountId = serviceAccount.id;
    setBusy("tokens");
    setError("");
    setMessage("");
    setGeneratedToken("");
    try {
      const result = await generateServiceAccountApiToken(serviceAccountId, {
        label: tokenLabel(),
        expiry: tokenExpiry(),
        readWrite: tokenReadWrite(),
        compact: tokenCompact(),
      });
      if (!isSelectedServiceAccount(serviceAccountId)) return;
      setGeneratedToken(result.token);
      setApiTokens(result.tokens);
      setMessage("API token generated.");
    } catch (err) {
      if (!isSelectedServiceAccount(serviceAccountId)) return;
      setError(err instanceof Error ? err.message : "Could not generate API token.");
    } finally {
      if (isSelectedServiceAccount(serviceAccountId)) setBusy("");
    }
  }

  async function removeToken(serviceAccount: ServiceAccount, tokenId: string) {
    const serviceAccountId = serviceAccount.id;
    setBusy("token-delete");
    setError("");
    try {
      const nextTokens = await deleteServiceAccountApiToken(serviceAccountId, tokenId);
      if (!isSelectedServiceAccount(serviceAccountId)) return;
      setApiTokens(nextTokens);
      setTokenDeleteId("");
      setMessage("API token deleted.");
    } catch (err) {
      if (!isSelectedServiceAccount(serviceAccountId)) return;
      setError(err instanceof Error ? err.message : "Could not delete API token.");
    } finally {
      if (isSelectedServiceAccount(serviceAccountId)) setBusy("");
    }
  }

  async function checkCredentialStatus(serviceAccount: ServiceAccount) {
    const serviceAccountId = serviceAccount.id;
    setBusy("credential");
    setError("");
    try {
      const status = await getServiceAccountCredentialStatus(serviceAccountId);
      if (!isSelectedServiceAccount(serviceAccountId)) return;
      setCredentialStatus(status);
      setMessage("Credential status refreshed.");
    } catch (err) {
      if (!isSelectedServiceAccount(serviceAccountId)) return;
      setError(err instanceof Error ? err.message : "Could not read credential status.");
    } finally {
      if (isSelectedServiceAccount(serviceAccountId)) setBusy("");
    }
  }

  async function generateCredential(serviceAccount: ServiceAccount) {
    const serviceAccountId = serviceAccount.id;
    setBusy("credential");
    setError("");
    try {
      const status = await generateServiceAccountPassword(serviceAccountId);
      if (!isSelectedServiceAccount(serviceAccountId)) return;
      setCredentialStatus(status);
      setMessage("Service account credential generated.");
    } catch (err) {
      if (!isSelectedServiceAccount(serviceAccountId)) return;
      setError(err instanceof Error ? err.message : "Could not generate credential.");
    } finally {
      if (isSelectedServiceAccount(serviceAccountId)) setBusy("");
    }
  }

  async function addSshKey(serviceAccount: ServiceAccount) {
    const serviceAccountId = serviceAccount.id;
    setBusy("ssh");
    setError("");
    try {
      const nextKeys = await addServiceAccountSshPublicKey(serviceAccountId, sshTag(), sshKey());
      if (!isSelectedServiceAccount(serviceAccountId)) return;
      setSshKeys(nextKeys);
      setSshKey("");
      setMessage("SSH key added.");
    } catch (err) {
      if (!isSelectedServiceAccount(serviceAccountId)) return;
      setError(err instanceof Error ? err.message : "Could not add SSH key.");
    } finally {
      if (isSelectedServiceAccount(serviceAccountId)) setBusy("");
    }
  }

  async function removeSshKey(serviceAccount: ServiceAccount, tag: string) {
    const serviceAccountId = serviceAccount.id;
    setBusy("ssh");
    setError("");
    try {
      const nextKeys = await deleteServiceAccountSshPublicKey(serviceAccountId, tag);
      if (!isSelectedServiceAccount(serviceAccountId)) return;
      setSshKeys(nextKeys);
      setMessage("SSH key removed.");
    } catch (err) {
      if (!isSelectedServiceAccount(serviceAccountId)) return;
      setError(err instanceof Error ? err.message : "Could not remove SSH key.");
    } finally {
      if (isSelectedServiceAccount(serviceAccountId)) setBusy("");
    }
  }

  async function saveUnix(serviceAccount: ServiceAccount) {
    setBusy("unix");
    setError("");
    try {
      const gidNumber = parseUnixGid(unixGid());
      await extendServiceAccountUnixAccount(serviceAccount.id, {
        gidNumber,
        shell: unixShell(),
      });
      setMessage("Unix settings updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update Unix settings.");
    } finally {
      setBusy("");
    }
  }

  async function confirmDelete(serviceAccount: ServiceAccount) {
    setBusy("delete");
    setError("");
    try {
      await deleteServiceAccount(serviceAccount.id);
      setSelectedServiceAccountId(state().serviceAccounts[0]?.id ?? "");
      setMessage("Service account deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete service account.");
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Service accounts"
        action={
          <Link class="primary-action" href="/admin/service-accounts/new">
            <Plus size={16} /> Add service account
          </Link>
        }
      />
      <Toolbar query={query()} onQuery={setQuery} placeholder="Search service accounts" />
      <Show when={error()}>
        <div class="review-box danger">
          <CircleAlert size={18} />
          <span>{error()}</span>
        </div>
      </Show>
      <Show when={message()}>
        <div class="review-box success">
          <BadgeCheck size={18} />
          <span>{message()}</span>
        </div>
      </Show>
      <div class="split-admin service-account-vault">
        <div class="resource-list">
          <For
            each={serviceAccounts()}
            fallback={
              <div class="resource-empty">
                <strong>No service accounts found</strong>
                <small>
                  {query().trim()
                    ? `No service accounts match "${query().trim()}".`
                    : "No service accounts are available."}
                </small>
              </div>
            }
          >
            {(serviceAccount) => (
              <button
                class={
                  serviceAccount.id === selectedServiceAccount()?.id
                    ? "resource-row active"
                    : "resource-row"
                }
                type="button"
                aria-current={
                  serviceAccount.id === selectedServiceAccount()?.id ? "true" : undefined
                }
                aria-pressed={serviceAccount.id === selectedServiceAccount()?.id}
                onClick={() => setSelectedServiceAccountId(serviceAccount.id)}
              >
                <ServerCog size={18} />
                <span>
                  <strong>{serviceAccount.displayName}</strong>
                  <small>{serviceAccount.name}</small>
                </span>
                <AppStatusBadge status={serviceAccount.status} />
              </button>
            )}
          </For>
        </div>

        <Show
          when={selectedServiceAccount()}
          fallback={
            <div class="resource-detail">
              <GlassPanel title="No matching service account">
                <p class="muted">
                  {query().trim()
                    ? `No service account matches "${query().trim()}".`
                    : "No service accounts are available."}
                </p>
              </GlassPanel>
            </div>
          }
        >
          {(serviceAccount) => (
            <div class="resource-detail service-account-detail">
              <GlassPanel title={serviceAccount().displayName}>
                <div class="person-summary-grid">
                  <KeyValue label="Name" value={serviceAccount().name} variant="detail" />
                  <KeyValue
                    label="Managed by"
                    value={labelForGroup(state().groups, serviceAccount().managedBy) || "None"}
                    variant="detail"
                  />
                  <KeyValue
                    label="Status"
                    value={<AppStatusBadge status={serviceAccount().status} />}
                    variant="detail"
                  />
                  <KeyValue
                    label="Unix"
                    value={serviceAccount().unix.credentialSet ? "Configured" : "Not configured"}
                    variant="detail"
                  />
                </div>
                <p class="muted">{serviceAccount().description || "No description"}</p>
                <div class="service-posture-grid">
                  <div>
                    <strong>{apiTokens().length}</strong>
                    <small>API tokens</small>
                  </div>
                  <div>
                    <strong>{sshKeys().length}</strong>
                    <small>SSH keys</small>
                  </div>
                  <div>
                    <strong>{selectedGroups().length}</strong>
                    <small>Groups</small>
                  </div>
                </div>
                <div class="detail-actions">
                  <div class="detail-action-row">
                    <button
                      class="primary-action"
                      type="button"
                      onClick={() => setEditing(!editing())}
                    >
                      <Save size={16} /> {editing() ? "Close editor" : "Edit service account"}
                    </button>
                    <button
                      class="secondary-action"
                      type="button"
                      disabled={busy() === "tokens"}
                      onClick={() => void refreshVaultData(serviceAccount().id)}
                    >
                      <RefreshCw size={16} /> Refresh vault
                    </button>
                  </div>
                </div>
              </GlassPanel>

              <Show when={operationWarnings().length}>
                <div class="review-box warning compact-warning">
                  <CircleAlert size={18} />
                  <span>
                    Some live vault details are unavailable for this account. Mutation actions still
                    report failures directly.
                  </span>
                </div>
              </Show>

              <Show when={editing()}>
                <GlassPanel title="Profile">
                  <div class="profile-edit-grid">
                    <label>
                      Display name
                      <input
                        value={displayName()}
                        onInput={(event) => setDisplayName(event.currentTarget.value)}
                      />
                    </label>
                    <label>
                      Managed by
                      <select
                        value={managedBy()}
                        onChange={(event) => setManagedBy(event.currentTarget.value)}
                      >
                        <option value="">None</option>
                        <For each={state().groups}>
                          {(group) => <option value={group.id}>{group.displayName}</option>}
                        </For>
                      </select>
                    </label>
                    <label>
                      Description
                      <textarea
                        rows={3}
                        value={description()}
                        onInput={(event) => setDescription(event.currentTarget.value)}
                      />
                    </label>
                  </div>
                  <button
                    class="primary-action"
                    type="button"
                    disabled={busy() === "profile"}
                    onClick={() => void saveProfile(serviceAccount())}
                  >
                    <Save size={16} /> Save profile
                  </button>
                </GlassPanel>
              </Show>

              <GlassPanel title="Groups and access">
                <div class="membership-summary">
                  <h4>Direct memberships</h4>
                  <Show
                    when={selectedGroups().length}
                    fallback={<p class="muted">No direct group memberships.</p>}
                  >
                    <div class="chip-row">
                      <For each={selectedGroups()}>
                        {(group) => <span class="chip">{group.displayName}</span>}
                      </For>
                    </div>
                  </Show>
                </div>
                <div class="membership-summary">
                  <h4>Membership controls</h4>
                </div>
                <Show
                  when={state().groups.length}
                  fallback={<p class="muted">No groups are available.</p>}
                >
                  <div class="group-toggle-grid">
                    <For each={state().groups}>
                      {(group) => (
                        <button
                          class={
                            serviceAccount().groups.includes(group.id)
                              ? "member-pill selected"
                              : "member-pill"
                          }
                          type="button"
                          aria-pressed={serviceAccount().groups.includes(group.id)}
                          disabled={busy() === "groups"}
                          onClick={() => void toggleMembership(serviceAccount(), group.id)}
                        >
                          {labelForGroup(state().groups, group.id)}
                        </button>
                      )}
                    </For>
                  </div>
                </Show>
              </GlassPanel>

              <div class="person-ops-grid">
                <GlassPanel title="API tokens">
                  <div class="form-stack compact-form">
                    <label>
                      Label
                      <input
                        value={tokenLabel()}
                        onInput={(event) => setTokenLabel(event.currentTarget.value)}
                      />
                    </label>
                    <label>
                      Expiry
                      <input
                        value={tokenExpiry()}
                        placeholder="Optional RFC3339 timestamp"
                        onInput={(event) => setTokenExpiry(event.currentTarget.value)}
                      />
                    </label>
                    <div class="toggle-row">
                      <label>
                        <input
                          type="checkbox"
                          checked={tokenReadWrite()}
                          onChange={(event) => setTokenReadWrite(event.currentTarget.checked)}
                        />
                        Read/write
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={tokenCompact()}
                          onChange={(event) => setTokenCompact(event.currentTarget.checked)}
                        />
                        Compact token
                      </label>
                    </div>
                    <button
                      class="secondary-action"
                      type="button"
                      disabled={busy() === "tokens"}
                      onClick={() => void generateToken(serviceAccount())}
                    >
                      <KeyRound size={16} /> Generate API token
                    </button>
                  </div>
                  <Show when={generatedToken()}>
                    <div class="intent-token">
                      <KeyValue label="One-time token" value="Save before closing this view" />
                      <textarea readonly rows={4} value={generatedToken()} />
                    </div>
                  </Show>
                  <Show
                    when={apiTokens().length}
                    fallback={<p class="muted">No API tokens returned.</p>}
                  >
                    <For each={apiTokens()}>
                      {(token) => (
                        <div class="token-row">
                          <div>
                            <strong>{token.label}</strong>
                            <small>
                              {token.purpose} · {formatDateTime(token.issuedAt)}
                              {token.expiry ? ` · expires ${formatDateTime(token.expiry)}` : ""}
                            </small>
                          </div>
                          <code>{shortId(token.tokenId)}</code>
                          <Show
                            when={tokenDeleteId() === token.tokenId}
                            fallback={
                              <button
                                class="danger-action"
                                type="button"
                                disabled={busy() === "token-delete"}
                                onClick={() => setTokenDeleteId(token.tokenId)}
                              >
                                <Trash2 size={15} /> Delete
                              </button>
                            }
                          >
                            <div class="inline-confirm">
                              <small>Confirm?</small>
                              <button
                                class="danger-action"
                                type="button"
                                disabled={busy() === "token-delete"}
                                onClick={() => void removeToken(serviceAccount(), token.tokenId)}
                              >
                                Yes
                              </button>
                              <button
                                class="secondary-action"
                                type="button"
                                disabled={busy() === "token-delete"}
                                onClick={() => setTokenDeleteId("")}
                              >
                                Cancel
                              </button>
                            </div>
                          </Show>
                        </div>
                      )}
                    </For>
                  </Show>
                </GlassPanel>

                <GlassPanel title="Credential">
                  <KeyValue
                    label="Status check"
                    value={
                      credentialStatus()
                        ? formatDateTime(credentialStatus()!.checkedAt)
                        : "Not checked"
                    }
                  />
                  <Show when={credentialStatus()?.generatedAt}>
                    {(generatedAt) => (
                      <p class="muted">
                        Last generated from this console at {formatDateTime(generatedAt())}.
                      </p>
                    )}
                  </Show>
                  <div class="detail-action-row">
                    <button
                      class="secondary-action"
                      type="button"
                      disabled={busy() === "credential"}
                      onClick={() => void checkCredentialStatus(serviceAccount())}
                    >
                      <ClipboardCheck size={16} /> Check status
                    </button>
                    <button
                      class="secondary-action"
                      type="button"
                      disabled={busy() === "credential"}
                      onClick={() => void generateCredential(serviceAccount())}
                    >
                      <ShieldCheck size={16} /> Generate credential
                    </button>
                  </div>
                  <p class="muted">
                    Kanidm exposes the service account credential generation endpoint without a
                    returned secret in the current OpenAPI description.
                  </p>
                </GlassPanel>

                <GlassPanel title="SSH keys">
                  <div class="form-stack compact-form">
                    <label>
                      Tag
                      <input
                        value={sshTag()}
                        onInput={(event) => setSshTag(event.currentTarget.value)}
                      />
                    </label>
                    <label>
                      Public key
                      <textarea
                        rows={3}
                        value={sshKey()}
                        onInput={(event) => setSshKey(event.currentTarget.value)}
                      />
                    </label>
                    <button
                      class="secondary-action"
                      type="button"
                      disabled={busy() === "ssh"}
                      onClick={() => void addSshKey(serviceAccount())}
                    >
                      <KeyRound size={16} /> Add SSH key
                    </button>
                  </div>
                  <For each={sshKeys()} fallback={<p class="muted">No SSH keys returned.</p>}>
                    {(key) => (
                      <div class="ssh-key-row">
                        <div>
                          <strong>{key.tag}</strong>
                          <code>{key.key}</code>
                        </div>
                        <button
                          class="danger-action"
                          type="button"
                          disabled={busy() === "ssh"}
                          onClick={() => void removeSshKey(serviceAccount(), key.tag)}
                        >
                          <Trash2 size={15} /> Delete
                        </button>
                      </div>
                    )}
                  </For>
                </GlassPanel>

                <GlassPanel title="Unix settings">
                  <div class="profile-edit-grid">
                    <label>
                      GID number
                      <input
                        value={unixGid()}
                        onInput={(event) => setUnixGid(event.currentTarget.value)}
                      />
                    </label>
                    <label>
                      Login shell
                      <input
                        value={unixShell()}
                        onInput={(event) => setUnixShell(event.currentTarget.value)}
                      />
                    </label>
                  </div>
                  <button
                    class="secondary-action"
                    type="button"
                    disabled={busy() === "unix"}
                    onClick={() => void saveUnix(serviceAccount())}
                  >
                    <Terminal size={16} /> Save Unix
                  </button>
                </GlassPanel>
              </div>

              <GlassPanel title="Delete service account">
                <div class="review-box danger">
                  <CircleAlert size={18} />
                  <span>
                    Type {serviceAccount().name} to enable deletion. This calls Kanidm service
                    account delete.
                  </span>
                </div>
                <label>
                  Confirmation
                  <input
                    value={deleteText()}
                    onInput={(event) => setDeleteText(event.currentTarget.value)}
                  />
                </label>
                <button
                  class="danger-action"
                  type="button"
                  disabled={busy() === "delete" || deleteText() !== serviceAccount().name}
                  onClick={() => void confirmDelete(serviceAccount())}
                >
                  <Trash2 size={16} /> Delete service account
                </button>
              </GlassPanel>
            </div>
          )}
        </Show>
      </div>
    </>
  );
}

function parseUnixGid(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^[0-9]+$/.test(trimmed)) {
    throw new Error("GID number must be a positive integer.");
  }
  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error("GID number must be a positive integer.");
  }
  return parsed;
}
