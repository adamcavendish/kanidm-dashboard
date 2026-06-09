import { defineConfig } from "vite-plus";
import solid from "vite-plugin-solid";
import { loadEnv } from "vite-plus";

const mode = process.env.KANIDM_ENV_MODE ?? process.env.NODE_ENV ?? "development";
const loadedEnv = loadEnv(mode, process.cwd(), "");
const kanidmTarget =
  process.env.KANIDM_TARGET ?? loadedEnv.KANIDM_TARGET ?? "https://localhost:18443";

const kanidmTaskEnv = [
  "KANIDM_ENV_MODE",
  "KANIDM_PASSWORD",
  "KANIDM_USERNAME",
  "KANIDM_URL",
  "KANIDM_DASHBOARD_URL",
  "KANIDM_INSTANCE_URL",
  "KANIDM_MAIL_SERVICE_ACCOUNT",
  "KANIDM_INSECURE_TLS",
  "DASHBOARD_URL",
  "E2E_SCREENSHOT_DIR",
  "MAILPIT_API_URL",
  "KANIDM_RECOVERY_MAIL_TIMEOUT_MS",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "NO_PROXY",
  "http_proxy",
  "https_proxy",
  "no_proxy",
  "CONTAINER_SMOKE_PORT",
  "CONTAINER_SMOKE_IMAGE",
  "KANIDM_DASHBOARD_IMAGE",
  "LAYERHOUSE_URL",
  "LAYERHOUSE_CLIENT_ID",
];

export default defineConfig({
  plugins: [solid()],
  run: {
    cache: { tasks: false },
    tasks: {
      "auth-smoke": {
        command: "vp exec node scripts/kanidm-auth-smoke.mjs",
        untrackedEnv: kanidmTaskEnv,
      },
      "credential-update-smoke": {
        command: "vp exec node scripts/kanidm-credential-update-smoke.mjs",
        untrackedEnv: kanidmTaskEnv,
      },
      "e2e-mock": {
        command: "vp exec node scripts/e2e-mock-dashboard.mjs",
        untrackedEnv: kanidmTaskEnv,
      },
      "visual-smoke": {
        command: "vp exec node scripts/visual-smoke-dashboard.mjs",
        untrackedEnv: kanidmTaskEnv,
      },
      "e2e-kanidm": {
        command: "vp exec node scripts/e2e-real-kanidm.mjs",
        untrackedEnv: kanidmTaskEnv,
      },
      "e2e-webauthn-kanidm": {
        command: "vp exec node scripts/e2e-webauthn-kanidm.mjs",
        untrackedEnv: kanidmTaskEnv,
      },
      "e2e-recovery-kanidm": {
        command: "vp exec node scripts/e2e-recovery-kanidm.mjs",
        untrackedEnv: kanidmTaskEnv,
      },
      "e2e-recovery-mail-kanidm": {
        command: "vp exec node scripts/e2e-recovery-mail-kanidm.mjs",
        untrackedEnv: kanidmTaskEnv,
      },
      "e2e-add-user-recovery-mail-kanidm": {
        command: "vp exec node scripts/e2e-add-user-recovery-mail-kanidm.mjs",
        untrackedEnv: kanidmTaskEnv,
      },
      "kanidm-mail-bootstrap": {
        command: "vp exec node scripts/dev-kanidm-mail-bootstrap.mjs",
        untrackedEnv: kanidmTaskEnv,
      },
      "production-artifact-audit": {
        command: "vp exec node scripts/check-production-artifact.mjs",
      },
      "container-smoke": {
        command: "vp exec node scripts/container-smoke.mjs",
        untrackedEnv: kanidmTaskEnv,
      },
      "registry-image-smoke": {
        command: "vp exec node scripts/registry-image-smoke.mjs",
        untrackedEnv: kanidmTaskEnv,
      },
      "e2e-layerhouse-live-oauth": {
        command: "vp exec node scripts/e2e-layerhouse-live-oauth.mjs",
        untrackedEnv: kanidmTaskEnv,
      },
    },
  },
  server: {
    proxy: {
      "/v1": {
        target: kanidmTarget,
        changeOrigin: true,
        secure: false,
      },
      "/docs": {
        target: kanidmTarget,
        changeOrigin: true,
        secure: false,
      },
      "/ui": {
        target: kanidmTarget,
        changeOrigin: true,
        secure: false,
      },
      "/oauth2": {
        target: kanidmTarget,
        changeOrigin: true,
        secure: false,
      },
      "/.well-known": {
        target: kanidmTarget,
        changeOrigin: true,
        secure: false,
      },
    },
  },
  fmt: {},
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
});
