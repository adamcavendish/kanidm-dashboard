import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import {
  BadgeCheck,
  CircleAlert,
  ClipboardCheck,
  KeyRound,
  Lock,
  RadioTower,
  RefreshCw,
  Save,
  ShieldCheck,
  Terminal,
  Trash2,
  Unlock,
  UserRoundPlus,
} from "lucide-solid";
import type {
  CredentialUpdateIntent,
  Person,
  PersonCertificate,
  SshPublicKey,
  UserAuthTokenStatus,
  UserStatus,
} from "../../domain";
import { useConsole } from "../../store";
import GlassPanel from "../../components/glass-panel";
import KeyValue from "../../components/key-value";
import PageHeader from "../../components/page-header";
import { CredentialMeter } from "../../components/credential-meter";
import { StatusBadge } from "../../components/status-badge";
import { Toolbar } from "../../components/toolbar";
import { Link } from "../../routing";
import { formatDateTime, sessionStateLabel, shortId } from "../../utils/format";
import { labelForGroup } from "../../utils/labels";
import { searchable } from "../../utils/search";

type BusyState =
  | ""
  | "profile"
  | "status"
  | "delete"
  | "intent"
  | "sessions"
  | "session-delete"
  | "ssh"
  | "radius"
  | "unix"
  | "certificate";

export function PeoplePage() {
  const {
    state,
    getAccessForPerson,
    updatePersonProfile,
    updatePersonStatus,
    deletePerson,
    toggleGroupMember,
    issueCredentialUpdateIntent,
    getPersonCertificates,
    addPersonCertificate,
    getPersonRadiusPassword,
    generatePersonRadiusPassword,
    deletePersonRadiusPassword,
    getPersonSshPublicKeys,
    addPersonSshPublicKey,
    deletePersonSshPublicKey,
    getPersonUserAuthTokens,
    deletePersonUserAuthToken,
    extendPersonUnixAccount,
    setPersonUnixCredential,
    deletePersonUnixCredential,
  } = useConsole();
  const [query, setQuery] = createSignal("");
  const [selectedPersonId, setSelectedPersonId] = createSignal(state().people[0]?.id ?? "");
  const [editing, setEditing] = createSignal(false);
  const [displayName, setDisplayName] = createSignal("");
  const [legalName, setLegalName] = createSignal("");
  const [email, setEmail] = createSignal("");
  const [status, setStatus] = createSignal<UserStatus>("active");
  const [validFrom, setValidFrom] = createSignal("");
  const [expireAt, setExpireAt] = createSignal("");
  const [softLockExpire, setSoftLockExpire] = createSignal("");
  const [intentResult, setIntentResult] = createSignal<CredentialUpdateIntent | null>(null);
  const [sessions, setSessions] = createSignal<UserAuthTokenStatus[]>([]);
  const [sshKeys, setSshKeys] = createSignal<SshPublicKey[]>([]);
  const [radiusPassword, setRadiusPassword] = createSignal<string | null>(null);
  const [certificates, setCertificates] = createSignal<PersonCertificate[]>([]);
  const [certificateText, setCertificateText] = createSignal("");
  const [sshTag, setSshTag] = createSignal("workstation");
  const [sshKey, setSshKey] = createSignal("");
  const [unixGid, setUnixGid] = createSignal("");
  const [unixShell, setUnixShell] = createSignal("");
  const [unixPassword, setUnixPassword] = createSignal("");
  const [deleteText, setDeleteText] = createSignal("");
  const [busy, setBusy] = createSignal<BusyState>("");
  const [error, setError] = createSignal("");
  const [message, setMessage] = createSignal("");
  const [operationWarnings, setOperationWarnings] = createSignal<string[]>([]);

  const people = () =>
    state().people.filter((person) => searchable(person).includes(query().toLowerCase()));
  const selectedPerson = () =>
    state().people.find((person) => person.id === selectedPersonId()) ?? state().people[0];
  const selectedAccess = createMemo(() => {
    const person = selectedPerson();
    return person ? getAccessForPerson(person.id) : [];
  });
  const selectedGroups = createMemo(() => {
    const person = selectedPerson();
    if (!person) return [];
    return state().groups.filter((group) => person.groups.includes(group.id));
  });
  let adminRefreshRequest = 0;

  function setStatusChoice(nextStatus: UserStatus) {
    setStatus(nextStatus);
    if (nextStatus === "active") {
      setExpireAt("");
      setSoftLockExpire("");
    }
  }

  function isSelectedPerson(personId: string) {
    return selectedPerson()?.id === personId;
  }

  createEffect(() => {
    const first = state().people[0]?.id ?? "";
    if (!selectedPersonId() && first) setSelectedPersonId(first);
    if (selectedPersonId() && !state().people.some((person) => person.id === selectedPersonId())) {
      setSelectedPersonId(first);
    }
  });

  createEffect(() => {
    const person = selectedPerson();
    if (!person) return;
    setDisplayName(person.displayName);
    setLegalName(person.legalName);
    setEmail(person.email);
    setStatus(person.status);
    setValidFrom(person.validFrom ?? "");
    setExpireAt(person.expireAt ?? "");
    setSoftLockExpire(person.softLockExpire ?? "");
    setUnixGid(person.unix.gidNumber === null ? "" : String(person.unix.gidNumber));
    setUnixShell(person.unix.shell);
    setIntentResult(null);
    setSessions([]);
    setSshKeys([]);
    setRadiusPassword(null);
    setCertificates([]);
    setOperationWarnings([]);
    setError("");
    setMessage("");
    setEditing(false);
    setDeleteText("");
    void refreshAdminData(person.id);
  });

  async function refreshAdminData(personId = selectedPerson()?.id) {
    if (!personId) return;
    const requestId = ++adminRefreshRequest;
    const warnings: string[] = [];
    setBusy("sessions");
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
      const [nextSessions, nextKeys, nextRadius, nextCertificates] = await Promise.all([
        optionalRead("Sessions", [] as UserAuthTokenStatus[], () =>
          getPersonUserAuthTokens(personId),
        ),
        optionalRead("SSH keys", [] as SshPublicKey[], () => getPersonSshPublicKeys(personId)),
        optionalRead("RADIUS password", null as string | null, () =>
          getPersonRadiusPassword(personId),
        ),
        optionalRead("Certificates", [] as PersonCertificate[], () =>
          getPersonCertificates(personId),
        ),
      ]);
      if (requestId !== adminRefreshRequest || selectedPerson()?.id !== personId) return;
      setSessions(nextSessions);
      setSshKeys(nextKeys);
      setRadiusPassword(nextRadius);
      setCertificates(nextCertificates);
      setOperationWarnings(warnings);
    } catch (err) {
      if (requestId !== adminRefreshRequest) return;
      setError(err instanceof Error ? err.message : "Could not load person operations.");
    } finally {
      if (requestId === adminRefreshRequest) setBusy("");
    }
  }

  async function saveProfile(person: Person) {
    setBusy("profile");
    setError("");
    setMessage("");
    try {
      await updatePersonProfile(person.id, {
        displayName: displayName(),
        legalName: legalName(),
        email: email(),
      });
      setEditing(false);
      setMessage("Profile updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update profile.");
    } finally {
      setBusy("");
    }
  }

  async function saveStatus(person: Person) {
    setBusy("status");
    setError("");
    setMessage("");
    try {
      if (status() === "expiring" && !expireAt().trim() && !softLockExpire().trim()) {
        throw new Error("Expiring status needs an expire-at or soft-lock-expire timestamp.");
      }
      await updatePersonStatus(person.id, {
        status: status(),
        validFrom: validFrom(),
        expireAt: expireAt(),
        softLockExpire: softLockExpire(),
      });
      setMessage("Status updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update status.");
    } finally {
      setBusy("");
    }
  }

  async function issueIntent(person: Person) {
    const personId = person.id;
    setBusy("intent");
    setError("");
    setMessage("");
    try {
      const nextIntent = await issueCredentialUpdateIntent(personId, 3600);
      if (!isSelectedPerson(personId)) return;
      setIntentResult(nextIntent);
      setMessage("Credential update token issued.");
    } catch (err) {
      if (!isSelectedPerson(personId)) return;
      setError(err instanceof Error ? err.message : "Could not issue credential intent.");
    } finally {
      if (isSelectedPerson(personId)) setBusy("");
    }
  }

  async function toggleMembership(person: Person, groupId: string) {
    setBusy("profile");
    setError("");
    try {
      await toggleGroupMember(groupId, person.id);
      setMessage("Group membership updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update group membership.");
    } finally {
      setBusy("");
    }
  }

  async function revokeSession(person: Person, sessionId: string) {
    const personId = person.id;
    setBusy("session-delete");
    setError("");
    try {
      const nextSessions = await deletePersonUserAuthToken(personId, sessionId);
      if (!isSelectedPerson(personId)) return;
      setSessions(nextSessions);
      setMessage("Session revoked.");
    } catch (err) {
      if (!isSelectedPerson(personId)) return;
      setError(err instanceof Error ? err.message : "Could not revoke session.");
    } finally {
      if (isSelectedPerson(personId)) setBusy("");
    }
  }

  async function addSshKey(person: Person) {
    const personId = person.id;
    setBusy("ssh");
    setError("");
    try {
      const nextKeys = await addPersonSshPublicKey(personId, sshTag(), sshKey());
      if (!isSelectedPerson(personId)) return;
      setSshKeys(nextKeys);
      setSshKey("");
      setMessage("SSH key added.");
    } catch (err) {
      if (!isSelectedPerson(personId)) return;
      setError(err instanceof Error ? err.message : "Could not add SSH key.");
    } finally {
      if (isSelectedPerson(personId)) setBusy("");
    }
  }

  async function removeSshKey(person: Person, tag: string) {
    const personId = person.id;
    setBusy("ssh");
    setError("");
    try {
      const nextKeys = await deletePersonSshPublicKey(personId, tag);
      if (!isSelectedPerson(personId)) return;
      setSshKeys(nextKeys);
      setMessage("SSH key removed.");
    } catch (err) {
      if (!isSelectedPerson(personId)) return;
      setError(err instanceof Error ? err.message : "Could not remove SSH key.");
    } finally {
      if (isSelectedPerson(personId)) setBusy("");
    }
  }

  async function generateRadius(person: Person) {
    const personId = person.id;
    setBusy("radius");
    setError("");
    try {
      const nextPassword = await generatePersonRadiusPassword(personId);
      if (!isSelectedPerson(personId)) return;
      setRadiusPassword(nextPassword);
      setMessage("RADIUS password generated.");
    } catch (err) {
      if (!isSelectedPerson(personId)) return;
      setError(err instanceof Error ? err.message : "Could not generate RADIUS password.");
    } finally {
      if (isSelectedPerson(personId)) setBusy("");
    }
  }

  async function removeRadius(person: Person) {
    const personId = person.id;
    setBusy("radius");
    setError("");
    try {
      await deletePersonRadiusPassword(personId);
      if (!isSelectedPerson(personId)) return;
      setRadiusPassword(null);
      setMessage("RADIUS password deleted.");
    } catch (err) {
      if (!isSelectedPerson(personId)) return;
      setError(err instanceof Error ? err.message : "Could not delete RADIUS password.");
    } finally {
      if (isSelectedPerson(personId)) setBusy("");
    }
  }

  async function saveUnix(person: Person) {
    setBusy("unix");
    setError("");
    try {
      await extendPersonUnixAccount(person.id, {
        gidNumber: unixGid().trim() ? Number(unixGid()) : null,
        shell: unixShell(),
      });
      setMessage("Unix settings updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update Unix settings.");
    } finally {
      setBusy("");
    }
  }

  async function stageUnixCredential(person: Person) {
    setBusy("unix");
    setError("");
    try {
      await setPersonUnixCredential(person.id, unixPassword());
      setUnixPassword("");
      setMessage("Unix credential set.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not set Unix credential.");
    } finally {
      setBusy("");
    }
  }

  async function removeUnixCredential(person: Person) {
    setBusy("unix");
    setError("");
    try {
      await deletePersonUnixCredential(person.id);
      setMessage("Unix credential removed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove Unix credential.");
    } finally {
      setBusy("");
    }
  }

  async function addCertificate(person: Person) {
    const personId = person.id;
    setBusy("certificate");
    setError("");
    try {
      const nextCertificates = await addPersonCertificate(personId, certificateText());
      if (!isSelectedPerson(personId)) return;
      setCertificates(nextCertificates);
      setCertificateText("");
      setMessage("Certificate added.");
    } catch (err) {
      if (!isSelectedPerson(personId)) return;
      setError(err instanceof Error ? err.message : "Could not add certificate.");
    } finally {
      if (isSelectedPerson(personId)) setBusy("");
    }
  }

  async function confirmDelete(person: Person) {
    setBusy("delete");
    setError("");
    try {
      await deletePerson(person.id);
      setSelectedPersonId(state().people[0]?.id ?? "");
      setMessage("Person deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete person.");
    } finally {
      setBusy("");
    }
  }

  const resetUrl = () =>
    intentResult()
      ? `${window.location.origin}/reset?token=${encodeURIComponent(intentResult()!.token)}`
      : "";

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="People"
        action={
          <Link class="primary-action" href="/admin/people/new">
            <UserRoundPlus size={16} /> Add user
          </Link>
        }
      />
      <Toolbar query={query()} onQuery={setQuery} placeholder="Search people" />
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
      <div class="split-admin people-inspector">
        <div class="resource-list">
          <For
            each={people()}
            fallback={
              <div class="resource-empty">
                <strong>No people found</strong>
                <small>
                  {query().trim()
                    ? `No people match "${query().trim()}".`
                    : "No people are available."}
                </small>
              </div>
            }
          >
            {(person) => (
              <button
                class={person.id === selectedPerson()?.id ? "resource-row active" : "resource-row"}
                type="button"
                aria-current={person.id === selectedPerson()?.id ? "true" : undefined}
                aria-pressed={person.id === selectedPerson()?.id}
                onClick={() => setSelectedPersonId(person.id)}
              >
                <span class="person-row-copy">
                  <strong>{person.displayName}</strong>
                  <small>
                    {person.username} · {person.email}
                  </small>
                </span>
                <StatusBadge status={person.status} />
              </button>
            )}
          </For>
        </div>

        <Show when={selectedPerson()}>
          {(person) => (
            <div class="resource-detail people-detail">
              <GlassPanel title={person().displayName}>
                <div class="person-summary-grid">
                  <KeyValue label="Username" value={person().username} variant="detail" />
                  <KeyValue label="Email" value={person().email} variant="detail" />
                  <KeyValue
                    label="Status"
                    value={<StatusBadge status={person().status} />}
                    variant="detail"
                  />
                  <KeyValue label="Last auth" value={person().lastAuth} variant="detail" />
                </div>
                <CredentialMeter person={person()} />
                <div class="detail-actions">
                  <div class="detail-action-row">
                    <button
                      class="primary-action"
                      type="button"
                      onClick={() => setEditing(!editing())}
                    >
                      <Save size={16} /> {editing() ? "Close editor" : "Edit profile"}
                    </button>
                    <button
                      class="secondary-action"
                      type="button"
                      disabled={busy() === "intent"}
                      onClick={() => void issueIntent(person())}
                    >
                      <ClipboardCheck size={16} /> Issue reset
                    </button>
                    <button
                      class="secondary-action"
                      type="button"
                      disabled={busy() === "sessions"}
                      onClick={() => void refreshAdminData(person().id)}
                    >
                      <RefreshCw size={16} /> Refresh operations
                    </button>
                  </div>
                </div>
              </GlassPanel>

              <Show when={operationWarnings().length}>
                <div class="review-box warning compact-warning">
                  <CircleAlert size={18} />
                  <span>
                    Some live operation details are unavailable for this account. Mutation actions
                    still report failures directly.
                  </span>
                </div>
              </Show>

              <Show when={editing()}>
                <GlassPanel title="Profile and status">
                  <div class="profile-edit-grid">
                    <label>
                      Display name
                      <input
                        value={displayName()}
                        onInput={(event) => setDisplayName(event.currentTarget.value)}
                      />
                    </label>
                    <label>
                      Legal name
                      <input
                        value={legalName()}
                        onInput={(event) => setLegalName(event.currentTarget.value)}
                      />
                    </label>
                    <label>
                      Email
                      <input
                        value={email()}
                        onInput={(event) => setEmail(event.currentTarget.value)}
                      />
                    </label>
                    <label>
                      Status
                      <select
                        value={status()}
                        onChange={(event) =>
                          setStatusChoice(event.currentTarget.value as UserStatus)
                        }
                      >
                        <option value="active">Active</option>
                        <option value="locked">Locked</option>
                        <option value="expiring">Expiring</option>
                      </select>
                    </label>
                    <label>
                      Valid from
                      <input
                        value={validFrom()}
                        placeholder="RFC3339 timestamp"
                        onInput={(event) => setValidFrom(event.currentTarget.value)}
                      />
                    </label>
                    <label>
                      Expire at
                      <input
                        value={expireAt()}
                        placeholder="RFC3339 timestamp"
                        onInput={(event) => setExpireAt(event.currentTarget.value)}
                      />
                    </label>
                    <label>
                      Soft lock expire
                      <input
                        value={softLockExpire()}
                        placeholder="RFC3339 timestamp"
                        onInput={(event) => setSoftLockExpire(event.currentTarget.value)}
                      />
                    </label>
                  </div>
                  <div class="detail-action-row">
                    <button
                      class="primary-action"
                      type="button"
                      disabled={busy() === "profile"}
                      onClick={() => void saveProfile(person())}
                    >
                      <Save size={16} /> Save profile
                    </button>
                    <button
                      class="secondary-action"
                      type="button"
                      disabled={busy() === "status"}
                      onClick={() => void saveStatus(person())}
                    >
                      <Show when={status() === "locked"} fallback={<Unlock size={16} />}>
                        <Lock size={16} />
                      </Show>
                      Save status
                    </button>
                  </div>
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
                <div class="group-toggle-grid">
                  <For each={state().groups}>
                    {(group) => (
                      <button
                        class={
                          person().groups.includes(group.id)
                            ? "member-pill selected"
                            : "member-pill"
                        }
                        type="button"
                        aria-pressed={person().groups.includes(group.id)}
                        disabled={busy() === "profile"}
                        onClick={() => void toggleMembership(person(), group.id)}
                      >
                        {labelForGroup(state().groups, group.id)}
                      </button>
                    )}
                  </For>
                </div>
                <div class="access-preview">
                  <h4>Effective applications</h4>
                  <Show
                    when={selectedAccess().length}
                    fallback={
                      <p class="muted">No application access from current group memberships.</p>
                    }
                  >
                    <For each={selectedAccess()}>
                      {(access) => (
                        <div class="access-preview-row">
                          <strong>{access.app.displayName}</strong>
                          <small>
                            {access.groups.map((group) => group.displayName).join(", ")}
                          </small>
                        </div>
                      )}
                    </For>
                  </Show>
                </div>
              </GlassPanel>

              <Show when={intentResult()}>
                {(intent) => (
                  <GlassPanel title="Credential update token">
                    <div class="intent-token">
                      <KeyValue label="Expires" value={formatDateTime(intent().expiryTime)} />
                      <label>
                        Reset URL
                        <input readonly value={resetUrl()} />
                      </label>
                      <label>
                        Token
                        <textarea readonly rows={3} value={intent().token} />
                      </label>
                    </div>
                  </GlassPanel>
                )}
              </Show>

              <div class="person-ops-grid">
                <GlassPanel title="Sessions">
                  <Show
                    when={sessions().length}
                    fallback={<p class="muted">No active sessions returned.</p>}
                  >
                    <For each={sessions()}>
                      {(session) => (
                        <div class="session-row">
                          <div>
                            <strong>{shortId(session.sessionId)}</strong>
                            <small>{sessionStateLabel(session)}</small>
                          </div>
                          <button
                            class="danger-action"
                            type="button"
                            disabled={busy() === "session-delete"}
                            onClick={() => void revokeSession(person(), session.sessionId)}
                          >
                            <Trash2 size={15} /> Revoke
                          </button>
                        </div>
                      )}
                    </For>
                  </Show>
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
                      onClick={() => void addSshKey(person())}
                    >
                      <KeyRound size={16} /> Add key
                    </button>
                  </div>
                  <For each={sshKeys()}>
                    {(key) => (
                      <div class="ssh-key-row">
                        <div>
                          <strong>{key.tag}</strong>
                          <code>{key.key}</code>
                        </div>
                        <button
                          class="danger-action"
                          type="button"
                          onClick={() => void removeSshKey(person(), key.tag)}
                        >
                          <Trash2 size={15} /> Delete
                        </button>
                      </div>
                    )}
                  </For>
                </GlassPanel>

                <GlassPanel title="RADIUS">
                  <KeyValue label="Password" value={radiusPassword() ?? "Not generated"} />
                  <div class="detail-action-row">
                    <button
                      class="secondary-action"
                      type="button"
                      disabled={busy() === "radius"}
                      onClick={() => void generateRadius(person())}
                    >
                      <RadioTower size={16} /> Generate
                    </button>
                    <button
                      class="danger-action"
                      type="button"
                      disabled={busy() === "radius" || !radiusPassword()}
                      onClick={() => void removeRadius(person())}
                    >
                      <Trash2 size={15} /> Delete
                    </button>
                  </div>
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
                    <label>
                      Unix credential
                      <input
                        type="password"
                        value={unixPassword()}
                        onInput={(event) => setUnixPassword(event.currentTarget.value)}
                      />
                    </label>
                  </div>
                  <div class="detail-action-row">
                    <button
                      class="secondary-action"
                      type="button"
                      disabled={busy() === "unix"}
                      onClick={() => void saveUnix(person())}
                    >
                      <Terminal size={16} /> Save Unix
                    </button>
                    <button
                      class="secondary-action"
                      type="button"
                      disabled={busy() === "unix"}
                      onClick={() => void stageUnixCredential(person())}
                    >
                      <ShieldCheck size={16} /> Set credential
                    </button>
                    <button
                      class="danger-action"
                      type="button"
                      disabled={busy() === "unix"}
                      onClick={() => void removeUnixCredential(person())}
                    >
                      <Trash2 size={15} /> Remove credential
                    </button>
                  </div>
                </GlassPanel>
              </div>

              <GlassPanel title="Certificates">
                <Show
                  when={certificates().length}
                  fallback={<p class="muted">No certificates returned.</p>}
                >
                  <div class="certificate-list">
                    <For each={certificates()}>
                      {(certificate) => (
                        <details>
                          <summary>{certificate.label}</summary>
                          <code>{certificate.pem}</code>
                        </details>
                      )}
                    </For>
                  </div>
                </Show>
                <label>
                  Add certificate
                  <textarea
                    rows={5}
                    value={certificateText()}
                    onInput={(event) => setCertificateText(event.currentTarget.value)}
                  />
                </label>
                <button
                  class="secondary-action"
                  type="button"
                  disabled={busy() === "certificate"}
                  onClick={() => void addCertificate(person())}
                >
                  <BadgeCheck size={16} /> Add certificate
                </button>
              </GlassPanel>

              <GlassPanel title="Delete person">
                <div class="review-box danger">
                  <CircleAlert size={18} />
                  <span>
                    Type {person().username} to enable deletion. This calls Kanidm person delete.
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
                  disabled={busy() === "delete" || deleteText() !== person().username}
                  onClick={() => void confirmDelete(person())}
                >
                  <Trash2 size={16} /> Delete person
                </button>
              </GlassPanel>
            </div>
          )}
        </Show>
      </div>
    </>
  );
}
