import fs from "node:fs";
import https from "node:https";
import path from "node:path";
import { envValue } from "./kanidm-script-env.mjs";

const baseUrl = envValue("KANIDM_URL", "https://localhost:18443");
const username = envValue("KANIDM_USERNAME", "idm_admin");
const password = envValue("KANIDM_PASSWORD");
const instanceUrl = envValue("KANIDM_INSTANCE_URL", "https://localhost:9443");
const serviceAccount = envValue("KANIDM_MAIL_SERVICE_ACCOUNT", "mail-sender");
const rejectUnauthorized = envValue("KANIDM_INSECURE_TLS") === "false";
const configPath = path.join(process.cwd(), "deploy/local/kanidm/mail-sender.local.toml");
const agent = new https.Agent({ rejectUnauthorized });

if (!password) {
  console.error("Set KANIDM_PASSWORD in .env.local before bootstrapping local Kanidm mail.");
  process.exit(2);
}

function parseJson(body, fallback = null) {
  return body ? JSON.parse(body) : fallback;
}

async function request(pathname, options = {}) {
  const url = new URL(pathname, baseUrl);
  const body = options.body === undefined ? undefined : JSON.stringify(options.body);

  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        agent,
        method: options.method ?? "GET",
        headers: {
          accept: "application/json",
          ...(body
            ? { "content-type": "application/json", "content-length": Buffer.byteLength(body) }
            : {}),
          ...options.headers,
        },
      },
      (res) => {
        let text = "";
        res.on("data", (chunk) => {
          text += chunk;
        });
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: text }));
      },
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function authStep(body, authSessionId) {
  const result = await request("/v1/auth", {
    method: "POST",
    body,
    headers: authSessionId ? { "X-KANIDM-AUTH-SESSION-ID": authSessionId } : undefined,
  });

  if (result.status !== 200) {
    throw new Error(`/v1/auth returned ${result.status}: ${result.body}`);
  }

  return {
    response: parseJson(result.body),
    authSessionId: result.headers["x-kanidm-auth-session-id"],
  };
}

async function bearerToken() {
  const init = await authStep({
    step: { init2: { username, issue: "token", privileged: true } },
  });
  const begin = await authStep({ step: { begin: "password" } }, init.authSessionId);
  const credential = await authStep(
    { step: { cred: { password } } },
    begin.authSessionId ?? init.authSessionId,
  );
  const token = credential.response.state?.success;
  if (!token) throw new Error("Kanidm did not issue a bearer token.");
  return token;
}

async function kanidm(pathname, token, options = {}) {
  return request(pathname, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
}

async function createServiceAccountIfNeeded(token) {
  const existing = await kanidm(`/v1/service_account/${serviceAccount}`, token);
  if (existing.status === 200 && parseJson(existing.body, null) !== null) return;
  if (existing.status !== 404) {
    const missingWithNullBody = existing.status === 200 && parseJson(existing.body, null) === null;
    if (!missingWithNullBody) {
      throw new Error(`service account lookup returned ${existing.status}: ${existing.body}`);
    }
  }

  const created = await kanidm("/v1/service_account", token, {
    method: "POST",
    body: {
      attrs: {
        name: [serviceAccount],
        displayname: ["Mail Sender"],
        entry_managed_by: ["idm_admins"],
      },
    },
  });

  if (![200, 201, 204].includes(created.status)) {
    throw new Error(`service account create returned ${created.status}: ${created.body}`);
  }
}

async function addMessageSenderMembership(token) {
  const result = await kanidm("/v1/group/idm_message_senders/_attr/member", token, {
    method: "POST",
    body: [serviceAccount],
  });

  if (![200, 201, 204, 400, 409].includes(result.status)) {
    throw new Error(`idm_message_senders add-member returned ${result.status}: ${result.body}`);
  }
}

async function enableAccountRecovery(token) {
  const result = await kanidm("/v1/domain/_attr/domain_allow_account_recovery", token, {
    method: "PUT",
    body: ["true"],
  });

  if (result.status === 404 && result.body.includes("nomatchingentries")) {
    return false;
  }

  if (![200, 201, 204].includes(result.status)) {
    throw new Error(`domain allow account recovery returned ${result.status}: ${result.body}`);
  }
  return true;
}

async function generateMailSenderToken(token) {
  const label = `mail sender token ${new Date().toISOString()}`;
  const result = await kanidm(`/v1/service_account/${serviceAccount}/_api_token`, token, {
    method: "POST",
    body: {
      label,
      expiry: null,
      read_write: true,
      compact: false,
    },
  });

  if (result.status !== 200) {
    throw new Error(`service account api token generate returned ${result.status}: ${result.body}`);
  }

  const apiToken = parseJson(result.body);
  if (typeof apiToken !== "string" || !apiToken.trim()) {
    throw new Error(`service account api token response was not a token string: ${result.body}`);
  }
  return apiToken;
}

function writeConfig(apiToken) {
  const config = `token = ${JSON.stringify(apiToken)}
schedule = "*/5 * * * * * *"

instance_display_name = "Kanidm Local"
instance_url = ${JSON.stringify(instanceUrl)}

mail_from_address = "kanidm@example.test"
mail_reply_to_address = "support@example.test"
mail_relay = "mailpit"
mail_username = "kanidm-local"
mail_password = "kanidm-local"
mail_connect_timeout_seconds = 5
`;

  fs.writeFileSync(configPath, config, { mode: 0o600 });
}

try {
  const token = await bearerToken();
  await createServiceAccountIfNeeded(token);
  await addMessageSenderMembership(token);
  const accountRecoveryEnabled = await enableAccountRecovery(token);
  const apiToken = await generateMailSenderToken(token);
  writeConfig(apiToken);

  console.log(
    JSON.stringify(
      {
        ok: true,
        baseUrl,
        serviceAccount,
        accountRecoveryEnabled,
        configPath,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        baseUrl,
        serviceAccount,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exit(1);
}
