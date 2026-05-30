import https from "node:https";
import { envValue } from "./kanidm-script-env.mjs";

const baseUrl = envValue("KANIDM_URL", "https://localhost:18443");
const username = envValue("KANIDM_USERNAME", "idm_admin");
const password = envValue("KANIDM_PASSWORD");

if (!password) {
  console.error("Set KANIDM_PASSWORD in the environment or .env.local to run the auth smoke test.");
  process.exit(2);
}

const rejectUnauthorized = envValue("KANIDM_INSECURE_TLS") === "false";
const agent = new https.Agent({ rejectUnauthorized });

async function request(path, options = {}) {
  const url = new URL(path, baseUrl);
  const body = options.body ? JSON.stringify(options.body) : undefined;

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
        res.on("end", () => {
          resolve({ status: res.statusCode, headers: res.headers, body: text });
        });
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

const init = await authStep({
  step: { init2: { username, issue: "token", privileged: true } },
});

if (!init.authSessionId) {
  throw new Error("Kanidm did not return X-KANIDM-AUTH-SESSION-ID after init.");
}

const begin = await authStep({ step: { begin: "password" } }, init.authSessionId);
const credential = await authStep(
  { step: { cred: { password } } },
  begin.authSessionId ?? init.authSessionId,
);
const token = credential.response.state?.success;

if (!token) {
  throw new Error(
    `Kanidm did not issue a bearer token: ${JSON.stringify(credential.response.state)}`,
  );
}

for (const path of ["/v1/self", "/v1/group", "/v1/person", "/v1/oauth2", "/v1/domain"]) {
  const result = await request(path, { headers: { Authorization: `Bearer ${token}` } });
  console.log(`${path} -> ${result.status}`);
  if (![200, 403].includes(result.status)) {
    throw new Error(`${path} returned ${result.status}: ${result.body.slice(0, 200)}`);
  }
}

console.log("Kanidm auth/API smoke test passed.");
