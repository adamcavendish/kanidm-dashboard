import type { JSX } from "solid-js";

export function EmptyState(props: { icon: JSX.Element; title: string; text: string }) {
  return (
    <div class="empty-state">
      {props.icon}
      <h2>{props.title}</h2>
      <p>{props.text}</p>
    </div>
  );
}
