import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import { useConsole } from "../store";
import type { Application } from "../domain";

export default function AppIcon(props: { app: Application }) {
  const { resolveImageUrl } = useConsole();
  const [resolvedUrl, setResolvedUrl] = createSignal("");
  const [failed, setFailed] = createSignal(false);
  const imageUrl = () => props.app.imageUrl;

  createEffect(() => {
    const source = imageUrl();
    let cancelled = false;
    let objectUrl = "";
    setResolvedUrl("");
    setFailed(false);

    if (source) {
      void resolveImageUrl(source)
        .then((url) => {
          if (cancelled) return;
          objectUrl = url.startsWith("blob:") ? url : "";
          setResolvedUrl(url);
        })
        .catch(() => {
          if (!cancelled) setFailed(true);
        });
    }

    onCleanup(() => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    });
  });

  return (
    <Show
      when={resolvedUrl() && !failed() ? resolvedUrl() : undefined}
      fallback={<span class="app-icon">{props.app.displayName.slice(0, 1).toUpperCase()}</span>}
    >
      {(imageUrl) => (
        <img
          class="app-icon"
          src={imageUrl()}
          alt=""
          onError={() => {
            setFailed(true);
          }}
        />
      )}
    </Show>
  );
}
