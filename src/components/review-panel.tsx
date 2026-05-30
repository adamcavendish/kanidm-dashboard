import { For } from "solid-js";
import { Check, ClipboardCheck } from "lucide-solid";

export default function ReviewPanel(props: {
  active: boolean;
  title: string;
  items: string[];
  action: string;
  disabled: boolean;
  onAction?: () => void;
}) {
  return (
    <aside class={props.active ? "review-panel active" : "review-panel"}>
      <div>
        <ClipboardCheck size={22} />
        <h2>{props.title}</h2>
      </div>
      <div class="review-items">
        <For each={props.items}>
          {(item) => (
            <span>
              <Check size={15} /> {item}
            </span>
          )}
        </For>
      </div>
      <button
        class="primary-action"
        type={props.onAction ? "button" : "submit"}
        disabled={props.disabled}
        onClick={props.onAction}
      >
        {props.action}
      </button>
    </aside>
  );
}
