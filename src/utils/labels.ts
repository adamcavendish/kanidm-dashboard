import type { Group } from "../domain";

export function labelForGroup(groups: Group[], groupId: string) {
  return groups.find((group) => group.id === groupId)?.displayName ?? groupId;
}
