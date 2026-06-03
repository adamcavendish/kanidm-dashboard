import type { JSX } from "solid-js";

export function NodeCard(props: { icon: JSX.Element; title: string; subtitle: string }) {
  return (
    <div class="node-card">
      <span>{props.icon}</span>
      <strong>{props.title}</strong>
      <small>{props.subtitle}</small>
    </div>
  );
}
