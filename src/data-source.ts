import type {
  Application,
  ApplicationPatch,
  ApplicationPolicyInput,
  ConsoleState,
  DashboardDataSourceConfig,
  Group,
  GroupCreationResult,
  GroupPolicyAttribute,
  GroupUnixSettings,
  NewApplicationInput,
  NewGroupInput,
  NewPersonInput,
  NewServiceAccountInput,
  Person,
  PersonCertificate,
  PersonCreationResult,
  PersonStatusPatch,
  ProfileUpdateInput,
  RecycleBinEntry,
  SchemaCatalog,
  SchemaItem,
  ServiceAccount,
  ServiceAccountApiToken,
  ServiceAccountApiTokenInput,
  ServiceAccountCredentialStatus,
  ServiceAccountPatch,
  SshPublicKey,
  SystemConfigEntry,
  UnixAccountSettings,
  UserAuthTokenStatus,
  CredentialUpdateIntent,
  CredentialUpdateStatus,
} from "./domain";
import { writableSystemConfigAttrs } from "./domain";
import { mapKanidmState, oauth2PatchEntry } from "./kanidm-mappers";
import { Configuration } from "./generated/kanidm-sdk/runtime/runtime";
import { SelfApi } from "./generated/kanidm-sdk/apis/SelfApi";
import { PersonApi } from "./generated/kanidm-sdk/apis/PersonApi";
import { GroupApi } from "./generated/kanidm-sdk/apis/GroupApi";
import { Oauth2Api } from "./generated/kanidm-sdk/apis/Oauth2Api";
import { DomainApi } from "./generated/kanidm-sdk/apis/DomainApi";
import { ServiceAccountApi } from "./generated/kanidm-sdk/apis/ServiceAccountApi";
import { PersonRadiusApi } from "./generated/kanidm-sdk/apis/PersonRadiusApi";
import { PersonSshPubkeysApi } from "./generated/kanidm-sdk/apis/PersonSshPubkeysApi";
import { PersonUnixApi } from "./generated/kanidm-sdk/apis/PersonUnixApi";
import { AccountApi } from "./generated/kanidm-sdk/apis/AccountApi";
import { PersonAttrApi } from "./generated/kanidm-sdk/apis/PersonAttrApi";
import { GroupAttrApi } from "./generated/kanidm-sdk/apis/GroupAttrApi";
import { GroupUnixApi } from "./generated/kanidm-sdk/apis/GroupUnixApi";
import { RecycleBinApi } from "./generated/kanidm-sdk/apis/RecycleBinApi";
import { SystemApi } from "./generated/kanidm-sdk/apis/SystemApi";
import { PersonCredentialApi } from "./generated/kanidm-sdk/apis/PersonCredentialApi";
import { PersonCertificateApi } from "./generated/kanidm-sdk/apis/PersonCertificateApi";
import { CredentialApi } from "./generated/kanidm-sdk/apis/CredentialApi";
import type { Entry } from "./generated/kanidm-sdk/models/Entry";
import { createGroup, createOAuth2Application } from "./kanidm-composite";
import { KanidmHttpError, kanidmHttpError } from "./kanidm-error";
import {
  personCreateEntry,
  serviceAccountCreateEntry,
  serviceAccountPatchEntry,
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
  groupUnixSettings(id: string): Promise<GroupUnixSettings | null>;
  extendGroupUnix(id: string, gidNumber: number): Promise<GroupUnixSettings | null>;
  groupPolicy(id: string): Promise<GroupPolicyAttribute[]>;
  updateGroupPolicyAttribute(id: string, attr: string, values: string[]): Promise<void>;
  schemaCatalog(): Promise<SchemaCatalog>;
  recycleBinEntries(): Promise<RecycleBinEntry[]>;
  recycleBinEntry(id: string): Promise<RecycleBinEntry | null>;
  reviveRecycleBinEntry(id: string): Promise<void>;
  systemConfig(): Promise<SystemConfigEntry[]>;
  updateSystemAttribute(attr: string, values: string[]): Promise<void>;
  createServiceAccount(input: NewServiceAccountInput): Promise<ServiceAccount>;
  deleteServiceAccount(id: string): Promise<void>;
  updateServiceAccount(id: string, patch: ServiceAccountPatch): Promise<void>;
  serviceAccountApiTokens(id: string): Promise<ServiceAccountApiToken[]>;
  generateServiceAccountApiToken(id: string, input: ServiceAccountApiTokenInput): Promise<string>;
  deleteServiceAccountApiToken(id: string, tokenId: string): Promise<void>;
  serviceAccountCredentialStatus(id: string): Promise<ServiceAccountCredentialStatus>;
  generateServiceAccountPassword(id: string): Promise<ServiceAccountCredentialStatus>;
  serviceAccountSshPublicKeys(id: string): Promise<SshPublicKey[]>;
  addServiceAccountSshPublicKey(id: string, tag: string, key: string): Promise<void>;
  deleteServiceAccountSshPublicKey(id: string, tag: string): Promise<void>;
  extendServiceAccountUnixAccount(
    id: string,
    input: Pick<UnixAccountSettings, "gidNumber" | "shell">,
  ): Promise<void>;
  createOAuth2Application(input: NewApplicationInput): Promise<{ clientSecret?: string }>;
  updateOAuth2Application(appName: string, patch: ApplicationPatch): Promise<void>;
  deleteOAuth2Application(appName: string): Promise<void>;
  updateOAuth2ApplicationScopeMap(
    appName: string,
    groupName: string,
    scopes: string[],
  ): Promise<void>;
  deleteOAuth2ApplicationScopeMap(appName: string, groupName: string): Promise<void>;
  getOAuth2ApplicationClientSecret(appName: string): Promise<string | null>;
  updateOAuth2ApplicationPolicy(appName: string, input: ApplicationPolicyInput): Promise<void>;
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
    const serviceAccountApi = new ServiceAccountApi(this.config);
    const groupApi = new GroupApi(this.config);
    const oauth2Api = new Oauth2Api(this.config);
    const domainApi = new DomainApi(this.config);

    const [
      selfRes,
      people,
      serviceAccounts,
      groups,
      apps,
      appLinks,
      domainDisplayName,
      domainEntries,
    ] = await Promise.all([
      selfApi.whoami(),
      personApi.personGet(),
      serviceAccountApi.serviceAccountGet().catch((error) => serviceAccountListFallback(error)),
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
        serviceAccounts: serviceAccounts as never,
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

  async groupUnixSettings(id: string): Promise<GroupUnixSettings | null> {
    try {
      const token = await new GroupUnixApi(this.config).groupIdUnixTokenGet({ id });
      return {
        enabled: true,
        gidNumber: token.gidnumber,
        name: token.name,
        spn: token.spn,
        uuid: token.uuid,
      };
    } catch (error) {
      if (kanidmErrorStatus(error) === 404) return null;
      if (error instanceof Error && "response" in error) {
        const response = (error as { response?: Response }).response;
        const clone = response?.clone();
        const body = clone ? await clone.text().catch(() => "") : "";
        if (body.includes("missingclass") || body.includes("nomatchingentries")) return null;
      }
      throw error;
    }
  }

  async extendGroupUnix(id: string, gidNumber: number): Promise<GroupUnixSettings | null> {
    await new GroupUnixApi(this.config).groupIdUnixPost({
      id,
      body: { gidnumber: gidNumber },
    });
    return this.groupUnixSettings(id);
  }

  async groupPolicy(id: string): Promise<GroupPolicyAttribute[]> {
    const api = new GroupAttrApi(this.config);
    return Promise.all(
      groupPolicyDefinitions.map(async (definition) => {
        try {
          const values = await api.groupIdAttrGet({ id, attr: definition.attr });
          return { ...definition, values: values ?? [] };
        } catch (error) {
          const status = kanidmErrorStatus(error);
          if (status && [400, 404].includes(status)) {
            return { ...definition, values: [] };
          }
          throw error;
        }
      }),
    );
  }

  async updateGroupPolicyAttribute(id: string, attr: string, values: string[]): Promise<void> {
    const cleanValues = values.map((value) => value.trim()).filter(Boolean);
    const api = new GroupAttrApi(this.config);
    if (cleanValues.length) {
      await api.groupIdAttrPut({ id, attr, body: cleanValues });
    } else {
      await api.groupIdAttrDelete({ id, attr });
    }
  }

  async schemaCatalog(): Promise<SchemaCatalog> {
    const [attributes, classes] = await Promise.all([
      this.rawKanidmJson<Array<Entry | null>>("/v1/schema/attributetype"),
      this.rawKanidmJson<Array<Entry | null>>("/v1/schema/classtype"),
    ]);
    return {
      attributes: validEntries(attributes).map((entry, index) =>
        mapSchemaItem(entry, "attribute", index),
      ),
      classes: validEntries(classes).map((entry, index) => mapSchemaItem(entry, "class", index)),
    };
  }

  async recycleBinEntries(): Promise<RecycleBinEntry[]> {
    const entries = await this.rawKanidmJson<Entry[]>("/v1/recycle_bin", { method: "GET" });
    return entries.map(mapRecycleBinEntry);
  }

  async recycleBinEntry(id: string): Promise<RecycleBinEntry | null> {
    const entry = await new RecycleBinApi(this.config).recycleBinIdGet({ id });
    return entry ? mapRecycleBinEntry(entry) : null;
  }

  async reviveRecycleBinEntry(id: string): Promise<void> {
    await new RecycleBinApi(this.config).recycleBinReviveIdPost({ id });
  }

  async systemConfig(): Promise<SystemConfigEntry[]> {
    const entries = await new SystemApi(this.config).systemGet();
    return entries.map(mapSystemConfigEntry);
  }

  async updateSystemAttribute(attr: string, values: string[]): Promise<void> {
    if (!writableSystemConfigAttrs.includes(attr)) {
      throw new Error(`System attribute ${attr} is read-only in this dashboard.`);
    }
    const cleanValues = values.map((value) => value.trim()).filter(Boolean);
    const api = new SystemApi(this.config);
    if (cleanValues.length) {
      await api.systemAttrPut({ attr, body: cleanValues });
    } else {
      await api.systemAttrDelete({ attr });
    }
  }

  private async rawKanidmJson<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await this.config.accessToken?.();
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const response = await fetch(`${this.config.basePath}${path}`, {
      ...init,
      credentials: this.config.credentials,
      headers,
    });
    if (!response.ok) throw await kanidmHttpError(path, response);
    return (await response.json()) as T;
  }

  async createServiceAccount(input: NewServiceAccountInput): Promise<ServiceAccount> {
    const name = input.name.trim();
    await new ServiceAccountApi(this.config).serviceAccountPost({
      body: serviceAccountCreateEntry(input) as unknown as Entry,
    });
    if (input.groups.length) {
      await Promise.all(
        input.groups.map((groupName) =>
          new GroupAttrApi(this.config).groupIdAttrPost({
            id: groupName,
            attr: "member",
            body: [name],
          }),
        ),
      );
    }
    const created = (await this.load()).serviceAccounts.find(
      (serviceAccount) => serviceAccount.name === name,
    );
    if (!created) throw new Error(`Kanidm created ${name}, but it was not visible after reload.`);
    return created;
  }

  async deleteServiceAccount(id: string): Promise<void> {
    await new ServiceAccountApi(this.config).serviceAccountIdDelete({ id });
  }

  async updateServiceAccount(id: string, patch: ServiceAccountPatch): Promise<void> {
    const api = new ServiceAccountApi(this.config);
    const updates: Promise<unknown>[] = [];
    const fallbackPatch = serviceAccountPatchEntry(patch);

    if (patch.displayName !== undefined) {
      updates.push(
        api.serviceAccountIdPutAttr({
          id,
          attr: "displayname",
          body: [patch.displayName.trim()],
        }),
      );
    }
    if (patch.description !== undefined) {
      const description = patch.description.trim();
      updates.push(
        description
          ? api.serviceAccountIdPutAttr({ id, attr: "description", body: [description] })
          : deleteServiceAccountAttr(api, id, "description"),
      );
    }
    if (patch.managedBy !== undefined) {
      const managedBy = patch.managedBy.trim();
      updates.push(
        managedBy
          ? api.serviceAccountIdPutAttr({ id, attr: "entry_managed_by", body: [managedBy] })
          : deleteServiceAccountAttr(api, id, "entry_managed_by"),
      );
    }
    if (!updates.length && Object.keys(fallbackPatch.attrs ?? {}).length) {
      updates.push(api.serviceAccountIdPatch({ id, body: fallbackPatch as unknown as Entry }));
    }
    await Promise.all(updates);
  }

  async serviceAccountApiTokens(id: string): Promise<ServiceAccountApiToken[]> {
    const tokens = await new ServiceAccountApi(this.config).serviceAccountApiTokenGet({ id });
    return tokens.map((token) => ({
      accountId: token.accountId,
      tokenId: token.tokenId,
      label: token.label,
      issuedAt: token.issuedAt,
      expiry: token.expiry,
      purpose: token.purpose ?? "unknown",
    }));
  }

  async generateServiceAccountApiToken(
    id: string,
    input: ServiceAccountApiTokenInput,
  ): Promise<string> {
    const expiry = input.expiry?.trim() || null;
    return new ServiceAccountApi(this.config).serviceAccountApiTokenPost({
      id,
      body: {
        label: input.label.trim(),
        // Kanidm 1.10.3 requires a present expiry field even when it is empty.
        expiry: expiry as string | undefined,
        readWrite: input.readWrite,
        compact: input.compact,
      },
    });
  }

  async deleteServiceAccountApiToken(id: string, tokenId: string): Promise<void> {
    await new ServiceAccountApi(this.config).serviceAccountApiTokenDelete({ id, tokenId });
  }

  async serviceAccountCredentialStatus(id: string): Promise<ServiceAccountCredentialStatus> {
    await new ServiceAccountApi(this.config).serviceAccountIdCredentialStatusGet({ id });
    return { checkedAt: new Date().toISOString(), reachable: true };
  }

  async generateServiceAccountPassword(id: string): Promise<ServiceAccountCredentialStatus> {
    await new ServiceAccountApi(this.config).serviceAccountCredentialGenerate({ id });
    const generatedAt = new Date().toISOString();
    return { checkedAt: generatedAt, generatedAt, reachable: true };
  }

  async serviceAccountSshPublicKeys(id: string): Promise<SshPublicKey[]> {
    const api = new ServiceAccountApi(this.config);
    const keys = await serviceAccountSshKeysFromAttrs(api, id);
    if (keys.length) return keys;

    const values = (await api.serviceAccountIdSshPubkeysGet({ id })) as string[];
    return Promise.all(
      values.map(async (value, index) => {
        if (looksLikeSshPublicKey(value)) {
          return { tag: `key-${index + 1}`, key: value };
        }
        return {
          tag: value,
          key: (await api.serviceAccountIdSshPubkeysTagGet({
            id,
            tag: value,
          })) as unknown as string,
        };
      }),
    );
  }

  async addServiceAccountSshPublicKey(id: string, tag: string, key: string): Promise<void> {
    await new ServiceAccountApi(this.config).serviceAccountIdSshPubkeysPost({
      id,
      body: [tag.trim(), key.trim()],
    });
  }

  async deleteServiceAccountSshPublicKey(id: string, tag: string): Promise<void> {
    await new ServiceAccountApi(this.config).serviceAccountIdSshPubkeysTagDelete({ id, tag });
  }

  async extendServiceAccountUnixAccount(
    id: string,
    input: Pick<UnixAccountSettings, "gidNumber" | "shell">,
  ): Promise<void> {
    await new ServiceAccountApi(this.config).serviceAccountIdUnixPost({
      id,
      body: {
        gidnumber: input.gidNumber ?? undefined,
        shell: input.shell.trim() || undefined,
      },
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

  async getOAuth2ApplicationClientSecret(appName: string): Promise<string | null> {
    return new Oauth2Api(this.config).oauth2IdGetBasicSecret({ rsName: appName });
  }

  async updateOAuth2ApplicationPolicy(
    appName: string,
    input: ApplicationPolicyInput,
  ): Promise<void> {
    const api = new Oauth2Api(this.config);
    const entry = await api.oauth2IdGet({ rsName: appName });
    const attrs = entry?.attrs ?? {};

    await syncOAuth2ScopeMaps(
      mapGroupsFromAttrs(attrs.oauth2_rs_scope_map ?? []),
      input.scopeMaps,
      (group) => api.oauth2IdScopemapDelete({ rsName: appName, group }),
      (group, scopes) => api.oauth2IdScopemapPost({ rsName: appName, group, body: scopes }),
    );

    await syncOAuth2ScopeMaps(
      mapGroupsFromAttrs(attrs.oauth2_rs_sup_scope_map ?? []),
      input.supplementalScopeMaps,
      (group) => api.oauth2IdSupScopemapDelete({ rsName: appName, group }),
      (group, scopes) => api.oauth2IdSupScopemapPost({ rsName: appName, group, body: scopes }),
    );

    const existingClaimRules = claimRulesFromAttrs(attrs.oauth2_rs_claim_map ?? []);
    const nextClaimRules = input.claimMaps.flatMap((claimMap) =>
      claimMap.rules.map((rule) => ({
        claimName: claimMap.claimName.trim(),
        group: normalizeKanidmRef(rule.groupId),
        values: rule.values.map((value) => value.trim()).filter(Boolean),
      })),
    );
    const nextClaimKeys = new Set(
      nextClaimRules.map((rule) => claimRuleKey(rule.claimName, rule.group)),
    );
    await Promise.all(
      existingClaimRules
        .filter((rule) => !nextClaimKeys.has(claimRuleKey(rule.claimName, rule.group)))
        .map((rule) =>
          api.oauth2IdClaimmapDelete({
            rsName: appName,
            claimName: rule.claimName,
            group: rule.group,
          }),
        ),
    );
    for (const claimMap of input.claimMaps) {
      const claimName = claimMap.claimName.trim();
      if (!claimName) continue;
      await api.oauth2IdClaimmapJoinPost({
        rsName: appName,
        claimName,
        body: claimMap.join,
      });
      for (const rule of claimMap.rules) {
        const group = normalizeKanidmRef(rule.groupId);
        const values = rule.values.map((value) => value.trim()).filter(Boolean);
        if (!group || !values.length) continue;
        await api.oauth2IdClaimmapPost({
          rsName: appName,
          claimName,
          group,
          body: values,
        });
      }
    }
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

function updateServiceAccountTokenCount(
  state: ConsoleState,
  serviceAccountId: string,
  count: number,
): ConsoleState {
  return {
    ...state,
    serviceAccounts: state.serviceAccounts.map((serviceAccount) =>
      serviceAccount.id === serviceAccountId
        ? {
            ...serviceAccount,
            credential: { ...serviceAccount.credential, apiTokens: count },
            status: count > 0 ? "ready" : serviceAccount.status,
          }
        : serviceAccount,
    ),
  };
}

function updateServiceAccountSshKeyCount(
  state: ConsoleState,
  serviceAccountId: string,
  count: number,
): ConsoleState {
  return {
    ...state,
    serviceAccounts: state.serviceAccounts.map((serviceAccount) =>
      serviceAccount.id === serviceAccountId
        ? {
            ...serviceAccount,
            credential: { ...serviceAccount.credential, sshKeys: count },
            status: count > 0 ? "ready" : serviceAccount.status,
          }
        : serviceAccount,
    ),
  };
}

function updateServiceAccountUnixAccount(
  state: ConsoleState,
  serviceAccountId: string,
  unix: UnixAccountSettings,
): ConsoleState {
  return {
    ...state,
    serviceAccounts: state.serviceAccounts.map((serviceAccount) =>
      serviceAccount.id === serviceAccountId
        ? {
            ...serviceAccount,
            unix,
            credential: {
              ...serviceAccount.credential,
              unixCredential:
                unix.credentialSet || unix.gidNumber !== null || unix.shell.trim().length > 0,
            },
            status: "ready",
          }
        : serviceAccount,
    ),
  };
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

const groupPolicyDefinitions: Array<Omit<GroupPolicyAttribute, "values">> = [
  {
    attr: "authsession_expiry",
    label: "Auth session expiry",
    help: "Maximum ordinary authentication session lifetime.",
  },
  {
    attr: "auth_password_minimum_length",
    label: "Password minimum length",
    help: "Minimum primary password length for accounts governed by this group.",
  },
  {
    attr: "credential_type_minimum",
    label: "Credential type minimum",
    help: "Minimum accepted credential type, such as mfa or passkey policy levels.",
  },
  {
    attr: "privilege_expiry",
    label: "Privilege expiry",
    help: "Maximum privileged session lifetime.",
  },
  {
    attr: "webauthn_attestation_ca_list",
    label: "WebAuthn attestation CA list",
    help: "Trusted attestation CA list used by WebAuthn policy.",
  },
  {
    attr: "allow_primary_cred_fallback",
    label: "Primary credential fallback",
    help: "Whether primary credential fallback is allowed by policy.",
  },
  {
    attr: "limit_search_max_results",
    label: "Search result limit",
    help: "Maximum number of search results returned for governed accounts.",
  },
  {
    attr: "limit_search_max_filter_test",
    label: "Search filter test limit",
    help: "Maximum search filter tests for governed accounts.",
  },
];

function mapSchemaItem(entry: Entry, kind: SchemaItem["kind"], index: number): SchemaItem {
  const attrs = mutableAttrs(entry.attrs);
  const name =
    firstAttr(attrs, "name") ||
    firstAttr(attrs, kind === "class" ? "classname" : "attributename") ||
    firstAttr(attrs, "attributename") ||
    firstAttr(attrs, "classname") ||
    `${kind}-${index}`;
  return {
    id: firstAttr(attrs, "uuid") || `${kind}-${name}`,
    name,
    displayName: firstAttr(attrs, "displayname") || name,
    description: firstAttr(attrs, "description") || "No description returned.",
    kind,
    attrs,
  };
}

function validEntries(entries: Array<Entry | null | undefined>) {
  return entries.filter((entry): entry is Entry => Boolean(entry?.attrs));
}

function mapRecycleBinEntry(entry: Entry): RecycleBinEntry {
  const attrs = mutableAttrs(entry.attrs);
  const name = firstAttr(attrs, "name") || firstAttr(attrs, "spn") || firstAttr(attrs, "uuid");
  return {
    id: firstAttr(attrs, "uuid") || name || "recycled-entry",
    name: name || "recycled-entry",
    displayName: firstAttr(attrs, "displayname") || name || "Recycled entry",
    description: firstAttr(attrs, "description") || "",
    classes: attrs.class ?? [],
    attrs,
  };
}

function mapSystemConfigEntry(entry: Entry): SystemConfigEntry {
  const attrs = mutableAttrs(entry.attrs);
  return {
    id: firstAttr(attrs, "uuid") || "system-config",
    displayName: firstAttr(attrs, "displayname") || "System config",
    description: firstAttr(attrs, "description") || "System configuration.",
    attrs,
  };
}

function mutableAttrs(attrs?: Record<string, readonly string[]> | null): Record<string, string[]> {
  return Object.fromEntries(Object.entries(attrs ?? {}).map(([key, values]) => [key, [...values]]));
}

function firstAttr(attrs: Record<string, string[]>, attr: string) {
  return attrs[attr]?.[0] ?? "";
}

async function deletePersonAttr(api: PersonAttrApi, id: string, attr: string) {
  try {
    await api.personIdDeleteAttr({ id, attr });
  } catch (error) {
    if (kanidmErrorStatus(error) === 404) return;
    throw error;
  }
}

function serviceAccountListFallback(error: unknown): Entry[] {
  const status = kanidmErrorStatus(error);
  if (status && [400, 401, 403, 404, 405].includes(status)) return [];
  throw error;
}

function serviceAccountSshKeysFromEntry(entry: Entry | null): SshPublicKey[] {
  return (entry?.attrs.ssh_publickey ?? []).map((value, index) => {
    const separator = value.indexOf(": ");
    if (separator <= 0) {
      return { tag: `key-${index + 1}`, key: value };
    }
    return {
      tag: value.slice(0, separator),
      key: value.slice(separator + 2),
    };
  });
}

async function serviceAccountSshKeysFromAttrs(
  api: ServiceAccountApi,
  id: string,
): Promise<SshPublicKey[]> {
  try {
    return serviceAccountSshKeysFromEntry(await api.serviceAccountIdGet({ id }));
  } catch (error) {
    if ([400, 401, 403, 404, 405].includes(kanidmErrorStatus(error) ?? 0)) return [];
    throw error;
  }
}

function looksLikeSshPublicKey(value: string) {
  return /^(?:sk-)?(?:ssh|ecdsa)-[a-z0-9@._-]+\s+/i.test(value);
}

async function deleteServiceAccountAttr(api: ServiceAccountApi, id: string, attr: string) {
  try {
    await api.serviceAccountIdDeleteAttr({ id, attr });
  } catch (error) {
    if (kanidmErrorStatus(error) === 404) return;
    throw error;
  }
}

function mapGroupsFromAttrs(values: readonly string[]) {
  return new Set(values.map((value) => normalizeKanidmRef(value.split(/:(.*)/s)[0] ?? "")));
}

async function syncOAuth2ScopeMaps(
  existingGroups: Set<string>,
  nextMaps: Array<{ groupId: string; scopes: string[] }>,
  deleteMap: (group: string) => Promise<void>,
  upsertMap: (group: string, scopes: string[]) => Promise<void>,
) {
  const next = nextMaps
    .map((scopeMap) => ({
      group: normalizeKanidmRef(scopeMap.groupId),
      scopes: scopeMap.scopes.map((scope) => scope.trim()).filter(Boolean),
    }))
    .filter((scopeMap) => scopeMap.group && scopeMap.scopes.length);
  const nextGroups = new Set(next.map((scopeMap) => scopeMap.group));
  await Promise.all(
    [...existingGroups].filter((group) => !nextGroups.has(group)).map((group) => deleteMap(group)),
  );
  for (const scopeMap of next) {
    await upsertMap(scopeMap.group, scopeMap.scopes);
  }
}

function claimRulesFromAttrs(values: readonly string[]) {
  return values
    .map((value) => {
      const match = value.match(/^([^:]+):([^:]+):/);
      if (!match) return null;
      return {
        claimName: match[1] ?? "",
        group: normalizeKanidmRef(match[2] ?? ""),
      };
    })
    .filter((value): value is { claimName: string; group: string } =>
      Boolean(value?.claimName && value.group),
    );
}

function claimRuleKey(claimName: string, group: string) {
  return `${claimName}\u0000${group}`;
}

function normalizeKanidmRef(value: string) {
  return value.trim().replace(/@[^:@\s]+$/, "");
}

function normalizedPolicyScopeMaps(scopeMaps: Array<{ groupId: string; scopes: string[] }>) {
  return scopeMaps
    .map((scopeMap) => ({
      groupId: scopeMap.groupId.trim(),
      scopes: [...new Set(scopeMap.scopes.map((scope) => scope.trim()).filter(Boolean))],
    }))
    .filter((scopeMap) => scopeMap.groupId && scopeMap.scopes.length);
}

import { initialState, seedPeople } from "./seed";

export class MockDataSource implements DashboardDataSource {
  private state: ConsoleState;
  private radiusPasswords: Record<string, string> = {};
  private certificates: Record<string, PersonCertificate[]> = {};
  private serviceAccountTokens: Record<string, ServiceAccountApiToken[]> = {};
  private serviceAccountSshKeys: Record<string, SshPublicKey[]> = {};
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

  private tokensForServiceAccount(id: string): ServiceAccountApiToken[] {
    if (this.serviceAccountTokens[id]) return this.serviceAccountTokens[id];
    const serviceAccount = this.state.serviceAccounts.find((candidate) => candidate.id === id);
    const tokens = Array.from(
      { length: serviceAccount?.credential.apiTokens ?? 0 },
      (_, index) => ({
        accountId: id,
        tokenId: `00000000-0000-4000-a100-${String(index + 1).padStart(12, "0")}`,
        label: index === 0 ? "deployment token" : `automation token ${index + 1}`,
        issuedAt: new Date(Date.now() - (index + 1) * 86_400_000).toISOString(),
        expiry: index === 0 ? undefined : new Date(Date.now() + 30 * 86_400_000).toISOString(),
        purpose: index === 0 ? ("readwrite" as const) : ("readonly" as const),
      }),
    );
    this.serviceAccountTokens[id] = tokens;
    return tokens;
  }

  private sshKeysForServiceAccount(id: string): SshPublicKey[] {
    if (this.serviceAccountSshKeys[id]) return this.serviceAccountSshKeys[id];
    const serviceAccount = this.state.serviceAccounts.find((candidate) => candidate.id === id);
    const keys = Array.from({ length: serviceAccount?.credential.sshKeys ?? 0 }, (_, index) => {
      const tag = index === 0 ? "deploy-host" : `service-key-${index + 1}`;
      return {
        tag,
        key: `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI${serviceAccount?.name ?? "svc"}${index}DemoPublicKey ${tag}`,
      };
    });
    this.serviceAccountSshKeys[id] = keys;
    return keys;
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
  async groupUnixSettings(id: string): Promise<GroupUnixSettings | null> {
    const group = this.state.groups.find(
      (candidate) => candidate.id === id || candidate.name === id,
    );
    if (!group || !group.name.includes("unix")) return null;
    return {
      enabled: true,
      gidNumber: 2400,
      name: group.name,
      spn: `${group.name}@localhost`,
      uuid: group.id,
    };
  }
  async extendGroupUnix(id: string, gidNumber: number): Promise<GroupUnixSettings | null> {
    const group = this.state.groups.find(
      (candidate) => candidate.id === id || candidate.name === id,
    );
    if (!group) return null;
    return {
      enabled: true,
      gidNumber,
      name: group.name,
      spn: `${group.name}@localhost`,
      uuid: group.id,
    };
  }
  async groupPolicy(_id: string): Promise<GroupPolicyAttribute[]> {
    return groupPolicyDefinitions.map((definition, index) => ({
      ...definition,
      values: index < 3 ? [`mock-${definition.attr}`] : [],
    }));
  }
  async updateGroupPolicyAttribute(_id: string, _attr: string, _values: string[]): Promise<void> {
    return undefined;
  }
  async schemaCatalog(): Promise<SchemaCatalog> {
    return {
      attributes: [
        {
          id: "schema-attr-name",
          name: "name",
          displayName: "name",
          description: "Unique identity name.",
          kind: "attribute",
          attrs: { name: ["name"], description: ["Unique identity name."] },
        },
      ],
      classes: [
        {
          id: "schema-class-group",
          name: "group",
          displayName: "group",
          description: "Kanidm group object class.",
          kind: "class",
          attrs: { name: ["group"], description: ["Kanidm group object class."] },
        },
      ],
    };
  }
  async recycleBinEntries(): Promise<RecycleBinEntry[]> {
    return [
      {
        id: "recycled-demo",
        name: "deleted-demo",
        displayName: "Deleted demo entry",
        description: "Mock recycled entry.",
        classes: ["object", "recycled"],
        attrs: { name: ["deleted-demo"], class: ["object", "recycled"] },
      },
    ];
  }
  async recycleBinEntry(id: string): Promise<RecycleBinEntry | null> {
    return (await this.recycleBinEntries()).find((entry) => entry.id === id) ?? null;
  }
  async reviveRecycleBinEntry(_id: string): Promise<void> {
    return undefined;
  }
  async systemConfig(): Promise<SystemConfigEntry[]> {
    return [
      {
        id: "mock-system",
        displayName: "System config",
        description: "Mock system configuration.",
        attrs: {
          description: ["Mock system configuration."],
          badlist_password: ["password", "qwerty"],
        },
      },
    ];
  }
  async updateSystemAttribute(_attr: string, _values: string[]): Promise<void> {
    if (!writableSystemConfigAttrs.includes(_attr)) {
      throw new Error(`System attribute ${_attr} is read-only in this dashboard.`);
    }
    return undefined;
  }
  async createServiceAccount(input: NewServiceAccountInput): Promise<ServiceAccount> {
    const serviceAccount: ServiceAccount = {
      id: `mock-${input.name.trim()}`,
      name: input.name.trim(),
      displayName: input.displayName.trim(),
      description: input.description.trim(),
      managedBy: input.managedBy,
      groups: input.groups,
      credential: {
        password: "unknown",
        apiTokens: 0,
        sshKeys: 0,
        unixCredential: false,
      },
      unix: { gidNumber: null, shell: "", credentialSet: false },
      status: input.groups.length ? "ready" : "attention",
    };
    this.state = {
      ...this.state,
      serviceAccounts: [...this.state.serviceAccounts, serviceAccount],
      groups: this.state.groups.map((g) =>
        input.groups.includes(g.id)
          ? { ...g, members: [...new Set([...g.members, serviceAccount.id])] }
          : g,
      ),
    };
    this.persist();
    return serviceAccount;
  }
  async deleteServiceAccount(id: string): Promise<void> {
    this.state = {
      ...this.state,
      serviceAccounts: this.state.serviceAccounts.filter(
        (serviceAccount) => serviceAccount.id !== id,
      ),
      groups: this.state.groups.map((group) => ({
        ...group,
        members: group.members.filter((memberId) => memberId !== id),
      })),
    };
    delete this.serviceAccountTokens[id];
    delete this.serviceAccountSshKeys[id];
    this.persist();
  }
  async updateServiceAccount(id: string, patch: ServiceAccountPatch): Promise<void> {
    this.state = {
      ...this.state,
      serviceAccounts: this.state.serviceAccounts.map((serviceAccount) =>
        serviceAccount.id === id
          ? {
              ...serviceAccount,
              ...(patch.displayName !== undefined ? { displayName: patch.displayName.trim() } : {}),
              ...(patch.description !== undefined ? { description: patch.description.trim() } : {}),
              ...(patch.managedBy !== undefined ? { managedBy: patch.managedBy } : {}),
            }
          : serviceAccount,
      ),
    };
    this.persist();
  }
  async serviceAccountApiTokens(id: string): Promise<ServiceAccountApiToken[]> {
    return this.tokensForServiceAccount(id);
  }
  async generateServiceAccountApiToken(
    id: string,
    input: ServiceAccountApiTokenInput,
  ): Promise<string> {
    const token: ServiceAccountApiToken = {
      accountId: id,
      tokenId: `00000000-0000-4000-a000-${Math.random().toString().slice(2, 14).padEnd(12, "0")}`,
      label: input.label.trim(),
      issuedAt: new Date().toISOString(),
      expiry: input.expiry?.trim() || undefined,
      purpose: input.readWrite ? "readwrite" : "readonly",
    };
    this.serviceAccountTokens[id] = [...this.tokensForServiceAccount(id), token];
    this.state = updateServiceAccountTokenCount(
      this.state,
      id,
      this.serviceAccountTokens[id].length,
    );
    this.persist();
    return `svctok_${Math.random().toString(36).slice(2, 20)}`;
  }
  async deleteServiceAccountApiToken(id: string, tokenId: string): Promise<void> {
    this.serviceAccountTokens[id] = this.tokensForServiceAccount(id).filter(
      (token) => token.tokenId !== tokenId,
    );
    this.state = updateServiceAccountTokenCount(
      this.state,
      id,
      this.serviceAccountTokens[id].length,
    );
    this.persist();
  }
  async serviceAccountCredentialStatus(id: string): Promise<ServiceAccountCredentialStatus> {
    return {
      checkedAt: new Date().toISOString(),
      reachable: this.state.serviceAccounts.some((serviceAccount) => serviceAccount.id === id),
    };
  }
  async generateServiceAccountPassword(id: string): Promise<ServiceAccountCredentialStatus> {
    const generatedAt = new Date().toISOString();
    this.state = {
      ...this.state,
      serviceAccounts: this.state.serviceAccounts.map((serviceAccount) =>
        serviceAccount.id === id
          ? {
              ...serviceAccount,
              credential: { ...serviceAccount.credential, password: "present" },
              status: "ready",
            }
          : serviceAccount,
      ),
    };
    this.persist();
    return { checkedAt: generatedAt, generatedAt, reachable: true };
  }
  async serviceAccountSshPublicKeys(id: string): Promise<SshPublicKey[]> {
    return this.sshKeysForServiceAccount(id);
  }
  async addServiceAccountSshPublicKey(id: string, tag: string, key: string): Promise<void> {
    const nextKey = { tag: tag.trim(), key: key.trim() };
    this.serviceAccountSshKeys[id] = [
      ...this.sshKeysForServiceAccount(id).filter((item) => item.tag !== nextKey.tag),
      nextKey,
    ];
    this.state = updateServiceAccountSshKeyCount(
      this.state,
      id,
      this.serviceAccountSshKeys[id].length,
    );
    this.persist();
  }
  async deleteServiceAccountSshPublicKey(id: string, tag: string): Promise<void> {
    this.serviceAccountSshKeys[id] = this.sshKeysForServiceAccount(id).filter(
      (item) => item.tag !== tag,
    );
    this.state = updateServiceAccountSshKeyCount(
      this.state,
      id,
      this.serviceAccountSshKeys[id].length,
    );
    this.persist();
  }
  async extendServiceAccountUnixAccount(
    id: string,
    input: Pick<UnixAccountSettings, "gidNumber" | "shell">,
  ): Promise<void> {
    const unix: UnixAccountSettings = {
      gidNumber: input.gidNumber,
      shell: input.shell.trim(),
      credentialSet: Boolean(input.gidNumber !== null || input.shell.trim()),
    };
    this.state = updateServiceAccountUnixAccount(this.state, id, unix);
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
  async getOAuth2ApplicationClientSecret(appName: string): Promise<string | null> {
    const app = this.state.apps.find((candidate) => candidate.name === appName);
    return app?.clientType === "confidential" ? `mock-secret-${appName}` : null;
  }
  async updateOAuth2ApplicationPolicy(
    appName: string,
    input: ApplicationPolicyInput,
  ): Promise<void> {
    this.state = {
      ...this.state,
      apps: this.state.apps.map((app) => {
        if (app.name !== appName) return app;
        const scopeMaps = normalizedPolicyScopeMaps(input.scopeMaps);
        const supplementalScopeMaps = normalizedPolicyScopeMaps(input.supplementalScopeMaps);
        const scopes = [
          ...new Set([
            ...scopeMaps.flatMap((scopeMap) => scopeMap.scopes),
            ...supplementalScopeMaps.flatMap((scopeMap) => scopeMap.scopes),
          ]),
        ];
        return {
          ...app,
          scopeMaps,
          supplementalScopeMaps,
          claimMaps: input.claimMaps,
          allowedGroups: [...new Set(scopeMaps.map((scopeMap) => scopeMap.groupId))],
          scopes: scopes.length ? scopes : ["openid", "profile"],
          status: scopeMaps.length ? "ready" : "attention",
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
