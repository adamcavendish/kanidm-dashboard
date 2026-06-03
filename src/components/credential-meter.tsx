import { Show } from "solid-js";
import type { Person } from "../domain";

export function CredentialMeter(props: { person: Person; compact?: boolean }) {
  const checks = () => [
    props.person.credential.password === "healthy",
    props.person.credential.passkeys > 0,
    props.person.credential.totp,
    props.person.credential.backupCodes > 0,
    props.person.credential.sshKeys > 0,
  ];
  const score = () => checks().filter(Boolean).length;
  return (
    <div class={props.compact ? "credential-meter compact" : "credential-meter"}>
      <span style={{ width: `${(score() / checks().length) * 100}%` }} />
      <Show when={!props.compact}>
        <small>
          {score()}/{checks().length} healthy signals
        </small>
      </Show>
    </div>
  );
}
