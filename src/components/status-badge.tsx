import type { Application, UserStatus } from "../domain";

export function StatusBadge(props: { status: UserStatus }) {
  return <span class={`status-badge ${props.status}`}>{props.status}</span>;
}

export function AppStatusBadge(props: { status: Application["status"] }) {
  return <span class={`status-badge ${props.status}`}>{props.status}</span>;
}
