import { createSignal, onMount, Show } from "solid-js";
import { ServerCog } from "lucide-solid";
import { useConsole } from "../store";
import ErrorBox from "../components/error-box";
import GlassPanel from "../components/glass-panel";
import PageHeader from "../components/page-header";
import { radiusErrorMessage } from "../utils/errors";
export function RadiusPage() {
  const { config, getRadiusPassword, generateRadiusPassword, deleteRadiusPassword } = useConsole();
  const [radiusPassword, setRadiusPassword] = createSignal<string | null>(null);
  const [loaded, setLoaded] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");
  const [policyBlocked, setPolicyBlocked] = createSignal(false);
  const realMode = () => config().dataSource.mode === "kanidm";

  onMount(() => {
    void loadRadiusPassword();
  });

  async function loadRadiusPassword() {
    setBusy(true);
    setError("");
    try {
      setRadiusPassword(await getRadiusPassword());
      setLoaded(true);
    } catch (err) {
      setError(radiusErrorMessage(err, "Could not load RADIUS password.", setPolicyBlocked));
      setLoaded(true);
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    setBusy(true);
    setError("");
    try {
      setRadiusPassword(await generateRadiusPassword());
      setLoaded(true);
    } catch (err) {
      setError(radiusErrorMessage(err, "Could not generate RADIUS password.", setPolicyBlocked));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError("");
    try {
      await deleteRadiusPassword();
      setRadiusPassword(null);
      setLoaded(true);
    } catch (err) {
      setError(radiusErrorMessage(err, "Could not delete RADIUS password.", setPolicyBlocked));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader eyebrow="Self-service" title="RADIUS password" />
      <GlassPanel title="RADIUS credential">
        <div class="secret-display">
          <span>
            {!loaded() ? "Loading RADIUS password" : (radiusPassword() ?? "Not generated")}
          </span>
          <div class="button-row">
            <button
              class="secondary-action"
              type="button"
              disabled={busy() || policyBlocked()}
              onClick={generate}
            >
              {busy() ? "Working" : "Generate new password"}
            </button>
            <button
              class="danger-action"
              type="button"
              disabled={busy() || policyBlocked() || !radiusPassword()}
              onClick={remove}
            >
              Delete password
            </button>
          </div>
        </div>
        <Show when={realMode() && !policyBlocked()}>
          <div class="review-box">
            <ServerCog size={18} />
            <span>
              RADIUS credentials depend on Kanidm policy for this account. If generation is denied,
              the dashboard will leave the current credential unchanged.
            </span>
          </div>
        </Show>
        <ErrorBox error={error} />
      </GlassPanel>
    </>
  );
}
