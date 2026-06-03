import type { ParentProps } from "solid-js";

export function AuthFrame(props: ParentProps) {
  return <main class="auth-frame">{props.children}</main>;
}
