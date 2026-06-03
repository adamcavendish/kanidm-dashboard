import { createSignal, For, Show } from "solid-js";
import { BadgeCheck, CircleAlert, RotateCcw, Upload } from "lucide-solid";
import type { BrandingSettings } from "../../domain";
import { kanidmImageValidation } from "../../domain";
import { contrastRatio, themePreviewStyle, useConsole } from "../../store";
import AppIcon from "../../components/app-icon";
import GlassPanel from "../../components/glass-panel";
import KeyValue from "../../components/key-value";
import PageHeader from "../../components/page-header";
export function BrandingPage() {
  const {
    state,
    branding,
    config,
    updateNativeBranding,
    uploadDomainImage,
    resetDomainImage,
    themeConfigSnippet,
  } = useConsole();
  const [draft, setDraft] = createSignal<BrandingSettings>(branding());
  const [saveBusy, setSaveBusy] = createSignal(false);
  const [saveError, setSaveError] = createSignal("");
  const [imageBusy, setImageBusy] = createSignal(false);
  const [imageError, setImageError] = createSignal("");
  const contrast = () =>
    contrastRatio(
      config().theme.accentColor,
      config().theme.mode === "light" ? "#ffffff" : "#0b0f14",
    );
  const validContrast = () => contrast() >= 3;
  const previewBranding = () => ({
    ...branding(),
    companyName: draft().companyName,
  });
  const nativeDomainWritable = () =>
    config().dataSource.mode !== "kanidm" || branding().canManageNativeDomainBranding;

  function patchBranding(patch: Partial<Omit<BrandingSettings, "theme">>) {
    setDraft((previous) => ({ ...previous, ...patch }));
  }

  async function handleLogoUpload(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!nativeDomainWritable()) {
      setImageError("Current Kanidm session cannot manage native domain branding.");
      input.value = "";
      return;
    }
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (
      !kanidmImageValidation.formats.includes(extension) ||
      file.size > kanidmImageValidation.maxBytes
    ) {
      window.alert("Image must be png, jpg, gif, svg, or webp and less than 256 KB.");
      return;
    }
    setImageBusy(true);
    setImageError("");
    try {
      await uploadDomainImage(file);
      setDraft((previous) => ({ ...previous, logoUrl: branding().logoUrl }));
    } catch (error) {
      setImageError(error instanceof Error ? error.message : "Could not upload domain image.");
    } finally {
      setImageBusy(false);
      input.value = "";
    }
  }

  async function saveBranding() {
    setSaveBusy(true);
    setSaveError("");
    try {
      if (!nativeDomainWritable()) {
        throw new Error("Current Kanidm session cannot manage native domain branding.");
      }
      await updateNativeBranding({ companyName: draft().companyName });
      setDraft((previous) => ({
        ...previous,
        companyName: branding().companyName,
      }));
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save branding.");
    } finally {
      setSaveBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Branding"
        action={
          <button
            class="primary-action"
            type="button"
            disabled={saveBusy() || !nativeDomainWritable()}
            onClick={() => {
              void saveBranding();
            }}
          >
            {saveBusy() ? "Saving display name" : "Save domain display name"}
          </button>
        }
      />
      <div class="brand-layout">
        <div class="form-stack">
          <GlassPanel title="Branding surfaces">
            <label>
              Kanidm domain display name
              <input
                value={draft().companyName}
                disabled={!nativeDomainWritable()}
                onInput={(event) => patchBranding({ companyName: event.currentTarget.value })}
              />
            </label>
            <Show when={!nativeDomainWritable()}>
              <div class="review-box warning">
                <CircleAlert size={18} />
                <span>
                  This Kanidm session cannot manage native domain branding. Use a domain
                  administrator account for domain display/image changes, or update the static
                  dashboard config for fallback branding.
                </span>
              </div>
            </Show>
            <div class="config-readouts">
              <KeyValue label="Dashboard login message" value={config().loginMessage} />
              <KeyValue label="Static fallback logo URL" value={config().logoUrl || "Not set"} />
            </div>
            <div class="button-row">
              <label class={nativeDomainWritable() ? "file-button" : "file-button disabled"}>
                <Upload size={16} />{" "}
                {imageBusy() ? "Uploading domain image" : "Upload domain image"}
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg,.gif,.svg,.webp"
                  disabled={imageBusy() || !nativeDomainWritable()}
                  onChange={handleLogoUpload}
                />
              </label>
              <button
                class="danger-action"
                type="button"
                disabled={imageBusy() || !nativeDomainWritable()}
                onClick={() => {
                  setImageBusy(true);
                  setImageError("");
                  void resetDomainImage()
                    .then(() =>
                      setDraft((previous) => ({
                        ...previous,
                        logoUrl: branding().logoUrl,
                      })),
                    )
                    .catch((error: unknown) =>
                      setImageError(
                        error instanceof Error ? error.message : "Could not reset domain image.",
                      ),
                    )
                    .finally(() => setImageBusy(false));
                }}
              >
                Reset domain image
              </button>
            </div>
            <p class="muted">
              Domain display name and domain image are saved to Kanidm when allowed. Login message
              and the unauthenticated fallback logo URL are static dashboard config; set{" "}
              <code>loginMessage</code> and <code>logoUrl</code> in{" "}
              <code>/dashboard.config.json</code> for production.
            </p>
            <Show when={imageError()}>
              <div class="review-box danger">
                <CircleAlert size={18} />
                <span>{imageError()}</span>
              </div>
            </Show>
            <Show when={saveError()}>
              <div class="review-box danger">
                <CircleAlert size={18} />
                <span>{saveError()}</span>
              </div>
            </Show>
          </GlassPanel>

          <GlassPanel title="Static dashboard theme">
            <div class="theme-grid">
              <KeyValue label="Mode" value={config().theme.mode} />
              <KeyValue label="Preset" value={config().theme.preset} />
              <KeyValue label="Accent" value={config().theme.accentColor} />
              <KeyValue label="Surface" value={config().theme.surfaceIntensity} />
            </div>
            <div class={validContrast() ? "review-box success" : "review-box danger"}>
              <Show when={validContrast()} fallback={<CircleAlert size={18} />}>
                <BadgeCheck size={18} />
              </Show>
              <span>Accent contrast {contrast().toFixed(2)}:1 against the active background.</span>
            </div>
            <p class="muted">
              Theme is deploy-time static config. Change <code>/dashboard.config.json</code> and
              roll replicas; active users continue on the old loaded config until reload.
            </p>
            <pre class="config-code">{themeConfigSnippet()}</pre>
            <div class="button-row">
              <button class="secondary-action" type="button" onClick={() => setDraft(branding())}>
                <RotateCcw size={16} /> Discard display-name edit
              </button>
            </div>
          </GlassPanel>
        </div>

        <div class="preview-stack" style={themePreviewStyle(config().theme)}>
          <GlassPanel title="Login preview">
            <div class="mini-login">
              <Show
                when={previewBranding().logoUrl}
                fallback={<span>{previewBranding().companyName.slice(0, 1)}</span>}
              >
                {(logoUrl) => <img src={logoUrl()} alt="" />}
              </Show>
              <strong>{previewBranding().companyName}</strong>
              <small>{previewBranding().loginMessage}</small>
              <button type="button">Continue</button>
            </div>
          </GlassPanel>
          <GlassPanel title="Portal preview">
            <div class="mini-portal">
              <For each={state().apps.slice(0, 3)}>
                {(app) => (
                  <div>
                    <AppIcon app={app} />
                    <span>{app.displayName}</span>
                  </div>
                )}
              </For>
            </div>
          </GlassPanel>
        </div>
      </div>
    </>
  );
}
