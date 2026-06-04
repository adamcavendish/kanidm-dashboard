import { For, Show } from "solid-js";
import { CircleAlert } from "lucide-solid";
import type { CredentialUpdateStatus } from "../domain";
import KeyValue from "./key-value";

export function CredentialUpdateStatusPanel(props: { status: CredentialUpdateStatus }) {
  const rows = () => [
    [
      "Primary",
      props.status.primaryState,
      props.status.hasPrimaryCredential ? "Present" : "Missing",
    ],
    ["Passkeys", props.status.passkeysState, `${props.status.passkeyCount} registered`],
    [
      "TOTP",
      props.status.pendingTotp ? "Pending verification" : "Ready",
      props.status.totpLabels.length
        ? `${props.status.totpLabels.length} registered`
        : "No registered TOTP",
    ],
    [
      "Attested passkeys",
      props.status.attestedPasskeysState,
      `${props.status.attestedPasskeyCount} registered`,
    ],
    [
      "Unix credential",
      props.status.unixCredentialState,
      props.status.hasUnixCredential ? "Present" : "Missing",
    ],
    [
      "Backup codes",
      props.status.pendingBackupCodes.length ? "Generated" : "No staged changes",
      props.status.pendingBackupCodes.length
        ? `${props.status.pendingBackupCodes.length} pending codes`
        : "Use generation controls below",
    ],
    ["SSH public keys", props.status.sshKeysState, `${props.status.sshKeyCount} keys`],
  ];

  return (
    <div class="intent-token">
      <KeyValue label="Account" value={props.status.displayName} />
      <KeyValue label="SPN" value={props.status.spn} />
      <KeyValue label="Commit allowed" value={props.status.canCommit ? "Yes" : "No"} />
      <Show when={props.status.warnings.length}>
        <div class="review-box danger" role="alert" aria-live="assertive">
          <CircleAlert size={18} />
          <span>{props.status.warnings.join(", ")}</span>
        </div>
      </Show>
      <div class="status-list">
        <For each={rows()}>
          {([label, state, detail]) => (
            <div>
              <span>{label}</span>
              <strong>{state}</strong>
              <small>{detail}</small>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
