import type { JSX } from "solid-js";

export default function KeyValue(props: {
  label: string;
  value: JSX.Element | string | number;
  variant?: "default" | "detail";
}) {
  const className = () => (props.variant === "detail" ? "key-value key-value-detail" : "key-value");

  return (
    <div class={className()}>
      <span>{props.label}</span>
      <strong title={typeof props.value === "string" ? props.value : undefined}>
        {props.value}
      </strong>
    </div>
  );
}
