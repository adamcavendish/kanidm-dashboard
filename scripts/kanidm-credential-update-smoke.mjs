import https from "node:https";
import { envValue } from "./kanidm-script-env.mjs";

const baseUrl = envValue("KANIDM_URL", "https://localhost:18443");
const username = envValue("KANIDM_USERNAME", "idm_admin");
const password = envValue("KANIDM_PASSWORD");
const rejectUnauthorized = envValue("KANIDM_INSECURE_TLS") === "false";
const agent = new https.Agent({ rejectUnauthorized });
const personName = `cred_update_probe_${Date.now().toString().slice(-8)}`;
const sshLabel = `probe-${Date.now().toString().slice(-6)}`;
const sshPublicKey =
  "sk-ecdsa-sha2-nistp256@openssh.com AAAAInNrLWVjZHNhLXNoYTItbmlzdHAyNTZAb3BlbnNzaC5jb20AAAAIbmlzdHAyNTYAAABBBENubZikrb8hu+HeVRdZ0pp/VAk2qv4JDbuJhvD0yNdWDL2e3cBbERiDeNPkWx58Q4rVnxkbV1fa8E2waRtT91wAAAAEc3NoOg== testuser@fidokey";

if (!password) {
  console.error(
    "Set KANIDM_PASSWORD in the environment or .env.local to run the credential update smoke test.",
  );
  process.exit(2);
}

async function request(path, options = {}) {
  const url = new URL(path, baseUrl);
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
    response: JSON.parse(result.body),
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

function parseJson(body, fallback = null) {
  return body ? JSON.parse(body) : fallback;
}

const token = await bearerToken();

const created = await request("/v1/person", {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
  body: {
    attrs: {
      name: [personName],
      displayname: ["Credential Update Probe"],
      mail: [`${personName}@example.test`],
    },
  },
});
if (![200, 201, 204].includes(created.status)) {
  throw new Error(`person create returned ${created.status}: ${created.body}`);
}

const intent = await request(`/v1/person/${personName}/_credential/_update_intent/3600`, {
  headers: { Authorization: `Bearer ${token}` },
});
if (intent.status !== 200) {
  throw new Error(`credential intent returned ${intent.status}: ${intent.body}`);
}

const exchanged = await request("/v1/credential/_exchange_intent", {
  method: "POST",
  body: parseJson(intent.body).token,
});
if (exchanged.status !== 200) {
  throw new Error(`credential exchange returned ${exchanged.status}: ${exchanged.body}`);
}

const exchangeBody = parseJson(exchanged.body);
if (!Array.isArray(exchangeBody) || !exchangeBody[0]?.token || !exchangeBody[1]?.displayname) {
  throw new Error(`credential exchange did not return [session, status]: ${exchanged.body}`);
}

const sessionToken = exchangeBody[0].token;
const initialStatus = exchangeBody[1];
const statusCheck = await request("/v1/credential/_status", {
  method: "POST",
  body: { token: sessionToken },
});
if (statusCheck.status !== 200) {
  throw new Error(`credential status returned ${statusCheck.status}: ${statusCheck.body}`);
}

const sshAdd = await request("/v1/credential/_update", {
  method: "POST",
  body: [{ sshpublickey: [sshLabel, sshPublicKey] }, { token: sessionToken }],
});

let sshPublicKeyRequest = "accepted";
if (sshAdd.status === 200) {
  const nextStatus = parseJson(sshAdd.body);
  if (!Object.prototype.hasOwnProperty.call(nextStatus.sshkeys ?? {}, sshLabel)) {
    throw new Error(`SSH key add returned 200 but did not include ${sshLabel}: ${sshAdd.body}`);
  }
} else if (sshAdd.status === 403 && initialStatus.sshkeys_state === "AccessDeny") {
  sshPublicKeyRequest = "deserialized-but-access-denied";
} else {
  throw new Error(`SSH key add returned ${sshAdd.status}: ${sshAdd.body}`);
}

await request("/v1/credential/_cancel", {
  method: "POST",
  body: { token: sessionToken },
}).catch(() => {});

console.log(
  JSON.stringify(
    {
      ok: true,
      baseUrl,
      personName,
      exchangeVerified: true,
      sshKeysState: initialStatus.sshkeys_state,
      sshPublicKeyRequest,
    },
    null,
    2,
  ),
);
