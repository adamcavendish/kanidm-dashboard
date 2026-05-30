import { join } from "node:path";
import { rootDir, runContainerSmoke } from "./container-smoke-runner.mjs";

const image = process.env.CONTAINER_SMOKE_IMAGE ?? process.env.KANIDM_DASHBOARD_IMAGE ?? "";

if (!image) {
  console.error(
    [
      "Set CONTAINER_SMOKE_IMAGE or KANIDM_DASHBOARD_IMAGE to a pushed dashboard image tag.",
      "Example: KANIDM_DASHBOARD_IMAGE=registry.example.com/team/kanidm-dashboard:tag vp run registry-image-smoke",
    ].join("\n"),
  );
  process.exit(1);
}

await runContainerSmoke({
  composeFile: join(rootDir, "deploy/container/docker-compose.image-smoke.yml"),
  projectNamePrefix: "kanidm-dashboard-registry-smoke",
  image,
  pullImage: true,
});
