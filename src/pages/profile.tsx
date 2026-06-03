import { createEffect, createSignal, For, Show } from "solid-js";
import { CircleAlert, ClipboardCheck, GitBranch } from "lucide-solid";
import type { ProfileUpdateInput } from "../domain";
import { useConsole } from "../store";
import GlassPanel from "../components/glass-panel";
import PageHeader from "../components/page-header";
export function ProfilePage() {
  const { config, state, currentUser, getGroupsForPerson, updateProfile } = useConsole();
  const [draft, setDraft] = createSignal<ProfileUpdateInput>({
    displayName: currentUser().displayName,
    legalName: currentUser().legalName,
    email: currentUser().email,
  });
  const [review, setReview] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");
  const groups = () => getGroupsForPerson(currentUser().id);
  const profileReadOnly = () => config().dataSource.mode === "kanidm" && state().role !== "admin";
  const changedItems = () => {
    if (profileReadOnly()) return [];
    const current = currentUser();
    const items = [];
    if (draft().displayName.trim() !== current.displayName) items.push("Display name");
    if (draft().legalName.trim() !== current.legalName) items.push("Legal name");
    if (draft().email.trim() !== current.email) items.push("Email");
    return items;
  };
  const canSubmit = () =>
    !profileReadOnly() &&
    draft().displayName.trim() &&
    draft().email.trim() &&
    changedItems().length > 0;

  createEffect(() => {
    const current = currentUser();
    setDraft({
      displayName: current.displayName,
      legalName: current.legalName,
      email: current.email,
    });
    setReview(false);
    setError("");
  });

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!canSubmit()) return;
    if (!review()) {
      setReview(true);
      return;
    }

    setBusy(true);
    setError("");
    try {
      await updateProfile(draft());
      setReview(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update profile.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader eyebrow="Self-service" title="Profile" />
      <form class="two-column" onSubmit={submit}>
        <GlassPanel title="Identity">
          <label>
            Display name
            <input
              value={draft().displayName}
              disabled={profileReadOnly()}
              onInput={(event) => setDraft({ ...draft(), displayName: event.currentTarget.value })}
              required
            />
          </label>
          <label>
            Legal name
            <input
              value={draft().legalName}
              disabled={profileReadOnly()}
              onInput={(event) => setDraft({ ...draft(), legalName: event.currentTarget.value })}
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={draft().email}
              disabled={profileReadOnly()}
              onInput={(event) => setDraft({ ...draft(), email: event.currentTarget.value })}
              required
            />
          </label>
          <Show when={profileReadOnly()}>
            <p class="muted">
              Profile attributes are read-only for this Kanidm session. Display name, legal name,
              and email writes require an admin-authorized person update.
            </p>
          </Show>
          <div class="review-box">
            <ClipboardCheck size={18} />
            <span>
              {review()
                ? `Reviewing ${changedItems().join(", ")} before commit.`
                : "Profile changes are staged for confirmation before commit."}
            </span>
          </div>
          <Show when={error()}>
            <div class="review-box danger">
              <CircleAlert size={18} />
              <span>{error()}</span>
            </div>
          </Show>
          <button class="primary-action" type="submit" disabled={!canSubmit() || busy()}>
            {busy() ? "Saving profile" : review() ? "Save profile" : "Review changes"}
          </button>
        </GlassPanel>

        <GlassPanel title="Access groups">
          <div class="relationship-list">
            <For each={groups()}>
              {(group) => (
                <div class="relationship-row">
                  <GitBranch size={17} />
                  <span>{group.displayName}</span>
                  <small>{group.name}</small>
                </div>
              )}
            </For>
          </div>
        </GlassPanel>
      </form>
    </>
  );
}
