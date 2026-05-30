import http from "node:http";
import https from "node:https";
import { envValue } from "./kanidm-script-env.mjs";

const baseUrl = envValue("KANIDM_URL", "https://localhost:18443");
const mailpitUrl = envValue("MAILPIT_API_URL", "http://localhost:18025");
const username = envValue("KANIDM_USERNAME", "idm_admin");
const password = envValue("KANIDM_PASSWORD");
const rejectUnauthorized = envValue("KANIDM_INSECURE_TLS") === "false";
const timeoutMs = Number(envValue("KANIDM_RECOVERY_MAIL_TIMEOUT_MS", "45000"));
const agent = new https.Agent({ rejectUnauthorized });
const stamp = Date.now().toString().slice(-8);
const personName = `recovery_mail_${stamp}`;
const personEmail = `${personName}@example.test`;

if (!password) {
  console.error(
    "Set KANIDM_PASSWORD in the environment or .env.local to run the real Kanidm recovery mail E2E test.",
  );
  process.exit(2);
}

function parseJson(body, fallback = null) {
  return body ? JSON.parse(body) : fallback;
}

async function request(urlBase, path, options = {}) {
  const url = new URL(path, urlBase);
  const body = options.body === undefined ? undefined : JSON.stringify(options.body);
  const isHttps = url.protocol === "https:";
  const transport = isHttps ? https : http;

  return new Promise((resolve, reject) => {
    const req = transport.request(
      url,
      {
        agent: isHttps ? agent : undefined,
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

async function kanidm(path, options = {}) {
  return request(baseUrl, path, options);
}

async function mailpit(path, options = {}) {
  return request(mailpitUrl, path, options);
}

async function authStep(body, authSessionId) {
  const result = await kanidm("/v1/auth", {
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

function messageList(body) {
  const parsed = parseJson(body, {});
  return parsed.messages ?? parsed.Messages ?? [];
}

function messageId(message) {
  return message.ID ?? message.Id ?? message.id;
}

function messageMatchesRecipient(message, recipient) {
  const serialized = JSON.stringify(message);
  return serialized.includes(recipient);
}

async function findRecoveryMessage() {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const listed = await mailpit("/api/v1/messages");
    if (listed.status !== 200) {
      throw new Error(`Mailpit messages returned ${listed.status}: ${listed.body}`);
    }

    const messages = messageList(listed.body);
    const match = messages.find(
      (message) =>
        messageMatchesRecipient(message, personEmail) &&
        JSON.stringify(message).includes("Credential Reset Link"),
    );
    if (match) return match;

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(
    `No recovery email for ${personEmail} appeared in Mailpit within ${timeoutMs}ms.`,
  );
}

try {
  await mailpit("/api/v1/messages", { method: "DELETE" }).catch(() => {});

  const token = await bearerToken();
  const created = await kanidm("/v1/person", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: {
      attrs: {
        name: [personName],
        displayname: ["Recovery Mail Probe"],
        mail: [personEmail],
      },
    },
  });
  if (![200, 201, 204].includes(created.status)) {
    throw new Error(`person create returned ${created.status}: ${created.body}`);
  }

  const queued = await kanidm(`/v1/person/${personName}/_credential/_update_intent_send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: { ttl: 3600, email: personEmail },
  });
  if (![200, 201, 202, 204].includes(queued.status)) {
    throw new Error(`credential intent send returned ${queued.status}: ${queued.body}`);
  }

  const message = await findRecoveryMessage();
  const id = messageId(message);
  if (!id) throw new Error(`Mailpit message did not include an ID: ${JSON.stringify(message)}`);

  const detail = await mailpit(`/api/v1/message/${encodeURIComponent(id)}`);
  if (detail.status !== 200) {
    throw new Error(`Mailpit message detail returned ${detail.status}: ${detail.body}`);
  }

  const detailText = JSON.stringify(parseJson(detail.body, detail.body));
  if (!detailText.includes("/ui/reset") || !detailText.includes("token=")) {
    throw new Error(`Recovery email did not include a reset link: ${detail.body}`);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        baseUrl,
        mailpitUrl,
        personName,
        recipient: personEmail,
        emailDeliveryVerified: true,
        resetLinkVerified: true,
        messageId: id,
        subject: message.Subject ?? message.subject,
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
        mailpitUrl,
        personName,
        recipient: personEmail,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exit(1);
}
