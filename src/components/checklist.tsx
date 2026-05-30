import { For, Show } from "solid-js";
import { Check, Lock } from "lucide-solid";

export default function Checklist(props: { items: string[]; muted?: boolean }) {
  return (
    <div class={props.muted ? "checklist muted" : "checklist"}>
      <For each={props.items}>
        {(item) => (
          <span>
            <Show when={props.muted} fallback={<Check size={15} />}>
              <Lock size={15} />
            </Show>{" "}
            {item}
          </span>
        )}
      </For>
    </div>
  );
}
