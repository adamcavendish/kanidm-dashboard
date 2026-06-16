import {
  createEffect,
  createSignal,
  For,
  Show,
  type Accessor,
  type JSX,
  type Setter,
} from "solid-js";
import {
  BadgeCheck,
  ChevronDown,
  CircleAlert,
  ClipboardCheck,
  Fingerprint,
  KeyRound,
  QrCode,
  ServerCog,
  ShieldCheck,
  SquareAsterisk,
  Trash2,
} from "lucide-solid";
import type { CredentialUpdateStatus, PasskeyRegistration } from "../domain";
import { useConsole } from "../store";
import ErrorBox from "./error-box";
import { CredentialUpdateStatusPanel } from "./credential-update-status-panel";
import { TotpRegistrationPanel, totpIssueText } from "./totp-registration-panel";
import {
  createPasskeyRegistration,
  mockPasskeyRegistration,
  passkeyRegistrationHint,
} from "../utils/webauthn";
import { warningsRequirePasskey, warningsRequireTotp } from "../utils/credential-warnings";

interface CredentialUpdateWorkbenchProps {
  status: Accessor<CredentialUpdateStatus | null>;
  setStatus: Setter<CredentialUpdateStatus | null>;
  messageResetKey?: Accessor<unknown>;
}

type SectionId = "password" | "passkeys" | "totp" | "unix" | "ssh" | "backup";

const closedSections: Record<SectionId, boolean> = {
  password: false,
  passkeys: false,
  totp: false,
  unix: false,
  ssh: false,
  backup: false,
};

function defaultSections(status: CredentialUpdateStatus): Record<SectionId, boolean> {
  return {
    password: true,
    passkeys: warningsRequirePasskey(status.warnings) || Boolean(status.pendingPasskey),
    totp:
      warningsRequireTotp(status.warnings) ||
      Boolean(status.pendingTotp) ||
      Boolean(status.totpIssue),
    unix: false,
    ssh: false,
    backup: status.pendingBackupCodes.length > 0,
  };
}

export function CredentialUpdateWorkbench(props: CredentialUpdateWorkbenchProps) {
  const {
    config,
    updateCredentialPassword,
    generateCredentialBackupCodes,
    removeCredentialBackupCodes,
    startCredentialTotp,
    verifyCredentialTotp,
    acceptCredentialTotpSha1,
    removeCredentialTotp,
    cancelCredentialMfaRegistration,
    updateCredentialUnixPassword,
    removeCredentialUnixPassword,
    removeCredentialSshPublicKey,
    addCredentialSshPublicKey,
    startCredentialPasskey,
    finishCredentialPasskey,
    removeCredentialPasskey,
    removeCredentialAttestedPasskey,
    commitCredentialUpdate,
    cancelCredentialUpdate,
  } = useConsole();
  const [newPassword, setNewPassword] = createSignal("");
  const [confirmPassword, setConfirmPassword] = createSignal("");
  const [totpLabel, setTotpLabel] = createSignal("Authenticator");
  const [totpCode, setTotpCode] = createSignal("");
  const [totpRemoveLabel, setTotpRemoveLabel] = createSignal("");
  const [passkeyLabel, setPasskeyLabel] = createSignal("Workstation passkey");
  const [passkeyRemoveId, setPasskeyRemoveId] = createSignal("");
  const [attestedPasskeyRemoveId, setAttestedPasskeyRemoveId] = createSignal("");
  const [sshKeyLabel, setSshKeyLabel] = createSignal("Workstation");
  const [sshPublicKey, setSshPublicKey] = createSignal("");
  const [sshKeyRemoveLabel, setSshKeyRemoveLabel] = createSignal("");
  const [unixPassword, setUnixPassword] = createSignal("");
  const [unixConfirmPassword, setUnixConfirmPassword] = createSignal("");
  const [busy, setBusy] = createSignal("");
  const [message, setMessage] = createSignal("");
  const [error, setError] = createSignal("");
  const [openSections, setOpenSections] = createSignal<Record<SectionId, boolean>>({
    ...closedSections,
  });
  const [lastSessionToken, setLastSessionToken] = createSignal("");

  createEffect(() => {
    const current = props.status();
    if (!current) {
      setLastSessionToken("");
      setOpenSections({ ...closedSections });
      return;
    }
    setPasskeyRemoveId(current.passkeys[0]?.uuid ?? "");
    setAttestedPasskeyRemoveId(current.attestedPasskeys[0]?.uuid ?? "");
    setSshKeyRemoveLabel(current.sshKeyLabels[0] ?? "");
    setTotpRemoveLabel(current.totpLabels[0] ?? "");
    if (current.sessionToken !== lastSessionToken()) {
      setLastSessionToken(current.sessionToken);
      setOpenSections(defaultSections(current));
      return;
    }
    setOpenSections((previous) => ({
      ...previous,
      passkeys:
        previous.passkeys ||
        warningsRequirePasskey(current.warnings) ||
        Boolean(current.pendingPasskey),
      totp:
        previous.totp ||
        warningsRequireTotp(current.warnings) ||
        Boolean(current.pendingTotp) ||
        Boolean(current.totpIssue),
      backup: previous.backup || current.pendingBackupCodes.length > 0,
    }));
  });

  createEffect(() => {
    if (!props.messageResetKey) return;
    props.messageResetKey();
    setMessage("");
    setError("");
  });

  function setNextStatus(nextStatus: CredentialUpdateStatus) {
    props.setStatus(nextStatus);
  }

  function toggleSection(section: SectionId) {
    setOpenSections((previous) => ({ ...previous, [section]: !previous[section] }));
  }

  function sectionPanelId(section: SectionId) {
    return `credential-section-${section}`;
  }

  function WorkbenchSection(sectionProps: {
    id: SectionId;
    title: string;
    summary: string;
    children: JSX.Element;
  }) {
    const expanded = () => openSections()[sectionProps.id];
    return (
      <section class="credential-section">
        <button
          class="credential-section-toggle"
          type="button"
          aria-expanded={expanded()}
          aria-controls={sectionPanelId(sectionProps.id)}
          onClick={() => toggleSection(sectionProps.id)}
        >
          <span>
            <strong>{sectionProps.title}</strong>
            <small>{sectionProps.summary}</small>
          </span>
          <ChevronDown class={expanded() ? "section-chevron open" : "section-chevron"} size={18} />
        </button>
        <Show when={expanded()}>
          <div id={sectionPanelId(sectionProps.id)} class="credential-section-body">
            {sectionProps.children}
          </div>
        </Show>
      </section>
    );
  }

  async function stagePassword() {
    const current = props.status();
    if (!current) return;
    if (!newPassword().trim()) {
      setError("New password is required.");
      return;
    }
    if (newPassword() !== confirmPassword()) {
      setError("Password confirmation does not match.");
      return;
    }

    setBusy("password");
    setMessage("");
    setError("");
    try {
      setNextStatus(await updateCredentialPassword(current.sessionToken, newPassword()));
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Password staged. Review the credential status, then commit.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not stage password update.");
    } finally {
      setBusy("");
    }
  }

  async function generateBackupCodes() {
    const current = props.status();
    if (!current) return;

    setBusy("backup-codes");
    setMessage("");
    setError("");
    try {
      setNextStatus(await generateCredentialBackupCodes(current.sessionToken));
      setMessage("Backup codes staged. Store them securely, then commit.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate backup codes.");
    } finally {
      setBusy("");
    }
  }

  async function removeBackupCodes() {
    const current = props.status();
    if (!current) return;

    setBusy("backup-code-remove");
    setMessage("");
    setError("");
    try {
      setNextStatus(await removeCredentialBackupCodes(current.sessionToken));
      setMessage("Backup code removal staged. Review the credential status, then commit.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove backup codes.");
    } finally {
      setBusy("");
    }
  }

  async function stageUnixPassword() {
    const current = props.status();
    if (!current) return;
    if (!unixPassword().trim()) {
      setError("Unix credential password is required.");
      return;
    }
    if (unixPassword() !== unixConfirmPassword()) {
      setError("Unix credential confirmation does not match.");
      return;
    }

    setBusy("unix-password");
    setMessage("");
    setError("");
    try {
      setNextStatus(await updateCredentialUnixPassword(current.sessionToken, unixPassword()));
      setUnixPassword("");
      setUnixConfirmPassword("");
      setMessage("Unix credential staged. Review the credential status, then commit.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not stage Unix credential.");
    } finally {
      setBusy("");
    }
  }

  async function removeUnixPassword() {
    const current = props.status();
    if (!current) return;

    setBusy("unix-remove");
    setMessage("");
    setError("");
    try {
      setNextStatus(await removeCredentialUnixPassword(current.sessionToken));
      setMessage("Unix credential removal staged. Review the credential status, then commit.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove Unix credential.");
    } finally {
      setBusy("");
    }
  }

  async function removeSshPublicKey() {
    const current = props.status();
    if (!current) return;

    setBusy("ssh-key-remove");
    setMessage("");
    setError("");
    try {
      const nextStatus = await removeCredentialSshPublicKey(
        current.sessionToken,
        sshKeyRemoveLabel(),
      );
      setNextStatus(nextStatus);
      setSshKeyRemoveLabel(nextStatus.sshKeyLabels[0] ?? "");
      setMessage("SSH public key removal staged. Review the credential status, then commit.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove SSH public key.");
    } finally {
      setBusy("");
    }
  }

  async function addSshKey() {
    const current = props.status();
    if (!current) return;

    setBusy("ssh-key-add");
    setMessage("");
    setError("");
    try {
      const nextStatus = await addCredentialSshPublicKey(
        current.sessionToken,
        sshKeyLabel(),
        sshPublicKey(),
      );
      setNextStatus(nextStatus);
      setSshKeyRemoveLabel(nextStatus.sshKeyLabels[0] ?? "");
      setSshPublicKey("");
      setMessage("SSH public key staged. Review the credential status, then commit.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add SSH public key.");
    } finally {
      setBusy("");
    }
  }

  async function removePasskey() {
    const current = props.status();
    if (!current) return;

    setBusy("passkey-remove");
    setMessage("");
    setError("");
    try {
      const nextStatus = await removeCredentialPasskey(current.sessionToken, passkeyRemoveId());
      setNextStatus(nextStatus);
      setPasskeyRemoveId(nextStatus.passkeys[0]?.uuid ?? "");
      setMessage("Passkey removal staged. Review the credential status, then commit.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove passkey.");
    } finally {
      setBusy("");
    }
  }

  async function startPasskey(kind: PasskeyRegistration["kind"]) {
    const current = props.status();
    if (!current) return;

    setBusy(kind === "attested-passkey" ? "attested-passkey-start" : "passkey-start");
    setMessage("");
    setError("");
    try {
      setNextStatus(await startCredentialPasskey(current.sessionToken, kind));
      setMessage(
        kind === "attested-passkey"
          ? "Attested passkey setup started. Complete browser registration before commit."
          : "Passkey setup started. Complete browser registration before commit.",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : kind === "attested-passkey"
            ? "Could not start attested passkey setup."
            : "Could not start passkey setup.",
      );
    } finally {
      setBusy("");
    }
  }

  async function finishPasskeyRegistration() {
    const current = props.status();
    if (!current?.pendingPasskey) return;

    setBusy("passkey-finish");
    setMessage("");
    setError("");
    try {
      const registration =
        config().dataSource.mode === "mock"
          ? mockPasskeyRegistration()
          : await createPasskeyRegistration(current.pendingPasskey.challenge);
      const nextStatus = await finishCredentialPasskey(
        current.sessionToken,
        passkeyLabel(),
        registration,
        current.pendingPasskey.kind,
      );
      setNextStatus(nextStatus);
      setPasskeyRemoveId(nextStatus.passkeys[0]?.uuid ?? "");
      setAttestedPasskeyRemoveId(nextStatus.attestedPasskeys[0]?.uuid ?? "");
      setMessage(
        current.pendingPasskey.kind === "attested-passkey"
          ? "Attested passkey staged. Review the credential status, then commit."
          : "Passkey staged. Review the credential status, then commit.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not register passkey.");
    } finally {
      setBusy("");
    }
  }

  async function removeAttestedPasskey() {
    const current = props.status();
    if (!current) return;

    setBusy("attested-passkey-remove");
    setMessage("");
    setError("");
    try {
      const nextStatus = await removeCredentialAttestedPasskey(
        current.sessionToken,
        attestedPasskeyRemoveId(),
      );
      setNextStatus(nextStatus);
      setAttestedPasskeyRemoveId(nextStatus.attestedPasskeys[0]?.uuid ?? "");
      setMessage("Attested passkey removal staged. Review the credential status, then commit.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove attested passkey.");
    } finally {
      setBusy("");
    }
  }

  async function startTotp() {
    const current = props.status();
    if (!current) return;

    setBusy("totp-start");
    setMessage("");
    setError("");
    try {
      setNextStatus(await startCredentialTotp(current.sessionToken));
      setTotpCode("");
      setMessage("TOTP setup started. Verify the authenticator code before commit.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start TOTP setup.");
    } finally {
      setBusy("");
    }
  }

  async function verifyTotp() {
    const current = props.status();
    if (!current) return;

    setBusy("totp-verify");
    setMessage("");
    setError("");
    try {
      const nextStatus = await verifyCredentialTotp(current.sessionToken, totpCode(), totpLabel());
      setNextStatus(nextStatus);
      setTotpRemoveLabel(nextStatus.totpLabels[0] ?? "");
      setTotpCode("");
      setMessage("TOTP staged. Review the credential status, then commit.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify TOTP code.");
    } finally {
      setBusy("");
    }
  }

  async function acceptTotpSha1() {
    const current = props.status();
    if (!current) return;

    setBusy("totp-sha1");
    setMessage("");
    setError("");
    try {
      setNextStatus(await acceptCredentialTotpSha1(current.sessionToken));
      setMessage("SHA1 TOTP accepted. Review the credential status, then commit.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not accept SHA1 TOTP.");
    } finally {
      setBusy("");
    }
  }

  async function removeTotp() {
    const current = props.status();
    if (!current) return;

    setBusy("totp-remove");
    setMessage("");
    setError("");
    try {
      const nextStatus = await removeCredentialTotp(current.sessionToken, totpRemoveLabel());
      setNextStatus(nextStatus);
      setTotpRemoveLabel(nextStatus.totpLabels[0] ?? "");
      setMessage("TOTP removal staged. Review the credential status, then commit.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove TOTP.");
    } finally {
      setBusy("");
    }
  }

  async function cancelMfaRegistration() {
    const current = props.status();
    if (!current) return;

    setBusy("mfa-cancel");
    setMessage("");
    setError("");
    try {
      setNextStatus(await cancelCredentialMfaRegistration(current.sessionToken));
      setTotpCode("");
      setMessage("MFA setup cancelled.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel MFA setup.");
    } finally {
      setBusy("");
    }
  }

  async function commit() {
    const current = props.status();
    if (!current) return;
    setBusy("commit");
    setMessage("");
    setError("");
    try {
      await commitCredentialUpdate(current.sessionToken);
      setMessage("Credential update committed.");
      props.setStatus(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not commit credential update.");
    } finally {
      setBusy("");
    }
  }

  async function cancel() {
    const current = props.status();
    if (!current) return;
    setBusy("cancel");
    setMessage("");
    setError("");
    try {
      await cancelCredentialUpdate(current.sessionToken);
      setMessage("Credential update cancelled.");
      props.setStatus(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel credential update.");
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <Show when={props.status()}>
        {(verified) => (
          <div class="credential-workbench">
            <CredentialUpdateStatusPanel status={verified()} />

            <div class="credential-section-list">
              <WorkbenchSection
                id="password"
                title="Password"
                summary={`${verified().primaryState} · ${
                  verified().hasPrimaryCredential ? "Present" : "Missing"
                }`}
              >
                <div class="field-grid credential-two-column">
                  <label>
                    New password
                    <input
                      type="password"
                      value={newPassword()}
                      autocomplete="new-password"
                      onInput={(event) => setNewPassword(event.currentTarget.value)}
                    />
                  </label>
                  <label>
                    Confirm password
                    <input
                      type="password"
                      value={confirmPassword()}
                      autocomplete="new-password"
                      onInput={(event) => setConfirmPassword(event.currentTarget.value)}
                    />
                  </label>
                </div>
                <button
                  class="secondary-action"
                  type="button"
                  disabled={
                    busy() === "password" || !newPassword().trim() || !confirmPassword().trim()
                  }
                  onClick={() => void stagePassword()}
                >
                  <KeyRound size={16} />{" "}
                  {busy() === "password" ? "Staging password" : "Stage password"}
                </button>
              </WorkbenchSection>

              <WorkbenchSection
                id="passkeys"
                title="Passkeys"
                summary={`${verified().passkeyCount} regular · ${
                  verified().attestedPasskeyCount
                } attested`}
              >
                <div class="field-grid">
                  <div class="credential-two-column">
                    <Show when={verified().passkeys.length}>
                      <label>
                        Passkey
                        <select
                          aria-label="Passkey"
                          value={passkeyRemoveId()}
                          onChange={(event) => setPasskeyRemoveId(event.currentTarget.value)}
                        >
                          <option value="">Select passkey</option>
                          <For each={verified().passkeys}>
                            {(passkey) => <option value={passkey.uuid}>{passkey.tag}</option>}
                          </For>
                        </select>
                      </label>
                    </Show>
                    <Show when={verified().attestedPasskeys.length}>
                      <label>
                        Attested passkey
                        <select
                          aria-label="Attested passkey"
                          value={attestedPasskeyRemoveId()}
                          onChange={(event) =>
                            setAttestedPasskeyRemoveId(event.currentTarget.value)
                          }
                        >
                          <option value="">Select attested passkey</option>
                          <For each={verified().attestedPasskeys}>
                            {(passkey) => <option value={passkey.uuid}>{passkey.tag}</option>}
                          </For>
                        </select>
                      </label>
                    </Show>
                  </div>
                  <label>
                    Passkey label
                    <input
                      value={passkeyLabel()}
                      onInput={(event) => setPasskeyLabel(event.currentTarget.value)}
                    />
                  </label>
                  <div class="review-box">
                    <Fingerprint size={18} />
                    <span>{passkeyRegistrationHint(verified().pendingPasskey)}</span>
                  </div>
                  <div class="button-row">
                    <button
                      class="secondary-action"
                      type="button"
                      disabled={
                        busy() === "passkey-start" ||
                        Boolean(verified().pendingPasskey || verified().pendingTotp)
                      }
                      onClick={() => void startPasskey("passkey")}
                    >
                      <Fingerprint size={16} />
                      {busy() === "passkey-start" ? "Starting passkey" : "Start passkey setup"}
                    </button>
                    <button
                      class="secondary-action"
                      type="button"
                      disabled={
                        busy() === "attested-passkey-start" ||
                        Boolean(verified().pendingPasskey || verified().pendingTotp)
                      }
                      onClick={() => void startPasskey("attested-passkey")}
                    >
                      <Fingerprint size={16} />
                      {busy() === "attested-passkey-start"
                        ? "Starting attested passkey"
                        : "Start attested passkey setup"}
                    </button>
                    <button
                      class="secondary-action"
                      type="button"
                      disabled={
                        busy() === "passkey-finish" ||
                        !verified().pendingPasskey ||
                        !passkeyLabel().trim()
                      }
                      onClick={() => void finishPasskeyRegistration()}
                    >
                      <ShieldCheck size={16} />
                      {busy() === "passkey-finish"
                        ? "Registering passkey"
                        : verified().pendingPasskey?.kind === "attested-passkey"
                          ? "Register attested passkey"
                          : "Register passkey"}
                    </button>
                    <button
                      class="danger-action"
                      type="button"
                      disabled={
                        busy() === "passkey-remove" ||
                        !verified().passkeys.length ||
                        !passkeyRemoveId().trim()
                      }
                      onClick={() => void removePasskey()}
                    >
                      <Trash2 size={16} />
                      {busy() === "passkey-remove" ? "Removing passkey" : "Remove passkey"}
                    </button>
                    <button
                      class="danger-action"
                      type="button"
                      disabled={
                        busy() === "attested-passkey-remove" ||
                        !verified().attestedPasskeys.length ||
                        !attestedPasskeyRemoveId().trim()
                      }
                      onClick={() => void removeAttestedPasskey()}
                    >
                      <Trash2 size={16} />
                      {busy() === "attested-passkey-remove"
                        ? "Removing attested passkey"
                        : "Remove attested passkey"}
                    </button>
                  </div>
                </div>
              </WorkbenchSection>

              <WorkbenchSection
                id="totp"
                title="TOTP"
                summary={
                  verified().pendingTotp
                    ? "Pending verification"
                    : verified().totpLabels.length
                      ? `${verified().totpLabels.length} registered`
                      : "None registered"
                }
              >
                <div class="field-grid">
                  <div class="button-row">
                    <button
                      class="secondary-action"
                      type="button"
                      disabled={busy() === "totp-start" || Boolean(verified().pendingPasskey)}
                      onClick={() => void startTotp()}
                    >
                      <QrCode size={16} />
                      {busy() === "totp-start" ? "Starting TOTP" : "Start TOTP setup"}
                    </button>
                    <button
                      class="secondary-action"
                      type="button"
                      disabled={
                        busy() === "mfa-cancel" ||
                        !(verified().pendingTotp || verified().pendingPasskey)
                      }
                      onClick={() => void cancelMfaRegistration()}
                    >
                      <Trash2 size={16} />
                      {busy() === "mfa-cancel" ? "Cancelling setup" : "Cancel MFA setup"}
                    </button>
                  </div>
                  <Show when={verified().pendingTotp}>
                    {(totp) => <TotpRegistrationPanel registration={totp()} />}
                  </Show>
                  <Show when={verified().totpIssue}>
                    <div class="review-box danger">
                      <CircleAlert size={18} />
                      <span>{totpIssueText(verified())}</span>
                      <Show when={verified().totpIssue === "invalid-sha1"}>
                        <button
                          class="secondary-action"
                          type="button"
                          disabled={busy() === "totp-sha1"}
                          onClick={() => void acceptTotpSha1()}
                        >
                          {busy() === "totp-sha1" ? "Accepting" : "Accept SHA1"}
                        </button>
                      </Show>
                    </div>
                  </Show>
                  <div class="field-grid credential-two-column">
                    <label>
                      Authenticator label
                      <input
                        value={totpLabel()}
                        onInput={(event) => setTotpLabel(event.currentTarget.value)}
                      />
                    </label>
                    <label>
                      TOTP code
                      <input
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={totpCode()}
                        onInput={(event) => setTotpCode(event.currentTarget.value)}
                        placeholder="123456"
                      />
                    </label>
                  </div>
                  <button
                    class="secondary-action"
                    type="button"
                    disabled={
                      busy() === "totp-verify" ||
                      !verified().pendingTotp ||
                      !totpLabel().trim() ||
                      !totpCode().trim()
                    }
                    onClick={() => void verifyTotp()}
                  >
                    <ShieldCheck size={16} />
                    {busy() === "totp-verify" ? "Verifying TOTP" : "Verify TOTP"}
                  </button>
                  <Show when={verified().totpLabels.length}>
                    <div class="field-grid credential-two-column">
                      <label>
                        Registered TOTP
                        <select
                          value={totpRemoveLabel()}
                          onChange={(event) => setTotpRemoveLabel(event.currentTarget.value)}
                        >
                          <option value="">Select TOTP</option>
                          <For each={verified().totpLabels}>
                            {(label) => <option value={label}>{label}</option>}
                          </For>
                        </select>
                      </label>
                      <button
                        class="danger-action"
                        type="button"
                        disabled={busy() === "totp-remove" || !totpRemoveLabel().trim()}
                        onClick={() => void removeTotp()}
                      >
                        <Trash2 size={16} />
                        {busy() === "totp-remove" ? "Removing TOTP" : "Remove TOTP"}
                      </button>
                    </div>
                  </Show>
                </div>
              </WorkbenchSection>

              <WorkbenchSection
                id="unix"
                title="Unix credential"
                summary={`${verified().unixCredentialState} · ${
                  verified().hasUnixCredential ? "Present" : "Missing"
                }`}
              >
                <div class="field-grid">
                  <div class="credential-two-column">
                    <label>
                      New Unix credential
                      <input
                        id="kanidm-unix-credential-secret"
                        name="kanidm_unix_credential_secret"
                        type="password"
                        value={unixPassword()}
                        autocomplete="off"
                        data-lpignore="true"
                        data-1p-ignore="true"
                        data-bwignore="true"
                        onInput={(event) => setUnixPassword(event.currentTarget.value)}
                      />
                    </label>
                    <label>
                      Confirm Unix credential
                      <input
                        id="kanidm-unix-credential-confirm"
                        name="kanidm_unix_credential_confirm"
                        type="password"
                        value={unixConfirmPassword()}
                        autocomplete="off"
                        data-lpignore="true"
                        data-1p-ignore="true"
                        data-bwignore="true"
                        onInput={(event) => setUnixConfirmPassword(event.currentTarget.value)}
                      />
                    </label>
                  </div>
                  <div class="button-row">
                    <button
                      class="secondary-action"
                      type="button"
                      disabled={
                        busy() === "unix-password" ||
                        !unixPassword().trim() ||
                        !unixConfirmPassword().trim()
                      }
                      onClick={() => void stageUnixPassword()}
                    >
                      <ServerCog size={16} />
                      {busy() === "unix-password"
                        ? "Staging Unix credential"
                        : "Stage Unix credential"}
                    </button>
                    <button
                      class="danger-action"
                      type="button"
                      disabled={busy() === "unix-remove"}
                      onClick={() => void removeUnixPassword()}
                    >
                      <Trash2 size={16} />
                      {busy() === "unix-remove"
                        ? "Removing Unix credential"
                        : "Remove Unix credential"}
                    </button>
                  </div>
                </div>
              </WorkbenchSection>

              <WorkbenchSection
                id="ssh"
                title="SSH public keys"
                summary={`${verified().sshKeyCount} registered`}
              >
                <div class="field-grid">
                  <label>
                    SSH key label
                    <input
                      value={sshKeyLabel()}
                      onInput={(event) => setSshKeyLabel(event.currentTarget.value)}
                    />
                  </label>
                  <label>
                    SSH public key
                    <textarea
                      rows={3}
                      value={sshPublicKey()}
                      onInput={(event) => setSshPublicKey(event.currentTarget.value)}
                      placeholder="ssh-ed25519 AAAA..."
                    />
                  </label>
                  <Show when={verified().sshKeyLabels.length}>
                    <label>
                      Registered SSH public key
                      <select
                        value={sshKeyRemoveLabel()}
                        onChange={(event) => setSshKeyRemoveLabel(event.currentTarget.value)}
                      >
                        <option value="">Select SSH key</option>
                        <For each={verified().sshKeyLabels}>
                          {(label) => <option value={label}>{label}</option>}
                        </For>
                      </select>
                    </label>
                  </Show>
                  <div class="review-box">
                    <CircleAlert size={18} />
                    <span>
                      SSH public keys are parsed by Kanidm before staging. Commit only after
                      reviewing the resulting key count and labels.
                    </span>
                  </div>
                  <div class="button-row">
                    <button
                      class="secondary-action"
                      type="button"
                      disabled={
                        busy() === "ssh-key-add" || !sshKeyLabel().trim() || !sshPublicKey().trim()
                      }
                      onClick={() => void addSshKey()}
                    >
                      <KeyRound size={16} />
                      {busy() === "ssh-key-add" ? "Adding SSH key" : "Add SSH key"}
                    </button>
                    <button
                      class="danger-action"
                      type="button"
                      disabled={
                        busy() === "ssh-key-remove" ||
                        !verified().sshKeyLabels.length ||
                        !sshKeyRemoveLabel().trim()
                      }
                      onClick={() => void removeSshPublicKey()}
                    >
                      <Trash2 size={16} />
                      {busy() === "ssh-key-remove" ? "Removing SSH key" : "Remove SSH key"}
                    </button>
                  </div>
                </div>
              </WorkbenchSection>

              <WorkbenchSection
                id="backup"
                title="Backup codes"
                summary={
                  verified().pendingBackupCodes.length
                    ? `${verified().pendingBackupCodes.length} pending`
                    : "No staged changes"
                }
              >
                <div class="field-grid">
                  <div class="button-row">
                    <button
                      class="secondary-action"
                      type="button"
                      disabled={busy() === "backup-codes"}
                      onClick={() => void generateBackupCodes()}
                    >
                      <SquareAsterisk size={16} />
                      {busy() === "backup-codes" ? "Generating codes" : "Generate backup codes"}
                    </button>
                    <button
                      class="danger-action"
                      type="button"
                      disabled={busy() === "backup-code-remove"}
                      onClick={() => void removeBackupCodes()}
                    >
                      <Trash2 size={16} />
                      {busy() === "backup-code-remove" ? "Removing codes" : "Remove backup codes"}
                    </button>
                  </div>
                  <Show when={verified().pendingBackupCodes.length}>
                    <div class="code-grid" aria-label="Generated backup codes">
                      <For each={verified().pendingBackupCodes}>
                        {(code) => <code>{code}</code>}
                      </For>
                    </div>
                  </Show>
                </div>
              </WorkbenchSection>
            </div>

            <div class="credential-commit-bar">
              <div>
                <strong>{verified().canCommit ? "Ready to commit" : "Changes not ready"}</strong>
                <span>
                  Stage the required credential changes, then commit once Kanidm allows the update.
                </span>
              </div>
              <div class="button-row">
                <button
                  class="primary-action"
                  type="button"
                  disabled={!verified().canCommit || busy() === "commit"}
                  onClick={() => void commit()}
                >
                  <ClipboardCheck size={16} />{" "}
                  {busy() === "commit" ? "Committing" : "Commit update"}
                </button>
                <button
                  class="danger-action"
                  type="button"
                  disabled={busy() === "cancel"}
                  onClick={() => void cancel()}
                >
                  <Trash2 size={16} /> {busy() === "cancel" ? "Cancelling" : "Cancel update"}
                </button>
              </div>
            </div>
          </div>
        )}
      </Show>
      <Show when={message()}>
        <div class="review-box success">
          <BadgeCheck size={18} />
          <span>{message()}</span>
        </div>
      </Show>
      <ErrorBox error={error} />
    </>
  );
}
