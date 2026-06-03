import type {
  Application,
  ApplicationPatch,
  ConsoleState,
  DashboardDataSourceConfig,
  Group,
  GroupCreationResult,
  NewApplicationInput,
  NewGroupInput,
  NewPersonInput,
  Person,
  PersonCertificate,
  PersonCreationResult,
  PersonStatusPatch,
  ProfileUpdateInput,
  SshPublicKey,
  UnixAccountSettings,
  UserAuthTokenStatus,
  CredentialUpdateIntent,
  CredentialUpdateStatus,
} from "./domain";
import { mapKanidmState, oauth2PatchEntry } from "./kanidm-mappers";
import { Configuration } from "./generated/kanidm-sdk/runtime/runtime";
import { SelfApi } from "./generated/kanidm-sdk/apis/SelfApi";
import { PersonApi } from "./generated/kanidm-sdk/apis/PersonApi";
import { GroupApi } from "./generated/kanidm-sdk/apis/GroupApi";
import { Oauth2Api } from "./generated/kanidm-sdk/apis/Oauth2Api";
import { DomainApi } from "./generated/kanidm-sdk/apis/DomainApi";
import { PersonRadiusApi } from "./generated/kanidm-sdk/apis/PersonRadiusApi";
import { PersonSshPubkeysApi } from "./generated/kanidm-sdk/apis/PersonSshPubkeysApi";
import { PersonUnixApi } from "./generated/kanidm-sdk/apis/PersonUnixApi";
import { AccountApi } from "./generated/kanidm-sdk/apis/AccountApi";
import { PersonAttrApi } from "./generated/kanidm-sdk/apis/PersonAttrApi";
import { GroupAttrApi } from "./generated/kanidm-sdk/apis/GroupAttrApi";
import { PersonCredentialApi } from "./generated/kanidm-sdk/apis/PersonCredentialApi";
import { PersonCertificateApi } from "./generated/kanidm-sdk/apis/PersonCertificateApi";
import { CredentialApi } from "./generated/kanidm-sdk/apis/CredentialApi";
import type { Entry } from "./generated/kanidm-sdk/models/Entry";
import { createGroup, createOAuth2Application } from "./kanidm-composite";
import { KanidmHttpError, kanidmHttpError } from "./kanidm-error";
import {
  personCreateEntry,
  mapUserAuthTokenStatus,
  mapCredentialUpdateStatus,
  mapPersonCertificates,
} from "./kanidm-mappers";

export interface DashboardDataSource {
  load(): Promise<ConsoleState>;
  createPerson(input: NewPersonInput): Promise<PersonCreationResult>;
  deletePerson(id: string): Promise<void>;
  updatePersonProfile(id: string, input: ProfileUpdateInput): Promise<void>;
  updatePersonStatus(id: string, patch: PersonStatusPatch): Promise<void>;
  personCertificates(id: string): Promise<PersonCertificate[]>;
  addPersonCertificate(id: string, certificate: string): Promise<void>;
  createGroup(input: NewGroupInput): Promise<Pick<GroupCreationResult, "metadataWarnings">>;
  deleteGroup(id: string): Promise<void>;
  updateGroup(
    id: string,
    patch: Partial<Pick<Group, "displayName" | "description" | "managedBy">>,
  ): Promise<void>;
  addGroupMembers(name: string, members: string[]): Promise<void>;
  removeGroupMembers(name: string, members: string[]): Promise<void>;
  createOAuth2Application(input: NewApplicationInput): Promise<{ clientSecret?: string }>;
  updateOAuth2Application(appName: string, patch: ApplicationPatch): Promise<void>;
  deleteOAuth2Application(appName: string): Promise<void>;
  updateOAuth2ApplicationScopeMap(
    appName: string,
    groupName: string,
    scopes: string[],
  ): Promise<void>;
  deleteOAuth2ApplicationScopeMap(appName: string, groupName: string): Promise<void>;
  uploadOAuth2ApplicationImage(appName: string, file: File): Promise<void>;
  deleteOAuth2ApplicationImage(appName: string): Promise<void>;
  radiusPassword(id: string): Promise<string | null>;
  generateRadiusPassword(id: string): Promise<string | null>;
  deleteRadiusPassword(id: string): Promise<void>;
  sshPublicKeys(id: string): Promise<SshPublicKey[]>;
  addSshPublicKey(id: string, tag: string, key: string): Promise<void>;
  deleteSshPublicKey(id: string, tag: string): Promise<void>;
  userAuthTokens(id: string): Promise<UserAuthTokenStatus[]>;
  deleteUserAuthToken(id: string, sessionId: string): Promise<void>;
  extendUnixAccount(
    id: string,
    input: Pick<UnixAccountSettings, "gidNumber" | "shell">,
  ): Promise<void>;
  setUnixCredential(id: string, password: string): Promise<void>;
  deleteUnixCredential(id: string): Promise<void>;
  credentialUpdateIntent(id: string, ttl: number): Promise<CredentialUpdateIntent>;
  sendCredentialUpdateIntent(id: string, ttl: number, email: string): Promise<void>;
  exchangeCredentialUpdateIntent(token: string): Promise<string>;
  credentialUpdateStatus(token: string): Promise<CredentialUpdateStatus>;
  credentialUpdate(sessionToken: string, body: unknown): Promise<CredentialUpdateStatus>;
  commitCredentialUpdate(token: string): Promise<void>;
  cancelCredentialUpdate(token: string): Promise<void>;
  setDomainDisplayName(name: string): Promise<void>;
  uploadDomainImage(file: File): Promise<void>;
  deleteDomainImage(): Promise<void>;
  fetchImage(url: string): Promise<Blob>;
}

export class KanidmDataSource implements DashboardDataSource {
  readonly config: Configuration;

  constructor(config: DashboardDataSourceConfig, bearerToken?: string) {
    this.config = new Configuration({
      basePath: config.apiBasePath.replace(/\/$/, ""),
      credentials: "include",
      headers: { Accept: "application/json" },
      accessToken: bearerToken ? () => bearerToken : undefined,
    });
  }

  async load(): Promise<ConsoleState> {
    const selfApi = new SelfApi(this.config);
    const personApi = new PersonApi(this.config);
    const groupApi = new GroupApi(this.config);
    const oauth2Api = new Oauth2Api(this.config);
    const domainApi = new DomainApi(this.config);

    const [selfRes, people, groups, apps, appLinks, domainDisplayName, domainEntries] =
      await Promise.all([
        selfApi.whoami(),
        personApi.personGet(),
        groupApi.groupGet(),
        oauth2Api.oauth2Get(),
        selfApi.selfApplinksGet().catch(() => []),
        domainApi
          .domainAttrGet({ attr: "domain_display_name" })
          .then((v) => (v as string[])?.[0] ?? "")
          .catch(() => ""),
        domainApi.domainGet().catch(() => []),
      ]);

    return mapKanidmState(
      selfRes.youare as never,
      people as never,
      groups as never,
      apps as never,
      {
        appLinks: appLinks as never,
        domainDisplayName: domainDisplayName as never,
        domainHasImage: (domainEntries as Array<{ attrs?: Record<string, string[]> }>).some(
          (entry) => Boolean(entry.attrs?.image?.length),
        ),
        canManageNativeDomainBranding: (domainEntries as Array<unknown>).length > 0,
      },
    );
  }

  async createPerson(input: NewPersonInput): Promise<PersonCreationResult> {
    const username = input.username.trim();
    await new PersonApi(this.config).personPost({
      body: personCreateEntry(input) as unknown as Entry,
    });
    if (input.legalName.trim()) {
      await new PersonAttrApi(this.config).personIdPutAttr({
        id: username,
        attr: "legalname",
        body: [input.legalName.trim()],
      });
    }
    const memberships = input.groups;
    if (memberships.length) {
      await Promise.all(
        memberships.map((groupName) =>
          new GroupAttrApi(this.config).groupIdAttrPost({
            id: groupName,
            attr: "member",
            body: [username],
          }),
        ),
      );
    }
    if (input.credentialMode === "recovery-only") {
      await new PersonCredentialApi(this.config).personIdCredentialUpdateIntentSendPost({
        id: username,
        body: { ttl: 3600, email: input.email },
      });
      const created = (await this.load()).people.find((p) => p.username === username);
      if (!created)
        throw new Error(`Kanidm created ${username}, but it was not visible after reload.`);
      return { person: created, credentialEmailSent: true };
    }
    const r = await new PersonCredentialApi(this.config).personIdCredentialUpdateIntentTtlGet({
      id: username,
      ttl: 3600,
    });
    const intent = { token: r.token, expiryTime: r.expiryTime };
    const created = (await this.load()).people.find((p) => p.username === username);
    if (!created)
      throw new Error(`Kanidm created ${username}, but it was not visible after reload.`);
    return { person: created, credentialIntent: intent };
  }

  async deletePerson(id: string): Promise<void> {
    await new PersonApi(this.config).personIdDelete({ id });
  }

  async updatePersonProfile(id: string, input: ProfileUpdateInput): Promise<void> {
    await Promise.all([
      new PersonAttrApi(this.config).personIdPutAttr({
        id,
        attr: "displayname",
        body: [input.displayName.trim()],
      }),
      new PersonAttrApi(this.config).personIdPutAttr({
        id,
        attr: "legalname",
        body: [input.legalName.trim()],
      }),
      new PersonAttrApi(this.config).personIdPutAttr({
        id,
        attr: "mail",
        body: [input.email.trim()],
      }),
    ]);
  }

  async updatePersonStatus(id: string, patch: PersonStatusPatch): Promise<void> {
    const api = new PersonAttrApi(this.config);
    const writes: Promise<void>[] = [];

    if (patch.status === "locked") {
      writes.push(api.personIdPutAttr({ id, attr: "nsaccountlock", body: ["true"] }));
    } else {
      writes.push(deletePersonAttr(api, id, "nsaccountlock"));
    }

    writeOptionalPersonAttr(api, writes, id, "accountexpire", patch.expireAt);
    writeOptionalPersonAttr(api, writes, id, "accountsoftlockexpire", patch.softLockExpire);
    writeOptionalPersonAttr(api, writes, id, "accountvalidfrom", patch.validFrom);

    await Promise.all(writes);
  }

  async personCertificates(id: string): Promise<PersonCertificate[]> {
    const entry = await new PersonCertificateApi(this.config).personGetIdCertificate({ id });
    return mapPersonCertificates(entry as never);
  }

  async addPersonCertificate(id: string, certificate: string): Promise<void> {
    await new PersonCertificateApi(this.config).personPostIdCertificate({
      id,
      body: { attrs: { certificate: [certificate.trim()] } } as unknown as Entry,
    });
  }

  async createGroup(input: NewGroupInput): Promise<Pick<GroupCreationResult, "metadataWarnings">> {
    return createGroup(this.config, input);
  }

  async deleteGroup(id: string): Promise<void> {
    await new GroupApi(this.config).groupIdDelete({ id });
  }

  async updateGroup(
    id: string,
    patch: Partial<Pick<Group, "displayName" | "description" | "managedBy">>,
  ): Promise<void> {
    const attrApi = new GroupAttrApi(this.config);
    const updates: Promise<unknown>[] = [];
    if (patch.displayName !== undefined) {
      updates.push(
        attrApi.groupIdAttrPut({
          id,
          attr: "displayname",
          body: [patch.displayName],
        }),
      );
    }
    if (patch.description !== undefined) {
      updates.push(
        attrApi.groupIdAttrPut({
          id,
          attr: "description",
          body: [patch.description],
        }),
      );
    }
    if (patch.managedBy !== undefined) {
      const body = patch.managedBy ? [patch.managedBy] : [];
      updates.push(attrApi.groupIdAttrPut({ id, attr: "entry_managed_by", body }));
    }
    await Promise.all(updates);
  }

  async addGroupMembers(name: string, members: string[]): Promise<void> {
    await new GroupAttrApi(this.config).groupIdAttrPost({
      id: name,
      attr: "member",
      body: members,
    });
  }

  async removeGroupMembers(name: string, members: string[]): Promise<void> {
    await new GroupAttrApi(this.config).groupIdAttrDelete({
      id: name,
      attr: "member",
      body: members,
    });
  }

  async createOAuth2Application(input: NewApplicationInput): Promise<{ clientSecret?: string }> {
    return createOAuth2Application(this.config, input);
  }

  async updateOAuth2Application(appName: string, patch: ApplicationPatch): Promise<void> {
    const hasMetadata =
      patch.displayName !== undefined ||
      patch.landingUrl !== undefined ||
      patch.redirectUris !== undefined;
    if (!hasMetadata) return;
    await new Oauth2Api(this.config).oauth2IdPatch({
      rsName: appName,
      body: oauth2PatchEntry(patch) as unknown as Entry,
    });
  }

  async deleteOAuth2Application(appName: string): Promise<void> {
    await new Oauth2Api(this.config).oauth2IdDelete({ rsName: appName });
  }

  async updateOAuth2ApplicationScopeMap(
    appName: string,
    groupName: string,
    scopes: string[],
  ): Promise<void> {
    await new Oauth2Api(this.config).oauth2IdScopemapPost({
      rsName: appName,
      group: groupName,
      body: scopes,
    });
  }

  async deleteOAuth2ApplicationScopeMap(appName: string, groupName: string): Promise<void> {
    await new Oauth2Api(this.config).oauth2IdScopemapDelete({
      rsName: appName,
      group: groupName,
    });
  }

  private async uploadImage(path: string, file: File): Promise<void> {
    const form = new FormData();
    form.append("file", file);
    const token = await this.config.accessToken?.();
    const response = await fetch(`${this.config.basePath}${path}`, {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: form,
    });
    if (!response.ok) throw await kanidmHttpError(path, response);
  }

  async uploadOAuth2ApplicationImage(appName: string, file: File): Promise<void> {
    return this.uploadImage(`/v1/oauth2/${encodeURIComponent(appName)}/_image`, file);
  }

  async deleteOAuth2ApplicationImage(appName: string): Promise<void> {
    await new Oauth2Api(this.config).oauth2IdImageDelete({ rsName: appName });
  }

  async radiusPassword(id: string): Promise<string | null> {
    try {
      const r = await new PersonRadiusApi(this.config).personIdRadiusTokenGet({
        id,
      });
      return r.secret;
    } catch (error) {
      if (kanidmErrorStatus(error) === 404) return null;
      throw error;
    }
  }

  async generateRadiusPassword(id: string): Promise<string | null> {
    const api = new PersonRadiusApi(this.config);
    await api.personIdRadiusPost({ id });
    try {
      const r = await api.personIdRadiusTokenGet({ id });
      return r.secret;
    } catch (error) {
      if (kanidmErrorStatus(error) === 404) {
        return null;
      }
      throw error;
    }
  }

  async deleteRadiusPassword(id: string): Promise<void> {
    await new PersonRadiusApi(this.config).personIdRadiusDelete({ id });
  }

  async sshPublicKeys(id: string): Promise<SshPublicKey[]> {
    const api = new PersonSshPubkeysApi(this.config);
    const tags = (await api.personIdSshPubkeysGet({ id })) as string[];
    return Promise.all(
      tags.map(async (tag) => ({
        tag,
        key: (await api.personIdSshPubkeysTagGet({
          id,
          tag,
        })) as unknown as string,
      })),
    );
  }

  async addSshPublicKey(id: string, tag: string, key: string): Promise<void> {
    await new PersonSshPubkeysApi(this.config).personIdSshPubkeysPost({
      id,
      body: [tag.trim(), key.trim()] as unknown as string[],
    });
  }

  async deleteSshPublicKey(id: string, tag: string): Promise<void> {
    await new PersonSshPubkeysApi(this.config).personIdSshPubkeysTagDelete({
      id,
      tag,
    });
  }

  async userAuthTokens(id: string): Promise<UserAuthTokenStatus[]> {
    const response = await new AccountApi(this.config).accountIdUserAuthTokenGetRaw({
      id,
    });
    const text = await response.raw.text();
    if (!text.trim()) return [];
    const tokens = JSON.parse(text) as Array<Record<string, unknown>>;
    return (tokens ?? []).map((token) => mapUserAuthTokenStatus(token));
  }

  async deleteUserAuthToken(id: string, sessionId: string): Promise<void> {
    await new AccountApi(this.config).accountUserAuthTokenDelete({
      id,
      tokenId: sessionId,
    });
  }

  async extendUnixAccount(
    id: string,
    input: Pick<UnixAccountSettings, "gidNumber" | "shell">,
  ): Promise<void> {
    await new PersonUnixApi(this.config).personIdUnixPost({
      id,
      body: { gidnumber: input.gidNumber, shell: input.shell } as never,
    });
  }

  async setUnixCredential(id: string, password: string): Promise<void> {
    await new PersonUnixApi(this.config).personIdUnixCredentialPut({
      id,
      body: { value: password },
    });
  }

  async deleteUnixCredential(id: string): Promise<void> {
    await new PersonUnixApi(this.config).personIdUnixCredentialDelete({ id });
  }

  async credentialUpdateIntent(id: string, ttl: number): Promise<CredentialUpdateIntent> {
    const r = await new PersonCredentialApi(this.config).personIdCredentialUpdateIntentTtlGet({
      id,
      ttl,
    });
    return {
      token: r.token,
      expiryTime: r.expiryTime,
    };
  }

  async sendCredentialUpdateIntent(id: string, ttl: number, email: string): Promise<void> {
    await new PersonCredentialApi(this.config).personIdCredentialUpdateIntentSendPost({
      id,
      body: { ttl, email },
    });
  }

  async exchangeCredentialUpdateIntent(token: string): Promise<string> {
    const res = await fetch(`${this.config.basePath}/v1/credential/_exchange_intent`, {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(token),
    });
    if (!res.ok) throw new Error(`Credential exchange failed: ${res.status}`);
    const body = (await res.json()) as [{ token: string }, unknown];
    return body[0].token;
  }

  async credentialUpdateStatus(token: string): Promise<CredentialUpdateStatus> {
    const res = await fetch(`${this.config.basePath}/v1/credential/_status`, {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) throw new Error(`Credential status failed: ${res.status}`);
    const body = await res.json();
    return mapCredentialUpdateStatus(token, body as never);
  }

  async credentialUpdate(sessionToken: string, body: unknown): Promise<CredentialUpdateStatus> {
    const res = await fetch(`${this.config.basePath}/v1/credential/_update`, {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Credential update failed: ${res.status}`);
    const r = await res.json();
    return mapCredentialUpdateStatus(sessionToken, r as never);
  }

  async commitCredentialUpdate(token: string): Promise<void> {
    await new CredentialApi(this.config).credentialUpdateCommit({
      body: { token },
    });
  }

  async cancelCredentialUpdate(token: string): Promise<void> {
    await new CredentialApi(this.config).credentialUpdateCancel({
      body: { token },
    });
  }

  async setDomainDisplayName(name: string): Promise<void> {
    await new DomainApi(this.config).domainAttrPut({
      attr: "domain_display_name",
      body: [name],
    });
  }

  async uploadDomainImage(file: File): Promise<void> {
    return this.uploadImage("/v1/domain/_image", file);
  }

  async deleteDomainImage(): Promise<void> {
    await new DomainApi(this.config).domainImageDelete();
  }

  async fetchImage(url: string): Promise<Blob> {
    const token = await this.config.accessToken?.();
    const response = await fetch(`${this.config.basePath}${url}`, {
      credentials: "include",
      headers: {
        Accept: "image/*",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!response.ok) throw await kanidmHttpError(url, response);
    return response.blob();
  }
}

function writeOptionalPersonAttr(
  api: PersonAttrApi,
  writes: Promise<void>[],
  id: string,
  attr: string,
  value: string | undefined,
) {
  if (value === undefined) return;
  const trimmed = value.trim();
  writes.push(
    trimmed ? api.personIdPutAttr({ id, attr, body: [trimmed] }) : deletePersonAttr(api, id, attr),
  );
}

function kanidmErrorStatus(error: unknown) {
  if (error instanceof KanidmHttpError) return error.status;
  if (error instanceof Error && "response" in error) {
    return (error as { response?: Response }).response?.status;
  }
  return undefined;
}

async function deletePersonAttr(api: PersonAttrApi, id: string, attr: string) {
  try {
    await api.personIdDeleteAttr({ id, attr });
  } catch (error) {
    if (kanidmErrorStatus(error) === 404) return;
    throw error;
  }
}

import { initialState, seedPeople } from "./seed";

export class MockDataSource implements DashboardDataSource {
  private state: ConsoleState;
  private radiusPasswords: Record<string, string> = {};
  private certificates: Record<string, PersonCertificate[]> = {};
  private storageKey: string;

  constructor(storageKey = "kanidm-dashboard-state-v2") {
    this.storageKey = storageKey;
    const stored = typeof localStorage !== "undefined" ? localStorage.getItem(storageKey) : null;
    this.state = stored ? (JSON.parse(stored) as ConsoleState) : structuredClone(initialState);
  }

  private persist() {
    if (typeof localStorage !== "undefined")
      localStorage.setItem(this.storageKey, JSON.stringify(this.state));
  }

  async load(): Promise<ConsoleState> {
    return this.state;
  }
  async radiusPassword(id: string): Promise<string | null> {
    const p = this.state.people.find((x) => x.id === id);
    if (!p?.credential.radiusPassword) return null;
    return (
      this.radiusPasswords[id] ??
      (seedPeople.find((x) => x.id === id)?.credential.radiusPassword ? "rad-demo-2a7c-9e4f" : null)
    );
  }
  async deleteRadiusPassword(id: string): Promise<void> {
    delete this.radiusPasswords[id];
    this.state = {
      ...this.state,
      people: this.state.people.map((p) =>
        p.id === id ? { ...p, credential: { ...p.credential, radiusPassword: false } } : p,
      ),
    };
    this.persist();
  }
  async createPerson(input: NewPersonInput): Promise<PersonCreationResult> {
    const person: Person = {
      id: `mock-${input.username.trim()}`,
      username: input.username.trim(),
      displayName: input.displayName.trim(),
      legalName: input.legalName.trim() || input.displayName.trim(),
      email: input.email.trim(),
      status: input.status,
      groups: input.groups,
      credential: {
        password: input.credentialMode === "temporary-password" ? "needs-update" : "missing",
        passkeys: 0,
        totp: false,
        backupCodes: 0,
        unixCredential: false,
        sshKeys: 0,
        radiusPassword: false,
      },
      unix: { gidNumber: null, shell: "", credentialSet: false },
      lastAuth: "Never",
    } as Person;
    this.state = {
      ...this.state,
      people: [...this.state.people, person],
      groups: this.state.groups.map((g) =>
        input.groups.includes(g.id)
          ? { ...g, members: [...new Set([...g.members, person.id])] }
          : g,
      ),
    };
    this.persist();
    if (input.credentialMode === "enrolment-link") {
      return {
        person,
        credentialIntent: {
          token: `kc_demo_${person.username}_${Math.random().toString(36).slice(2, 10)}`,
          expiryTime: new Date(Date.now() + 3600 * 1000).toISOString(),
        },
      };
    }
    if (input.credentialMode === "recovery-only") {
      return {
        person,
        credentialEmailSent: true,
        credentialNotice: "Mock recovery email marked as sent.",
      };
    }
    return {
      person,
      credentialNotice: "Mock temporary password state was staged.",
    };
  }
  async deletePerson(id: string): Promise<void> {
    this.state = {
      ...this.state,
      people: this.state.people.filter((p) => p.id !== id),
      groups: this.state.groups.map((g) => ({
        ...g,
        members: g.members.filter((memberId) => memberId !== id),
      })),
    };
    this.persist();
  }
  async updatePersonProfile(id: string, input: ProfileUpdateInput): Promise<void> {
    this.state = {
      ...this.state,
      people: this.state.people.map((p) =>
        p.id === id
          ? {
              ...p,
              displayName: input.displayName.trim(),
              legalName: input.legalName.trim(),
              email: input.email.trim(),
            }
          : p,
      ),
    };
    this.persist();
  }
  async updatePersonStatus(id: string, patch: PersonStatusPatch): Promise<void> {
    this.state = {
      ...this.state,
      people: this.state.people.map((p) =>
        p.id === id
          ? {
              ...p,
              status: patch.status || p.status,
              ...(patch.validFrom !== undefined ? { validFrom: patch.validFrom } : {}),
              ...(patch.expireAt !== undefined ? { expireAt: patch.expireAt } : {}),
              ...(patch.softLockExpire !== undefined
                ? { softLockExpire: patch.softLockExpire }
                : {}),
            }
          : p,
      ),
    };
    this.persist();
  }
  async personCertificates(id: string): Promise<PersonCertificate[]> {
    return this.certificates[id] ?? [];
  }
  async addPersonCertificate(id: string, certificate: string): Promise<void> {
    const nextCertificate: PersonCertificate = {
      id: `mock-cert-${Date.now()}`,
      label: `Certificate ${(this.certificates[id] ?? []).length + 1}`,
      pem: certificate.trim(),
    };
    this.certificates = {
      ...this.certificates,
      [id]: [...(this.certificates[id] ?? []), nextCertificate],
    };
  }
  async createGroup(input: NewGroupInput): Promise<Pick<GroupCreationResult, "metadataWarnings">> {
    const group: Group = {
      id: `mock-${input.name.trim()}`,
      name: input.name.trim(),
      displayName: input.displayName.trim(),
      description: input.description.trim(),
      members: input.members,
      parentGroups: input.parentGroups,
      managedBy: input.managedBy,
    } as Group;
    this.state = {
      ...this.state,
      groups: [...this.state.groups, group],
      people: this.state.people.map((p) =>
        input.members.includes(p.id) ? { ...p, groups: [...new Set([...p.groups, group.id])] } : p,
      ),
    };
    this.persist();
    return { metadataWarnings: [] };
  }
  async deleteGroup(id: string): Promise<void> {
    this.state = {
      ...this.state,
      groups: this.state.groups.filter((g) => g.id !== id),
    };
    this.persist();
  }
  async updateGroup(
    id: string,
    patch: Partial<Pick<Group, "displayName" | "description">>,
  ): Promise<void> {
    this.state = {
      ...this.state,
      groups: this.state.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    };
    this.persist();
  }
  async addGroupMembers(name: string, members: string[]): Promise<void> {
    const group = this.state.groups.find((g) => g.name === name);
    if (!group) return;
    this.state = {
      ...this.state,
      groups: this.state.groups.map((g) =>
        g.name === name ? { ...g, members: [...new Set([...g.members, ...members])] } : g,
      ),
      people: this.state.people.map((p) =>
        members.includes(p.id) ? { ...p, groups: [...new Set([...p.groups, group.id])] } : p,
      ),
    };
    this.persist();
  }
  async removeGroupMembers(name: string, members: string[]): Promise<void> {
    const group = this.state.groups.find((g) => g.name === name);
    if (!group) return;
    this.state = {
      ...this.state,
      groups: this.state.groups.map((g) =>
        g.name === name ? { ...g, members: g.members.filter((m) => !members.includes(m)) } : g,
      ),
      people: this.state.people.map((p) =>
        members.includes(p.id) ? { ...p, groups: p.groups.filter((gid) => gid !== group.id) } : p,
      ),
    };
    this.persist();
  }
  async createOAuth2Application(input: NewApplicationInput): Promise<{ clientSecret?: string }> {
    const app: Application = {
      id: `mock-${input.name.trim()}`,
      name: input.name.trim(),
      displayName: input.displayName.trim(),
      landingUrl: input.landingUrl.trim(),
      imageUrl: input.imageUrl.trim(),
      clientType: input.clientType,
      redirectUris: input.redirectUris,
      allowedGroups: input.allowedGroups,
      scopes: input.scopes,
      scopeMaps: input.scopeMaps ?? [],
      status: "draft",
    } as Application;
    this.state = { ...this.state, apps: [...this.state.apps, app] };
    this.persist();
    return {
      ...app,
      clientSecret:
        input.clientType === "confidential"
          ? `mock-secret-${Math.random().toString(36).slice(2, 12)}`
          : undefined,
    };
  }
  async uploadOAuth2ApplicationImage(_appName: string, _file: File): Promise<void> {}
  async deleteOAuth2ApplicationImage(_appName: string): Promise<void> {}
  async updateOAuth2Application(appName: string, patch: ApplicationPatch): Promise<void> {
    this.state = {
      ...this.state,
      apps: this.state.apps.map((app) =>
        app.name === appName
          ? {
              ...app,
              ...(patch.displayName !== undefined ? { displayName: patch.displayName } : {}),
              ...(patch.landingUrl !== undefined ? { landingUrl: patch.landingUrl } : {}),
              ...(patch.redirectUris !== undefined ? { redirectUris: patch.redirectUris } : {}),
            }
          : app,
      ),
    };
    this.persist();
  }
  async deleteOAuth2Application(appName: string): Promise<void> {
    this.state = {
      ...this.state,
      apps: this.state.apps.filter((app) => app.name !== appName),
    };
    this.persist();
  }
  async updateOAuth2ApplicationScopeMap(
    appName: string,
    groupName: string,
    scopes: string[],
  ): Promise<void> {
    this.state = {
      ...this.state,
      apps: this.state.apps.map((app) => {
        if (app.name !== appName) return app;
        const existingMaps = app.scopeMaps ?? [];
        const existingIndex = existingMaps.findIndex((sm) => sm.groupId === groupName);
        const newMap = { groupId: groupName, scopes };
        const scopeMaps =
          existingIndex >= 0
            ? existingMaps.map((sm, i) => (i === existingIndex ? newMap : sm))
            : [...existingMaps, newMap];
        const allowedGroups = [...new Set(scopeMaps.map((sm) => sm.groupId))];
        const allScopes = [...new Set(scopeMaps.flatMap((sm) => sm.scopes))];
        return {
          ...app,
          scopeMaps,
          allowedGroups,
          scopes: allScopes.length ? allScopes : ["openid", "profile"],
          status: allowedGroups.length ? "ready" : "attention",
        };
      }),
    };
    this.persist();
  }
  async deleteOAuth2ApplicationScopeMap(appName: string, groupName: string): Promise<void> {
    this.state = {
      ...this.state,
      apps: this.state.apps.map((app) => {
        if (app.name !== appName) return app;
        const scopeMaps = (app.scopeMaps ?? []).filter((sm) => sm.groupId !== groupName);
        const allowedGroups = [...new Set(scopeMaps.map((sm) => sm.groupId))];
        const allScopes = [...new Set(scopeMaps.flatMap((sm) => sm.scopes))];
        return {
          ...app,
          scopeMaps,
          allowedGroups,
          scopes: allScopes.length ? allScopes : ["openid", "profile"],
          status: allowedGroups.length ? "ready" : "attention",
        };
      }),
    };
    this.persist();
  }
  async generateRadiusPassword(id: string): Promise<string | null> {
    const pw = `rad-demo-${Math.random().toString(36).slice(2, 10)}`;
    this.radiusPasswords[id] = pw;
    this.state = {
      ...this.state,
      people: this.state.people.map((p) =>
        p.id === id ? { ...p, credential: { ...p.credential, radiusPassword: true } } : p,
      ),
    };
    this.persist();
    return pw;
  }
  async sshPublicKeys(id: string): Promise<SshPublicKey[]> {
    const p = this.state.people.find((x) => x.id === id);
    return p?.credential.sshKeys ? [{ tag: "work-laptop", key: "ssh-ed25519 AAAAC3...mock" }] : [];
  }
  async addSshPublicKey(id: string, _tag: string, _key: string): Promise<void> {
    this.state = {
      ...this.state,
      people: this.state.people.map((p) =>
        p.id === id
          ? {
              ...p,
              credential: {
                ...p.credential,
                sshKeys: p.credential.sshKeys + 1,
              },
            }
          : p,
      ),
    };
    this.persist();
  }
  async deleteSshPublicKey(id: string, _tag: string): Promise<void> {
    this.state = {
      ...this.state,
      people: this.state.people.map((p) =>
        p.id === id
          ? {
              ...p,
              credential: {
                ...p.credential,
                sshKeys: Math.max(0, p.credential.sshKeys - 1),
              },
            }
          : p,
      ),
    };
    this.persist();
  }
  async userAuthTokens(id: string): Promise<UserAuthTokenStatus[]> {
    const p = this.state.people.find((x) => x.id === id);
    if (!p) return [];
    return [
      {
        accountId: id,
        sessionId: `mock-session-${id}`,
        issuedAt: new Date().toISOString(),
        purpose: "readwrite",
        state: "neverexpires",
      },
    ];
  }
  async deleteUserAuthToken(_id: string, _sessionId: string): Promise<void> {}
  async extendUnixAccount(
    id: string,
    input: Pick<UnixAccountSettings, "gidNumber" | "shell">,
  ): Promise<void> {
    this.state = {
      ...this.state,
      people: this.state.people.map((p) =>
        p.id === id
          ? {
              ...p,
              unix: {
                ...p.unix,
                gidNumber: input.gidNumber,
                shell: input.shell,
              },
            }
          : p,
      ),
    };
    this.persist();
  }
  async setUnixCredential(id: string, _password: string): Promise<void> {
    this.state = {
      ...this.state,
      people: this.state.people.map((p) =>
        p.id === id ? { ...p, unix: { ...p.unix, credentialSet: true } } : p,
      ),
    };
    this.persist();
  }
  async deleteUnixCredential(id: string): Promise<void> {
    this.state = {
      ...this.state,
      people: this.state.people.map((p) =>
        p.id === id ? { ...p, unix: { ...p.unix, credentialSet: false } } : p,
      ),
    };
    this.persist();
  }
  async setDomainDisplayName(name: string): Promise<void> {
    this.state = {
      ...this.state,
      branding: { ...this.state.branding, companyName: name },
    };
    this.persist();
  }
  async uploadDomainImage(_file: File): Promise<void> {
    this.state = {
      ...this.state,
      branding: { ...this.state.branding, logoUrl: "/ui/images/domain" },
    };
    this.persist();
  }
  async deleteDomainImage(): Promise<void> {
    this.state = {
      ...this.state,
      branding: { ...this.state.branding, logoUrl: "" },
    };
    this.persist();
  }
  async fetchImage(_url: string): Promise<Blob> {
    return new Blob();
  }
  async credentialUpdateIntent(_id: string, _ttl: number): Promise<CredentialUpdateIntent> {
    return {
      token: `kc_demo_${Math.random().toString(36).slice(2, 14)}`,
      expiryTime: new Date(Date.now() + 3600 * 1000).toISOString(),
    };
  }
  async sendCredentialUpdateIntent(_id: string, _ttl: number, _email: string): Promise<void> {}
  async exchangeCredentialUpdateIntent(_token: string): Promise<string> {
    return `cu_demo_${_token.slice(-12)}`;
  }
  async credentialUpdateStatus(token: string): Promise<CredentialUpdateStatus> {
    const person = this.state.people[0];
    return this.mockStatus(token, person);
  }
  async credentialUpdate(sessionToken: string, _body: unknown): Promise<CredentialUpdateStatus> {
    const person = this.state.people[0];
    return this.mockStatus(sessionToken, person);
  }
  async commitCredentialUpdate(_token: string): Promise<void> {}
  async cancelCredentialUpdate(_token: string): Promise<void> {}

  private mockStatus(sessionToken: string, person: Person): CredentialUpdateStatus {
    return {
      sessionToken,
      spn: `${person?.username ?? "user"}@localhost`,
      displayName: person?.displayName ?? "User",
      canCommit: true,
      warnings: person?.credential?.totp ? [] : ["MfaRequired"],
      primaryState: "Modifiable",
      passkeysState: "Modifiable",
      attestedPasskeysState: "PolicyDeny",
      unixCredentialState: "Modifiable",
      sshKeysState: "Modifiable",
      passkeyCount: person?.credential?.passkeys ?? 0,
      attestedPasskeyCount: 0,
      passkeys: Array.from({ length: person?.credential?.passkeys ?? 0 }, (_, i) => ({
        uuid: `00000000-0000-4000-9000-${String(i + 10).padStart(12, "0")}`,
        tag: i === 0 ? "Laptop passkey" : `Passkey ${i + 1}`,
      })),
      attestedPasskeys: [],
      sshKeyCount: person?.credential?.sshKeys ?? 0,
      sshKeyLabels: Array.from({ length: person?.credential?.sshKeys ?? 0 }, (_, i) =>
        i === 0 ? "work-laptop" : `ssh-key-${i + 1}`,
      ),
      hasPrimaryCredential: (person?.credential?.password ?? "missing") !== "missing",
      hasUnixCredential: person?.unix?.credentialSet ?? false,
      totpLabels: person?.credential?.totp ? ["Authenticator"] : [],
      pendingTotp: null,
      pendingPasskey: null,
      totpIssue: null,
      totpIssueLabel: "",
      pendingBackupCodes: [],
    };
  }
}
