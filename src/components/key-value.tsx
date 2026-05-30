import type { JSX } from "solid-js";

export default function KeyValue(props: { label: string; value: JSX.Element | string | number }) {
  return (
    <div class="key-value">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}
