import { createEffect, createSignal, For, Show } from "solid-js";
import { Check, ClipboardCheck, GitBranch, Plus, ServerCog, Trash2 } from "lucide-solid";
import type { Group, GroupPolicyAttribute, GroupUnixSettings } from "../../domain";
import { resolveGroupClosure, useConsole } from "../../store";
import ErrorBox from "../../components/error-box";
import GlassPanel from "../../components/glass-panel";
import KeyValue from "../../components/key-value";
import PageHeader from "../../components/page-header";
import TextField from "../../components/text-field";
import { Link, useNavigation } from "../../routing";
import { initials } from "../../utils/format";
import { labelForGroup } from "../../utils/labels";
export function GroupsPage() {
  const {
    state,
    getPeopleForGroup,
    deleteGroup,
    updateGroup,
    addGroupMembers,
    removeGroupMembers,
    groupUnixSettings,
    extendGroupUnix,
    groupPolicy,
    updateGroupPolicyAttribute,
  } = useConsole();
  const { navigate } = useNavigation();
  const [selectedGroupId, setSelectedGroupId] = createSignal(state().groups[0]?.id ?? "");
  const [editDisplayName, setEditDisplayName] = createSignal("");
  const [editDescription, setEditDescription] = createSignal("");
  const [editManagedBy, setEditManagedBy] = createSignal("");
  const [editParentGroups, setEditParentGroups] = createSignal<string[]>([]);
  const [editMembers, setEditMembers] = createSignal<string[]>([]);
  const [editing, setEditing] = createSignal(false);
  const [deleting, setDeleting] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [maintenanceBusy, setMaintenanceBusy] = createSignal("");
  const [error, setError] = createSignal("");
  const [maintenanceError, setMaintenanceError] = createSignal("");
  const [unixSettings, setUnixSettings] = createSignal<GroupUnixSettings | null>(null);
  const [unixGid, setUnixGid] = createSignal("");
  const [policyAttrs, setPolicyAttrs] = createSignal<GroupPolicyAttribute[]>([]);
  const [policyDrafts, setPolicyDrafts] = createSignal<Record<string, string>>({});
  let maintenanceRequest = 0;
  const emptyGroup: Group = {
    id: "",
    name: "",
    displayName: "No group selected",
    description: "",
    members: [],
    parentGroups: [],
    managedBy: "",
  };
  const selectedGroup = () =>
    state().groups.find((group) => group.id === selectedGroupId()) ??
    state().groups[0] ??
    emptyGroup;
  const hasSelectedGroup = () => Boolean(selectedGroup().id);
  const selectedGroupClosure = () => {
    const group = selectedGroup();
    return group.id ? resolveGroupClosure([group.id], state().groups) : [];
  };
  const appsUsingGroup = () =>
    state().apps.filter((app) =>
      app.allowedGroups.some((groupId) => selectedGroupClosure().includes(groupId)),
    );

  createEffect(() => {
    const g = selectedGroup();
    if (g.id) {
      setEditDisplayName(g.displayName);
      setEditDescription(g.description);
      setEditManagedBy(state().groups.find((p) => p.id === g.managedBy)?.name ?? "");
      setEditParentGroups([...g.parentGroups]);
      setEditMembers([...g.members]);
      setEditing(false);
      setDeleting(false);
      setError("");
    }
  });

  createEffect(() => {
    const g = selectedGroup();
    if (!g.id) {
      maintenanceRequest += 1;
      setUnixSettings(null);
      setUnixGid("");
      setPolicyAttrs([]);
      setPolicyDrafts({});
      setMaintenanceBusy("");
      setMaintenanceError("");
      return;
    }
    void loadMaintenance(g.id);
  });

  async function loadMaintenance(groupId: string) {
    const requestId = ++maintenanceRequest;
    setMaintenanceBusy("load");
    setMaintenanceError("");
    try {
      const [unix, policy] = await Promise.all([groupUnixSettings(groupId), groupPolicy(groupId)]);
      if (!currentMaintenanceRequest(requestId, groupId)) return;
      setUnixSettings(unix);
      setUnixGid(
        unix?.gidNumber === null || unix?.gidNumber === undefined ? "" : String(unix.gidNumber),
      );
      setPolicyAttrs(policy);
      setPolicyDrafts(
        Object.fromEntries(policy.map((item) => [item.attr, item.values.join("\n")])),
      );
    } catch (err) {
      if (!currentMaintenanceRequest(requestId, groupId)) return;
      setMaintenanceError(
        err instanceof Error ? err.message : "Could not load group maintenance data.",
      );
    } finally {
      if (currentMaintenanceRequest(requestId, groupId)) setMaintenanceBusy("");
    }
  }

  async function saveGroupUnix() {
    const group = selectedGroup();
    if (!group.id) return;
    const groupId = group.id;
    const requestId = maintenanceRequest;
    const gid = Number(unixGid());
    if (!Number.isInteger(gid) || gid < 0) {
      setMaintenanceError("GID number must be a non-negative integer.");
      return;
    }
    setMaintenanceBusy("unix");
    setMaintenanceError("");
    try {
      const nextUnix = await extendGroupUnix(groupId, gid);
      if (currentMaintenanceRequest(requestId, groupId)) {
        setUnixSettings(nextUnix);
      }
    } catch (err) {
      if (currentMaintenanceRequest(requestId, groupId)) {
        setMaintenanceError(err instanceof Error ? err.message : "Could not update group Unix.");
      }
    } finally {
      if (currentMaintenanceRequest(requestId, groupId)) setMaintenanceBusy("");
    }
  }

  async function savePolicyAttribute(attr: GroupPolicyAttribute) {
    const group = selectedGroup();
    if (!group.id) return;
    const groupId = group.id;
    const requestId = maintenanceRequest;
    setMaintenanceBusy(attr.attr);
    setMaintenanceError("");
    try {
      const values = splitLines(policyDrafts()[attr.attr] ?? "");
      await updateGroupPolicyAttribute(groupId, attr.attr, values);
      const nextPolicy = await groupPolicy(groupId);
      if (currentMaintenanceRequest(requestId, groupId)) {
        setPolicyAttrs(nextPolicy);
        setPolicyDrafts(
          Object.fromEntries(nextPolicy.map((item) => [item.attr, item.values.join("\n")])),
        );
      }
    } catch (err) {
      if (currentMaintenanceRequest(requestId, groupId)) {
        setMaintenanceError(err instanceof Error ? err.message : `Could not update ${attr.label}.`);
      }
    } finally {
      if (currentMaintenanceRequest(requestId, groupId)) setMaintenanceBusy("");
    }
  }

  function currentMaintenanceRequest(requestId: number, groupId: string) {
    return requestId === maintenanceRequest && selectedGroup().id === groupId;
  }

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Groups"
        action={
          <Link class="primary-action" href="/admin/groups/new">
            <Plus size={16} /> Add group
          </Link>
        }
      />
      <div class="split-admin">
        <div class="resource-list">
          <For
            each={state().groups}
            fallback={
              <div class="resource-empty">
                <strong>No groups found</strong>
                <small>No groups are available for this session.</small>
              </div>
            }
          >
            {(group) => (
              <button
                class={group.id === selectedGroup().id ? "resource-row active" : "resource-row"}
                type="button"
                onClick={() => setSelectedGroupId(group.id)}
              >
                <GitBranch size={17} />
                <span>
                  <strong>{group.displayName}</strong>
                  <small>{group.name}</small>
                </span>
                <b>{group.members.length}</b>
              </button>
            )}
          </For>
        </div>
        <div class="resource-detail">
          <Show
            when={hasSelectedGroup()}
            fallback={
              <GlassPanel title="Group details">
                <p class="muted">No group is selected.</p>
              </GlassPanel>
            }
          >
            <GlassPanel title={selectedGroup().displayName}>
              <KeyValue label="System name" value={selectedGroup().name} />
              <Show
                when={editing()}
                fallback={
                  <>
                    <KeyValue label="Display name" value={selectedGroup().displayName} />
                    <KeyValue
                      label="Managed by"
                      value={labelForGroup(state().groups, selectedGroup().managedBy) || "None"}
                    />
                    <KeyValue
                      label="Apps unlocked"
                      value={
                        appsUsingGroup()
                          .map((app) => app.displayName)
                          .join(", ") || "None"
                      }
                    />
                    <p class="muted">{selectedGroup().description || "No description"}</p>
                    <ErrorBox error={error} />
                    <div class="button-row">
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
                          <Trash2 size={14} /> Delete group
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
                              await deleteGroup(selectedGroup().id, selectedGroup().name);
                              navigate("/admin/groups");
                            } catch (err) {
                              setError(
                                err instanceof Error ? err.message : "Could not delete group.",
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
                  </>
                }
              >
                <div class="field-stack">
                  <TextField
                    label="Display name"
                    value={editDisplayName()}
                    onInput={setEditDisplayName}
                  />
                  <ErrorBox error={error} />
                  <label>
                    Description
                    <textarea
                      rows={3}
                      value={editDescription()}
                      onInput={(e) => setEditDescription(e.currentTarget.value)}
                    />
                  </label>
                  <label>
                    Managed by
                    <select
                      value={editManagedBy()}
                      onChange={(e) => setEditManagedBy(e.currentTarget.value)}
                    >
                      <option value="">None</option>
                      <For each={state().groups.filter((g) => g.id !== selectedGroup().id)}>
                        {(g) => <option value={g.name}>{g.displayName}</option>}
                      </For>
                    </select>
                  </label>
                </div>
              </Show>
            </GlassPanel>

            <GlassPanel title="Group Unix/POSIX">
              <KeyValue
                label="POSIX status"
                value={unixSettings()?.enabled ? "Enabled" : "Not set"}
              />
              <Show when={unixSettings()}>
                {(settings) => (
                  <>
                    <KeyValue label="GID number" value={settings().gidNumber ?? "Not set"} />
                    <KeyValue label="SPN" value={settings().spn || "Not set"} />
                  </>
                )}
              </Show>
              <div class="field-stack compact-fields">
                <TextField label="GID number" value={unixGid()} onInput={setUnixGid} />
                <button
                  class="secondary-action"
                  type="button"
                  disabled={maintenanceBusy() === "unix" || !unixGid().trim()}
                  onClick={() => {
                    void saveGroupUnix();
                  }}
                >
                  <ServerCog size={15} />{" "}
                  {maintenanceBusy() === "unix" ? "Saving Unix" : "Save Unix settings"}
                </button>
              </div>
            </GlassPanel>

            <GlassPanel title="Group account policy">
              <ErrorBox error={maintenanceError} />
              <Show when={maintenanceBusy() === "load"}>
                <p class="muted">Loading group maintenance data.</p>
              </Show>
              <div class="policy-list">
                <For each={policyAttrs()}>
                  {(attr) => (
                    <div class="policy-row">
                      <div>
                        <strong>{attr.label}</strong>
                        <small>{attr.attr}</small>
                        <p>{attr.help}</p>
                      </div>
                      <label>
                        Values
                        <textarea
                          rows={2}
                          value={policyDrafts()[attr.attr] ?? ""}
                          onInput={(event) =>
                            setPolicyDrafts({
                              ...policyDrafts(),
                              [attr.attr]: event.currentTarget.value,
                            })
                          }
                          placeholder="One value per line"
                        />
                      </label>
                      <button
                        class="secondary-action"
                        type="button"
                        disabled={Boolean(maintenanceBusy())}
                        onClick={() => {
                          void savePolicyAttribute(attr);
                        }}
                      >
                        {maintenanceBusy() === attr.attr ? "Saving" : "Save"}
                      </button>
                    </div>
                  )}
                </For>
              </div>
            </GlassPanel>

            <Show when={editing()}>
              <GlassPanel title="Parent groups">
                <div class="option-grid">
                  <For each={state().groups.filter((g) => g.id !== selectedGroup().id)}>
                    {(parent) => {
                      const isParent = () => editParentGroups().includes(parent.id);
                      return (
                        <button
                          class={isParent() ? "option-card selected" : "option-card"}
                          type="button"
                          onClick={() => {
                            const adding = !isParent();
                            setEditParentGroups(
                              adding
                                ? [...editParentGroups(), parent.id]
                                : editParentGroups().filter((id) => id !== parent.id),
                            );
                          }}
                        >
                          <span>
                            <Show when={isParent()} fallback={<Plus size={16} />}>
                              <Check size={16} />
                            </Show>
                          </span>
                          <strong>{parent.displayName}</strong>
                          <small>{parent.name}</small>
                        </button>
                      );
                    }}
                  </For>
                </div>
              </GlassPanel>
            </Show>

            <GlassPanel title="Members">
              <div class="member-grid">
                <For each={state().people}>
                  {(person) => {
                    const isDirectMember = () =>
                      editing()
                        ? editMembers().some((ref) => memberRefMatchesPerson(ref, person))
                        : selectedGroup().members.some((ref) =>
                            memberRefMatchesPerson(ref, person),
                          );
                    const isInheritedMember = () =>
                      !isDirectMember() &&
                      getPeopleForGroup(selectedGroup().id).some((m) => m.id === person.id);
                    const inheritedFrom = () => {
                      if (!isInheritedMember()) return "";
                      const parent = state().groups.find(
                        (g) =>
                          g.id !== selectedGroup().id &&
                          g.members.some((ref) => ref === person.id || ref.includes(person.id)) &&
                          getPeopleForGroup(selectedGroup().id).some((m) => m.id === person.id),
                      );
                      return parent ? `Inherited from ${parent.displayName}` : "Inherited";
                    };
                    return (
                      <button
                        class={
                          isDirectMember()
                            ? "member-pill selected"
                            : isInheritedMember()
                              ? "member-pill inherited"
                              : "member-pill"
                        }
                        type="button"
                        disabled={!editing()}
                        onClick={() => {
                          if (!editing()) return;
                          const adding = !isDirectMember();
                          setEditMembers(
                            adding
                              ? [...editMembers(), person.id]
                              : editMembers().filter((ref) => !memberRefMatchesPerson(ref, person)),
                          );
                        }}
                      >
                        <span class="avatar">{initials(person.displayName)}</span>
                        {person.displayName}
                        <Show when={isDirectMember()}>
                          <small class="member-kind">Direct</small>
                        </Show>
                        <Show when={isInheritedMember()}>
                          <small class="member-kind">{inheritedFrom()}</small>
                        </Show>
                        <Show when={editing() && !isDirectMember()}>
                          <Plus size={14} />
                        </Show>
                        <Show when={editing() && isDirectMember()}>
                          <Check size={14} />
                        </Show>
                      </button>
                    );
                  }}
                </For>
              </div>
              <div class="review-box">
                <ClipboardCheck size={18} />
                <span>
                  Saved membership changes update access to {appsUsingGroup().length} application
                  {appsUsingGroup().length === 1 ? "" : "s"}.
                </span>
              </div>
            </GlassPanel>

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
                      const g = selectedGroup();
                      const patch: Partial<
                        Pick<Group, "displayName" | "description" | "managedBy">
                      > = {};
                      if (editDisplayName() !== g.displayName) {
                        patch.displayName = editDisplayName();
                      }
                      if (editDescription() !== g.description) {
                        patch.description = editDescription();
                      }
                      const origManagedByName =
                        state().groups.find((p) => p.id === g.managedBy)?.name ?? "";
                      if (editManagedBy() !== origManagedByName) {
                        patch.managedBy = editManagedBy();
                      }
                      if (Object.keys(patch).length > 0) {
                        await updateGroup(g.id, g.name, patch);
                      }
                      const prevParents = new Set(g.parentGroups);
                      const nextParents = new Set(editParentGroups());
                      for (const added of editParentGroups()) {
                        if (!prevParents.has(added)) {
                          const parent = state().groups.find((p) => p.id === added);
                          if (parent) await addGroupMembers(parent.name, [g.name]);
                        }
                      }
                      for (const removed of g.parentGroups) {
                        if (!nextParents.has(removed)) {
                          const parent = state().groups.find((p) => p.id === removed);
                          if (parent) await removeGroupMembers(parent.name, [g.name]);
                        }
                      }
                      for (const added of editMembers()) {
                        if (!g.members.some((m) => m === added || m.includes(added))) {
                          await addGroupMembers(g.name, [added]);
                        }
                      }
                      for (const removed of g.members) {
                        if (!editMembers().some((m) => m === removed || m.includes(removed))) {
                          await removeGroupMembers(g.name, [removed]);
                        }
                      }
                      setEditing(false);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Could not update group.");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {busy() ? "Saving…" : "Save"}
                </button>
                <button
                  class="secondary-action"
                  type="button"
                  disabled={busy()}
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </button>
              </div>
            </Show>
          </Show>
        </div>
      </div>
    </>
  );
}

function splitLines(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function memberRefMatchesPerson(ref: string, person: { id: string; username: string }) {
  return (
    ref === person.id ||
    ref === person.username ||
    ref.includes(person.id) ||
    ref.includes(person.username)
  );
}
