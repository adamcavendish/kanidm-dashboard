import { createEffect, createSignal, For, Show } from "solid-js";
import { Check, ClipboardCheck, GitBranch, Plus, Trash2 } from "lucide-solid";
import type { Group } from "../../domain";
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
  const [error, setError] = createSignal("");
  const selectedGroup = () =>
    state().groups.find((group) => group.id === selectedGroupId()) ?? state().groups[0];
  const selectedGroupClosure = () => resolveGroupClosure([selectedGroup().id], state().groups);
  const appsUsingGroup = () =>
    state().apps.filter((app) =>
      app.allowedGroups.some((groupId) => selectedGroupClosure().includes(groupId)),
    );

  createEffect(() => {
    const g = selectedGroup();
    if (g) {
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
          <For each={state().groups}>
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
                    <button class="secondary-action" type="button" onClick={() => setEditing(true)}>
                      Edit
                    </button>
                    <Show when={!deleting()}>
                      <button class="danger-action" type="button" onClick={() => setDeleting(true)}>
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
                      ? editMembers().some((ref) => ref === person.id || ref.includes(person.id))
                      : selectedGroup().members.some(
                          (ref) =>
                            ref === person.id ||
                            ref === person.username ||
                            ref.includes(person.id) ||
                            ref.includes(person.username),
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
                            : editMembers().filter((id) => id !== person.id),
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
                Membership changes immediately update access to {appsUsingGroup().length}{" "}
                application
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
                    const patch: Partial<Pick<Group, "displayName" | "description" | "managedBy">> =
                      {};
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
        </div>
      </div>
    </>
  );
}
