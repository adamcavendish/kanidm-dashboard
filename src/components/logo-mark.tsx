import { Show } from "solid-js";
import { useConsole } from "../store";

export function LogoMark(props: { small?: boolean }) {
  const { branding } = useConsole();
  const className = () => (props.small ? "logo-mark logo-mark-small" : "logo-mark");
  return (
    <Show
      when={branding().logoUrl}
      fallback={
        <span class={className()} aria-hidden="true">
          {branding().companyName.slice(0, 1).toUpperCase()}
        </span>
      }
    >
      {(logoUrl) => <img class={className()} src={logoUrl()} alt="" />}
    </Show>
  );
}
