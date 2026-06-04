import { createSignal, For, Show } from "solid-js";
import { BadgeCheck, CircleAlert, ServerCog } from "lucide-solid";
import type { NewServiceAccountInput, ServiceAccount } from "../../domain";
import { useConsole } from "../../store";
import GlassPanel from "../../components/glass-panel";
import OptionGrid from "../../components/option-grid";
import PageHeader from "../../components/page-header";
import ReviewPanel from "../../components/review-panel";
import TextField from "../../components/text-field";
import { useNavigation } from "../../routing";
import { toggleValue } from "../../utils/collections";

export function NewServiceAccountPage() {
  const { state, addServiceAccount } = useConsole();
  const { navigate } = useNavigation();
  const [review, setReview] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");
  const [created, setCreated] = createSignal<ServiceAccount | null>(null);
  const [input, setInput] = createSignal<NewServiceAccountInput>({
    name: "",
    displayName: "",
    description: "",
    managedBy: "",
    groups: [],
  });
  const canSubmit = () => input().name.trim() && input().displayName.trim();
  const managedByLabel = () =>
    state().groups.find((group) => group.id === input().managedBy)?.displayName || "None";

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
      const serviceAccount = await addServiceAccount(input());
      setCreated(serviceAccount);
      setReview(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create service account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader eyebrow="Admin" title="Add service account" />
      <form class="wizard-layout" onSubmit={submit}>
        <div class="form-stack">
          <GlassPanel title="Identity">
            <TextField
              label="Name"
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
                  setInput({ ...input(), description: event.currentTarget.value })
                }
              />
            </label>
            <label>
              Managed by
              <select
                value={input().managedBy}
                onChange={(event) => setInput({ ...input(), managedBy: event.currentTarget.value })}
              >
                <option value="">None</option>
                <For each={state().groups}>
                  {(group) => <option value={group.id}>{group.displayName}</option>}
                </For>
              </select>
            </label>
          </GlassPanel>
          <GlassPanel title="Initial groups">
            <OptionGrid
              options={state().groups.map((group) => ({
                id: group.id,
                label: group.displayName,
                detail: group.name,
              }))}
              selected={input().groups}
              onToggle={(groupId) =>
                setInput({
                  ...input(),
                  groups: toggleValue(input().groups, groupId),
                })
              }
            />
          </GlassPanel>
          <GlassPanel title="Vault setup">
            <div class="review-box">
              <ServerCog size={18} />
              <span>
                API tokens, generated credentials, SSH keys, and Unix settings are managed after the
                service account is created.
              </span>
            </div>
          </GlassPanel>
          <Show when={error()}>
            <div class="review-box danger">
              <CircleAlert size={18} />
              <span>{error()}</span>
            </div>
          </Show>
          <Show when={created()}>
            {(serviceAccount) => (
              <GlassPanel title="Service account created">
                <div class="review-items">
                  <div>
                    <BadgeCheck size={18} />
                    <span>
                      Created <strong>{serviceAccount().displayName}</strong>
                    </span>
                  </div>
                  <button
                    class="secondary-action"
                    type="button"
                    onClick={() => navigate("/admin/service-accounts")}
                  >
                    Open service accounts
                  </button>
                </div>
              </GlassPanel>
            )}
          </Show>
        </div>
        <ReviewPanel
          active={review()}
          title="Service account review"
          items={[
            `Create ${input().displayName || "new service account"}`,
            `Name: ${input().name || "not set"}`,
            `Managed by: ${managedByLabel()}`,
            `Add to ${input().groups.length} group${input().groups.length === 1 ? "" : "s"}`,
          ]}
          action={
            busy()
              ? "Creating service account"
              : review()
                ? "Create service account"
                : "Review service account"
          }
          disabled={!canSubmit() || busy() || Boolean(created())}
        />
      </form>
    </>
  );
}
