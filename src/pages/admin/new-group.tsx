import { createSignal, For, Show } from "solid-js";
import { BadgeCheck, CircleAlert } from "lucide-solid";
import type { GroupCreationResult, NewGroupInput } from "../../domain";
import { useConsole } from "../../store";
import GlassPanel from "../../components/glass-panel";
import OptionGrid from "../../components/option-grid";
import PageHeader from "../../components/page-header";
import ReviewPanel from "../../components/review-panel";
import TextField from "../../components/text-field";
import { useNavigation } from "../../routing";
import { toggleValue } from "../../utils/collections";
export function NewGroupPage() {
  const { state, addGroup } = useConsole();
  const { navigate } = useNavigation();
  const [review, setReview] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");
  const [created, setCreated] = createSignal<GroupCreationResult | null>(null);
  const [input, setInput] = createSignal<NewGroupInput>({
    name: "",
    displayName: "",
    description: "",
    members: [],
    parentGroups: [],
    managedBy: state().groups[0]?.id ?? "",
  });
  const affectedApps = () => state().apps.filter((app) => app.allowedGroups.includes(input().name));
  const canSubmit = () => input().name.trim() && input().displayName.trim();

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
      const result = await addGroup(input());
      setCreated(result);
      setReview(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create group.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader eyebrow="Admin" title="Add group" />
      <form class="wizard-layout" onSubmit={submit}>
        <div class="form-stack">
          <GlassPanel title="Group details">
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
            <label>
              Description
              <textarea
                rows={3}
                value={input().description}
                onInput={(event) =>
                  setInput({
                    ...input(),
                    description: event.currentTarget.value,
                  })
                }
              />
            </label>
            <label>
              Managed by
              <select
                value={input().managedBy}
                onChange={(event) => setInput({ ...input(), managedBy: event.currentTarget.value })}
              >
                <For each={state().groups}>
                  {(group) => <option value={group.id}>{group.displayName}</option>}
                </For>
              </select>
            </label>
          </GlassPanel>
          <GlassPanel title="Members">
            <OptionGrid
              options={state().people.map((person) => ({
                id: person.id,
                label: person.displayName,
                detail: person.username,
              }))}
              selected={input().members}
              onToggle={(personId) =>
                setInput({
                  ...input(),
                  members: toggleValue(input().members, personId),
                })
              }
            />
          </GlassPanel>
          <GlassPanel title="Parent groups">
            <OptionGrid
              options={state().groups.map((group) => ({
                id: group.id,
                label: group.displayName,
                detail: group.name,
              }))}
              selected={input().parentGroups}
              onToggle={(groupId) =>
                setInput({
                  ...input(),
                  parentGroups: toggleValue(input().parentGroups, groupId),
                })
              }
            />
          </GlassPanel>
          <Show when={error()}>
            <div class="review-box danger">
              <CircleAlert size={18} />
              <span>{error()}</span>
            </div>
          </Show>
          <Show when={created()}>
            {(result) => (
              <GlassPanel title="Group created">
                <div class="review-items">
                  <div>
                    <BadgeCheck size={18} />
                    <span>
                      Created <strong>{result().group.name}</strong>
                    </span>
                  </div>
                  <Show when={result().metadataWarnings.length}>
                    <div class="review-box">
                      <CircleAlert size={18} />
                      <span>
                        Kanidm created the group, but some optional metadata was not accepted:{" "}
                        {result().metadataWarnings.join(" ")}
                      </span>
                    </div>
                  </Show>
                  <Show when={!result().metadataWarnings.length}>
                    <div class="review-box success">
                      <BadgeCheck size={18} />
                      <span>Kanidm accepted the group metadata and relationships.</span>
                    </div>
                  </Show>
                  <button
                    class="secondary-action"
                    type="button"
                    onClick={() => navigate("/admin/groups")}
                  >
                    Open groups
                  </button>
                </div>
              </GlassPanel>
            )}
          </Show>
        </div>
        <ReviewPanel
          active={review()}
          title="Group review"
          items={[
            `Create ${input().displayName || "new group"}`,
            `Add ${input().members.length} direct member${input().members.length === 1 ? "" : "s"}`,
            `Attach ${input().parentGroups.length} parent group${input().parentGroups.length === 1 ? "" : "s"}`,
            `Currently affects ${affectedApps().length} application${affectedApps().length === 1 ? "" : "s"}`,
          ]}
          action={busy() ? "Creating group" : review() ? "Create group" : "Review group"}
          disabled={!canSubmit() || busy() || Boolean(created())}
        />
      </form>
    </>
  );
}
