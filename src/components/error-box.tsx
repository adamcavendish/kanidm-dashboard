import { Show } from "solid-js";
import { CircleAlert } from "lucide-solid";

export default function ErrorBox(props: { error: () => string }) {
  return (
    <Show when={props.error()}>
      <div class="review-box danger error-box" role="alert" aria-label="Error details" tabIndex={0}>
        <CircleAlert size={18} />
        <span title={props.error()}>{props.error()}</span>
      </div>
    </Show>
  );
}
