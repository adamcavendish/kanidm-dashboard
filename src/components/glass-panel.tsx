import type { ParentProps } from "solid-js";

export default function GlassPanel(props: ParentProps<{ title: string }>) {
  return (
    <section class="glass-panel">
      <h2>{props.title}</h2>
      {props.children}
    </section>
  );
}
