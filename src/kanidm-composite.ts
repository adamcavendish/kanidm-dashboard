import type { Configuration } from "./generated/kanidm-sdk/runtime/runtime";
import { GroupApi } from "./generated/kanidm-sdk/apis/GroupApi";
import { GroupAttrApi } from "./generated/kanidm-sdk/apis/GroupAttrApi";
import { Oauth2Api } from "./generated/kanidm-sdk/apis/Oauth2Api";
import type { Entry } from "./generated/kanidm-sdk/models/Entry";
import { groupCreateEntry, oauth2CreateEntry, oauth2ScopeMaps } from "./kanidm-mappers";
import type { NewGroupInput, NewApplicationInput, GroupCreationResult } from "./domain";

export async function createGroup(
  config: Configuration,
  input: NewGroupInput,
): Promise<Pick<GroupCreationResult, "metadataWarnings">> {
  const api = new GroupApi(config);
  const attrApi = new GroupAttrApi(config);
  const name = input.name.trim();
  await api.groupPost({ body: groupCreateEntry(input) as unknown as Entry });

  const warnings: string[] = [];

  async function trySet(attr: string, values: string[]) {
    try {
      await attrApi.groupIdAttrPut({ id: name, attr, body: values });
      return "";
    } catch (e) {
      if (e instanceof Error && "response" in e) {
        const s = (e as { response: Response }).response.status;
        if ([400, 403, 404, 405].includes(s)) {
          return `Kanidm did not accept group ${attr} metadata (${s}).`;
        }
      }
      throw e;
    }
  }

  if (input.displayName.trim() && input.displayName.trim() !== name) {
    const w = await trySet("displayname", [input.displayName.trim()]);
    if (w) warnings.push(w);
  }
  if (input.description.trim()) {
    const w = await trySet("description", [input.description.trim()]);
    if (w) warnings.push(w);
  }
  if (input.managedBy.trim()) {
    const w = await trySet("entry_managed_by", [input.managedBy.trim()]);
    if (w) warnings.push(w);
  }
  return { metadataWarnings: warnings };
}

export async function createOAuth2Application(
  config: Configuration,
  input: NewApplicationInput,
): Promise<{ clientSecret?: string }> {
  const api = new Oauth2Api(config);
  const entry = oauth2CreateEntry(input) as unknown as Entry;
  const appName = input.name.trim();

  if (input.clientType === "public") {
    await api.oauth2PublicPost({ body: entry });
  } else {
    await api.oauth2BasicPost({ body: entry });
  }

  for (const sm of oauth2ScopeMaps(input)) {
    await api.oauth2IdScopemapPost({
      rsName: appName,
      group: sm.groupId,
      body: sm.scopes,
    });
  }

  if (input.clientType === "confidential") {
    const secret = await api.oauth2IdGetBasicSecret({ rsName: appName });
    return { clientSecret: secret ?? "" };
  }
  return {};
}
