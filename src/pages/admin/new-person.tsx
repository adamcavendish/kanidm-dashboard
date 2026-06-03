import { createSignal, For, Show } from "solid-js";
import { BadgeCheck, CircleAlert } from "lucide-solid";
import type { NewPersonInput, PersonCreationResult, UserStatus } from "../../domain";
import { useConsole } from "../../store";
import GlassPanel from "../../components/glass-panel";
import OptionGrid from "../../components/option-grid";
import PageHeader from "../../components/page-header";
import ReviewPanel from "../../components/review-panel";
import TextField from "../../components/text-field";
import { useNavigation } from "../../routing";
import { toggleValue } from "../../utils/collections";
import { formatDateTime } from "../../utils/format";
export function NewPersonPage() {
  const { state, config, addPerson } = useConsole();
  const { navigate } = useNavigation();
  const [review, setReview] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");
  const [created, setCreated] = createSignal<PersonCreationResult | null>(null);
  const [input, setInput] = createSignal<NewPersonInput>({
    username: "",
    displayName: "",
    legalName: "",
    email: "",
    status: "active",
    groups: [],
    credentialMode: "enrolment-link",
  });
  const canSubmit = () =>
    input().username.trim() && input().displayName.trim() && input().email.trim();
  const previewApps = () =>
    state().apps.filter((app) =>
      app.allowedGroups.some((groupId) => input().groups.includes(groupId)),
    );
  const realKanidm = () => config().dataSource.mode === "kanidm";
  const credentialOptions = () =>
    realKanidm()
      ? [
          {
            value: "enrolment-link" as const,
            label: "Credential update intent link",
          },
          {
            value: "recovery-only" as const,
            label: "Send recovery email",
          },
        ]
      : [
          {
            value: "enrolment-link" as const,
            label: "Credential update intent link",
          },
          {
            value: "temporary-password" as const,
            label: "Temporary password",
          },
          {
            value: "recovery-only" as const,
            label: "Recovery flow only",
          },
        ];
  const createdResetUrl = () =>
    created()?.credentialIntent
      ? `${window.location.origin}/reset?token=${encodeURIComponent(created()?.credentialIntent?.token ?? "")}`
      : "";

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
      const result = await addPerson(input());
      setCreated(result);
      setReview(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create user.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader eyebrow="Admin" title="Add user" />
      <form class="wizard-layout" onSubmit={submit}>
        <div class="form-stack">
          <GlassPanel title="Identity">
            <TextField
              label="Username"
              value={input().username}
              onInput={(value) => setInput({ ...input(), username: value })}
              required
            />
            <TextField
              label="Display name"
              value={input().displayName}
              onInput={(value) => setInput({ ...input(), displayName: value })}
              required
            />
            <TextField
              label="Legal name"
              value={input().legalName}
              onInput={(value) => setInput({ ...input(), legalName: value })}
            />
            <TextField
              label="Email"
              value={input().email}
              onInput={(value) => setInput({ ...input(), email: value })}
              type="email"
              required
            />
          </GlassPanel>
          <GlassPanel title="Access">
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
          <GlassPanel title="Initial credential">
            <label>
              Credential path
              <select
                value={input().credentialMode}
                onChange={(event) =>
                  setInput({
                    ...input(),
                    credentialMode: event.currentTarget.value as NewPersonInput["credentialMode"],
                  })
                }
              >
                <For each={credentialOptions()}>
                  {(option) => <option value={option.value}>{option.label}</option>}
                </For>
              </select>
            </label>
            <Show when={realKanidm()}>
              <p class="muted">
                Kanidm setup uses credential update links or recovery email. Dashboard-created
                temporary passwords are not supported by Kanidm.
              </p>
            </Show>
            <label>
              Account state
              <select
                value={input().status}
                onChange={(event) =>
                  setInput({
                    ...input(),
                    status: event.currentTarget.value as UserStatus,
                  })
                }
              >
                <option value="active">Active</option>
                <option value="locked">Locked</option>
                <option value="recovery">Recovery</option>
              </select>
            </label>
          </GlassPanel>
          <Show when={error()}>
            <div class="review-box danger">
              <CircleAlert size={18} />
              <span>{error()}</span>
            </div>
          </Show>
          <Show when={created()}>
            {(result) => (
              <GlassPanel title="User created">
                <div class="review-items">
                  <div>
                    <BadgeCheck size={18} />
                    <span>
                      Created <strong>{result().person.displayName}</strong>
                    </span>
                  </div>
                  <Show when={result().credentialIntent}>
                    {(intent) => (
                      <>
                        <label>
                          Credential setup URL
                          <input readonly value={createdResetUrl()} />
                        </label>
                        <label>
                          Intent token
                          <textarea readonly rows={3} value={intent().token} />
                        </label>
                        <p class="muted">Expires {formatDateTime(intent().expiryTime)}</p>
                      </>
                    )}
                  </Show>
                  <Show when={result().credentialEmailSent}>
                    <div class="review-box success">
                      <BadgeCheck size={18} />
                      <span>Kanidm accepted the recovery email request for this account.</span>
                    </div>
                  </Show>
                  <Show when={result().credentialNotice}>
                    <p class="muted">{result().credentialNotice}</p>
                  </Show>
                  <button
                    class="secondary-action"
                    type="button"
                    onClick={() => navigate("/admin/people")}
                  >
                    Open people
                  </button>
                </div>
              </GlassPanel>
            )}
          </Show>
        </div>
        <ReviewPanel
          active={review()}
          title="User review"
          items={[
            `Create ${input().displayName || "new user"}`,
            `Add to ${input().groups.length} group${input().groups.length === 1 ? "" : "s"}`,
            `Unlock ${previewApps().length} application${previewApps().length === 1 ? "" : "s"}`,
            `Credential path: ${input().credentialMode}`,
          ]}
          action={busy() ? "Creating user" : review() ? "Create user" : "Review user"}
          disabled={!canSubmit() || busy() || Boolean(created())}
        />
      </form>
    </>
  );
}
