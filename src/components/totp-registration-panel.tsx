import type { CredentialUpdateStatus } from "../domain";
import KeyValue from "./key-value";

export function TotpRegistrationPanel(props: {
  registration: NonNullable<CredentialUpdateStatus["pendingTotp"]>;
}) {
  return (
    <div class="totp-registration" aria-label="TOTP registration details">
      <KeyValue label="Issuer" value={props.registration.issuer} />
      <KeyValue label="Account" value={props.registration.accountName} />
      <KeyValue label="Secret" value={props.registration.secret} />
      <KeyValue label="Algorithm" value={props.registration.algorithm} />
      <KeyValue label="Digits" value={props.registration.digits} />
      <KeyValue label="Period" value={`${props.registration.step}s`} />
      <code>{props.registration.uri}</code>
    </div>
  );
}

export function totpIssueText(status: CredentialUpdateStatus) {
  if (status.totpIssue === "try-again") return "The TOTP code did not verify.";
  if (status.totpIssue === "name-taken") {
    return status.totpIssueLabel
      ? `A TOTP named ${status.totpIssueLabel} already exists.`
      : "That TOTP name already exists.";
  }
  if (status.totpIssue === "invalid-sha1") {
    return "The authenticator proposed SHA1. Accept only for compatibility with an existing app.";
  }
  return "";
}
