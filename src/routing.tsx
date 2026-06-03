import { createContext, createSignal, onCleanup, onMount, useContext } from "solid-js";
import type { ParentProps } from "solid-js";

interface RouteContextValue {
  path: () => string;
  navigate: (to: string) => void;
}

export const RouteContext = createContext<RouteContextValue>();

export function NavigationProvider(props: ParentProps) {
  const [path, setPath] = createSignal(window.location.pathname || "/portal");
  const navigate = (to: string) => {
    if (to === path()) return;
    window.history.pushState({}, "", to);
    setPath(to);
    window.scrollTo({ top: 0, behavior: "auto" });
  };
  const onPopState = () => setPath(window.location.pathname || "/portal");

  onMount(() => window.addEventListener("popstate", onPopState));
  onCleanup(() => window.removeEventListener("popstate", onPopState));

  return <RouteContext.Provider value={{ path, navigate }}>{props.children}</RouteContext.Provider>;
}

export function useNavigation() {
  const context = useContext(RouteContext);
  if (!context) throw new Error("useNavigation must be used inside NavigationProvider");
  return context;
}

export function Link(
  props: ParentProps<{
    href: string;
    class?: string;
    ariaLabel?: string;
    target?: string;
    rel?: string;
  }>,
) {
  const { navigate } = useNavigation();
  const external = () => props.href.startsWith("http") || props.target;
  return (
    <a
      href={props.href}
      class={props.class}
      aria-label={props.ariaLabel}
      target={props.target}
      rel={props.rel}
      onClick={(event) => {
        if (external()) return;
        event.preventDefault();
        navigate(props.href);
      }}
    >
      {props.children}
    </a>
  );
}

export function NavLink(props: ParentProps<{ href: string }>) {
  const { path } = useNavigation();
  const active = () =>
    props.href === "/admin"
      ? path() === "/admin" || path().startsWith("/admin/")
      : path() === props.href;
  return (
    <Link href={props.href} class={active() ? "active" : ""}>
      {props.children}
    </Link>
  );
}
