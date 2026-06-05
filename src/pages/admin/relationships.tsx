import { createMemo, createSignal, For, Show } from "solid-js";
import { AppWindow, CircleUserRound, GitBranch, Route, Search } from "lucide-solid";
import { useConsole } from "../../store";
import GlassPanel from "../../components/glass-panel";
import PageHeader from "../../components/page-header";

export function RelationshipsPage() {
  const { state, getAccessForPerson, getGroupsForPerson } = useConsole();
  const [personId, setPersonId] = createSignal(state().people[0]?.id ?? "");
  const [filter, setFilter] = createSignal("");
  const person = createMemo(
    () => state().people.find((candidate) => candidate.id === personId()) ?? state().people[0],
  );
  const groups = createMemo(() => (person() ? getGroupsForPerson(person().id) : []));
  const access = createMemo(() => (person() ? getAccessForPerson(person().id) : []));
  const directGroupCount = createMemo(
    () => groups().filter((group) => person()?.groups.includes(group.id)).length,
  );
  const inheritedGroupCount = createMemo(() => groups().length - directGroupCount());
  const filteredAccess = createMemo(() => {
    const query = filter().trim().toLocaleLowerCase();
    if (!query) return access();

    return access().filter(({ app, groups: grantGroups }) => {
      const haystack = [
        app.displayName,
        app.name,
        app.clientType,
        ...grantGroups.flatMap((group) => [group.displayName, group.name]),
      ]
        .join(" ")
        .toLocaleLowerCase();
      return haystack.includes(query);
    });
  });
  const accessPaths = createMemo(() =>
    filteredAccess().flatMap(({ app, groups: grantGroups }) =>
      grantGroups.map((group) => ({
        app,
        group,
        membership: person()?.groups.includes(group.id) ? "direct" : "inherited",
      })),
    ),
  );

  return (
    <>
      <PageHeader eyebrow="Admin" title="Relationships" />
      <GlassPanel title="Effective access">
        <Show
          when={person()}
          fallback={<p class="muted">No people are available for relationship inspection.</p>}
        >
          {(selectedPerson) => (
            <div class="relationship-workbench">
              <div class="relationship-controls">
                <label>
                  Person
                  <select
                    value={selectedPerson().id}
                    onChange={(event) => setPersonId(event.currentTarget.value)}
                  >
                    <For each={state().people}>
                      {(candidate) => <option value={candidate.id}>{candidate.displayName}</option>}
                    </For>
                  </select>
                </label>
                <label class="relationship-filter">
                  Filter access
                  <span>
                    <Search size={18} />
                    <input
                      value={filter()}
                      onInput={(event) => setFilter(event.currentTarget.value)}
                      placeholder="Search apps, groups, client type"
                    />
                  </span>
                </label>
              </div>

              <div class="relationship-summary">
                <div>
                  <span>Person</span>
                  <strong title={selectedPerson().displayName}>
                    {selectedPerson().displayName}
                  </strong>
                  <small title={selectedPerson().username}>{selectedPerson().username}</small>
                </div>
                <div>
                  <span>Applications</span>
                  <strong>{access().length}</strong>
                  <small>{filteredAccess().length} visible</small>
                </div>
                <div>
                  <span>Groups</span>
                  <strong>{groups().length}</strong>
                  <small>
                    {directGroupCount()} direct / {inheritedGroupCount()} inherited
                  </small>
                </div>
                <div>
                  <span>Access paths</span>
                  <strong>{accessPaths().length}</strong>
                  <small>person to group to app</small>
                </div>
              </div>

              <div class="relationship-section-header">
                <div>
                  <h3>Application access matrix</h3>
                  <p class="muted">Scan the apps first, then inspect the groups granting access.</p>
                </div>
              </div>

              <Show
                when={filteredAccess().length}
                fallback={<p class="muted">No applications match this person and filter.</p>}
              >
                <div class="relationship-table-shell">
                  <table class="relationship-table">
                    <thead>
                      <tr>
                        <th>Application</th>
                        <th>Granted through</th>
                        <th>Type</th>
                        <th>Paths</th>
                      </tr>
                    </thead>
                    <tbody>
                      <For each={filteredAccess()}>
                        {({ app, groups: grantGroups }) => (
                          <tr>
                            <td>
                              <div class="relationship-entity">
                                <span>
                                  <AppWindow size={17} />
                                </span>
                                <div>
                                  <strong title={app.displayName}>{app.displayName}</strong>
                                  <small title={app.name}>{app.name}</small>
                                </div>
                              </div>
                            </td>
                            <td>
                              <div class="relationship-chip-list">
                                <For each={grantGroups}>
                                  {(group) => (
                                    <span
                                      class="chip"
                                      title={`${group.displayName} / ${group.name}`}
                                    >
                                      <span>{group.displayName}</span>
                                    </span>
                                  )}
                                </For>
                              </div>
                            </td>
                            <td>
                              <span class="status-badge">{app.clientType}</span>
                              <small>{app.status}</small>
                            </td>
                            <td>
                              <strong>{grantGroups.length}</strong>
                              <small>grant path{grantGroups.length === 1 ? "" : "s"}</small>
                            </td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </table>
                </div>
              </Show>

              <div class="relationship-section-header">
                <div>
                  <h3>Access path inspector</h3>
                  <p class="muted">Each row explains one person-to-group-to-application grant.</p>
                </div>
              </div>

              <Show
                when={accessPaths().length}
                fallback={<p class="muted">No access paths match this person and filter.</p>}
              >
                <div class="access-path-list">
                  <For each={accessPaths()}>
                    {(path) => (
                      <div class="access-path-row">
                        <div class="access-path-node">
                          <CircleUserRound size={17} />
                          <span>
                            <strong title={selectedPerson().displayName}>
                              {selectedPerson().displayName}
                            </strong>
                            <small title={selectedPerson().username}>
                              {selectedPerson().username}
                            </small>
                          </span>
                        </div>
                        <Route class="access-path-arrow" size={19} />
                        <div class="access-path-node">
                          <GitBranch size={17} />
                          <span>
                            <strong title={path.group.displayName}>{path.group.displayName}</strong>
                            <small title={path.group.name}>
                              {path.membership === "direct"
                                ? "direct membership"
                                : "inherited group"}
                            </small>
                          </span>
                        </div>
                        <Route class="access-path-arrow" size={19} />
                        <div class="access-path-node">
                          <AppWindow size={17} />
                          <span>
                            <strong title={path.app.displayName}>{path.app.displayName}</strong>
                            <small title={path.app.name}>{path.app.name}</small>
                          </span>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          )}
        </Show>
      </GlassPanel>
    </>
  );
}
