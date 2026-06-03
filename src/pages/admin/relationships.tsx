import { createSignal, For } from "solid-js";
import { AppWindow, CircleUserRound, GitBranch } from "lucide-solid";
import { useConsole } from "../../store";
import GlassPanel from "../../components/glass-panel";
import PageHeader from "../../components/page-header";
import { NodeCard } from "../../components/node-card";
export function RelationshipsPage() {
  const { state, getAccessForPerson, getGroupsForPerson } = useConsole();
  const [personId, setPersonId] = createSignal(state().people[0]?.id ?? "");
  const person = () =>
    state().people.find((candidate) => candidate.id === personId()) ?? state().people[0];
  const groups = () => getGroupsForPerson(person().id);
  const access = () => getAccessForPerson(person().id);

  return (
    <>
      <PageHeader eyebrow="Admin" title="Relationships" />
      <GlassPanel title="Effective access">
        <label class="compact-select">
          Person
          <select value={person().id} onChange={(event) => setPersonId(event.currentTarget.value)}>
            <For each={state().people}>
              {(candidate) => <option value={candidate.id}>{candidate.displayName}</option>}
            </For>
          </select>
        </label>
        <div class="relationship-map">
          <div class="relation-column">
            <h3>User</h3>
            <NodeCard
              icon={<CircleUserRound />}
              title={person().displayName}
              subtitle={person().username}
            />
          </div>
          <div class="relation-column">
            <h3>Groups</h3>
            <For each={groups()}>
              {(group) => (
                <NodeCard icon={<GitBranch />} title={group.displayName} subtitle={group.name} />
              )}
            </For>
          </div>
          <div class="relation-column">
            <h3>Applications</h3>
            <For each={access()}>
              {({ app, groups: through }) => (
                <NodeCard
                  icon={<AppWindow />}
                  title={app.displayName}
                  subtitle={`via ${through.map((group) => group.displayName).join(", ")}`}
                />
              )}
            </For>
          </div>
        </div>
      </GlassPanel>
    </>
  );
}
