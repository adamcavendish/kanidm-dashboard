import { Show, type JSX } from "solid-js";

export default function PageHeader(props: {
  eyebrow: string;
  title: string;
  action?: JSX.Element;
}) {
  return (
    <div class="page-header">
      <div>
        <span class="eyebrow">{props.eyebrow}</span>
        <h1>{props.title}</h1>
      </div>
      <Show when={props.action}>
        <div class="page-action">{props.action}</div>
      </Show>
    </div>
  );
}
