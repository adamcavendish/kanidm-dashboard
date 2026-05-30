import { For, Show } from "solid-js";
import { Check, Plus } from "lucide-solid";

export default function OptionGrid(props: {
  options: { id: string; label: string; detail: string }[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div class="option-grid">
      <For each={props.options}>
        {(option) => {
          const selected = () => props.selected.includes(option.id);
          return (
            <button
              aria-pressed={selected()}
              class={selected() ? "option-card selected" : "option-card"}
              type="button"
              onClick={() => props.onToggle(option.id)}
            >
              <span>
                <Show when={selected()} fallback={<Plus size={16} />}>
                  <Check size={16} />
                </Show>
              </span>
              <strong>{option.label}</strong>
              <small>{option.detail}</small>
            </button>
          );
        }}
      </For>
    </div>
  );
}
