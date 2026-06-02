import { join } from "node:path";
import { rootDir, runContainerSmoke } from "./container-smoke-runner.mjs";

await runContainerSmoke({
  composeFile: join(rootDir, "scripts/smoke/docker-compose.smoke.yml"),
  projectNamePrefix: "kanidm-dashboard-container-smoke",
  build: true,
});
