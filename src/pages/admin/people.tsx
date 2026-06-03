import { createSignal, For, Show } from "solid-js";
import { CircleAlert, ClipboardCheck, UserRoundPlus } from "lucide-solid";
import type { CredentialUpdateIntent, Person } from "../../domain";
import { useConsole } from "../../store";
import GlassPanel from "../../components/glass-panel";
import KeyValue from "../../components/key-value";
import PageHeader from "../../components/page-header";
import { CredentialMeter } from "../../components/credential-meter";
import { StatusBadge } from "../../components/status-badge";
import { Toolbar } from "../../components/toolbar";
import { Link } from "../../routing";
import { formatDateTime } from "../../utils/format";
import { searchable } from "../../utils/search";
export function PeoplePage() {
  const { state, getAccessForPerson, issueCredentialUpdateIntent } = useConsole();
  const [query, setQuery] = createSignal("");
  const [intentPersonId, setIntentPersonId] = createSignal("");
  const [intentResult, setIntentResult] = createSignal<CredentialUpdateIntent | null>(null);
  const [intentBusy, setIntentBusy] = createSignal(false);
  const [intentError, setIntentError] = createSignal("");
  const people = () =>
    state().people.filter((person) => searchable(person).includes(query().toLowerCase()));
  const intentPerson = () =>
    state().people.find((person) => person.id === intentPersonId()) ?? null;

  async function issueIntent() {
    const person = intentPerson();
    if (!person) return;
    setIntentBusy(true);
    setIntentError("");
    try {
      setIntentResult(await issueCredentialUpdateIntent(person.id, 3600));
    } catch (err) {
      setIntentError(err instanceof Error ? err.message : "Could not issue credential intent.");
    } finally {
      setIntentBusy(false);
    }
  }

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
      <Show when={intentPerson()}>
        {(person) => (
          <CredentialIntentPanel
            person={person()}
            result={intentResult()}
            busy={intentBusy()}
            error={intentError()}
            onIssue={() => void issueIntent()}
            onCancel={() => {
              setIntentPersonId("");
              setIntentResult(null);
              setIntentError("");
            }}
          />
        )}
      </Show>
      <div class="table-shell">
        <table>
          <thead>
            <tr>
              <th>Person</th>
              <th>Status</th>
              <th>Groups</th>
              <th>Applications</th>
              <th>Credentials</th>
              <th>Last auth</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <For each={people()}>
              {(person) => (
                <tr>
                  <td>
                    <strong>{person.displayName}</strong>
                    <small>
                      {person.username} · {person.email}
                    </small>
                  </td>
                  <td>
                    <StatusBadge status={person.status} />
                  </td>
                  <td>{person.groups.length}</td>
                  <td>{getAccessForPerson(person.id).length}</td>
                  <td>
                    <CredentialMeter person={person} compact />
                  </td>
                  <td>{person.lastAuth}</td>
                  <td>
                    <button
                      class="secondary-action"
                      type="button"
                      onClick={() => {
                        setIntentPersonId(person.id);
                        setIntentResult(null);
                        setIntentError("");
                      }}
                    >
                      <ClipboardCheck size={16} /> Issue reset
                    </button>
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
    </>
  );
}

function CredentialIntentPanel(props: {
  person: Person;
  result: CredentialUpdateIntent | null;
  busy: boolean;
  error: string;
  onIssue: () => void;
  onCancel: () => void;
}) {
  const resetUrl = () =>
    props.result
      ? `${window.location.origin}/reset?token=${encodeURIComponent(props.result.token)}`
      : "";

  return (
    <GlassPanel title="Credential update review">
      <div class="intent-layout">
        <div>
          <strong>{props.person.displayName}</strong>
          <p class="muted">
            This issues a one-hour credential update token for password, passkey, TOTP, Unix, and
            SSH credential recovery flows.
          </p>
          <div class="review-box danger">
            <CircleAlert size={18} />
            <span>
              Anyone with this token can start credential update for {props.person.username} until
              it expires.
            </span>
          </div>
        </div>
        <div class="button-row">
          <button
            class="primary-action"
            type="button"
            disabled={props.busy}
            onClick={props.onIssue}
          >
            <ClipboardCheck size={16} /> {props.busy ? "Issuing token" : "Issue token"}
          </button>
          <button class="secondary-action" type="button" onClick={props.onCancel}>
            Cancel
          </button>
        </div>
      </div>
      <Show when={props.error}>
        <div class="review-box danger">
          <CircleAlert size={18} />
          <span>{props.error}</span>
        </div>
      </Show>
      <Show when={props.result}>
        {(intent) => (
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
        )}
      </Show>
    </GlassPanel>
  );
}
