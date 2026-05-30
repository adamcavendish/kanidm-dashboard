import { loadEnv } from "vite-plus";

const mode = process.env.KANIDM_ENV_MODE ?? process.env.NODE_ENV ?? "development";
const loadedEnv = loadEnv(mode, process.cwd(), "");

export function envValue(name, fallback) {
  return process.env[name] ?? loadedEnv[name] ?? fallback;
}
