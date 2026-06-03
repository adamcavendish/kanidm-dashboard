import type { JSX } from "solid-js";

export function StatCard(props: {
  icon: JSX.Element;
  label: string;
  value: JSX.Element | number | string;
  detail: string;
}) {
  return (
    <div class="stat-card">
      <span>{props.icon}</span>
      <small>{props.label}</small>
      <strong>{props.value}</strong>
      <em>{props.detail}</em>
    </div>
  );
}
