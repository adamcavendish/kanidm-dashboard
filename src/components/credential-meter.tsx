import { Show, createSignal } from "solid-js";
import { Info } from "lucide-solid";
import type { Person } from "../domain";

const SIGNALS = [
  { key: "password", label: "Password", meaning: "Primary password is set and not expired" },
  { key: "passkeys", label: "Passkeys", meaning: "At least one WebAuthn passkey registered" },
  { key: "totp", label: "TOTP", meaning: "Time-based one-time password configured" },
  { key: "backupCodes", label: "Backup codes", meaning: "Recovery backup codes available" },
  { key: "sshKeys", label: "SSH keys", meaning: "SSH public key registered for auth" },
] as const;

export function CredentialMeter(props: { person: Person; compact?: boolean }) {
  const [showInfo, setShowInfo] = createSignal(false);
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
          {score()}/{checks().length} healthy signals{" "}
          <span class="info-trigger" onClick={() => setShowInfo(!showInfo())}>
            <Info size={12} />
          </span>
        </small>
        <Show when={showInfo()}>
          <ul class="credential-signal-list">
            {checks().map((ok, i) => (
              <li class={ok ? "signal-ok" : "signal-missing"}>
                <strong>{SIGNALS[i]!.label}</strong>
                <span>{SIGNALS[i]!.meaning}</span>
              </li>
            ))}
          </ul>
        </Show>
      </Show>
    </div>
  );
}
