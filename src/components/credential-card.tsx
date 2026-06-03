import { Show } from "solid-js";
import type { JSX } from "solid-js";
import { Link } from "../routing";

export function CredentialCard(props: {
  title: string;
  value: string;
  icon: JSX.Element;
  action: string;
  href?: string;
  disabled?: boolean;
}) {
  return (
    <div class="credential-card">
      <span>{props.icon}</span>
      <h3>{props.title}</h3>
      <p>{props.value}</p>
      <Show
        when={props.href && !props.disabled ? props.href : undefined}
        fallback={
          <button class="secondary-action" type="button" disabled={props.disabled}>
            {props.action}
          </button>
        }
      >
        {(href) => (
          <Link class="secondary-action" href={href()}>
            {props.action}
          </Link>
        )}
      </Show>
    </div>
  );
}
