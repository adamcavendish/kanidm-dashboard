import type { Person, UserAuthTokenStatus } from "../domain";

export function methodLabel(method: string) {
  const labels: Record<string, string> = {
    password: "Password",
    passkey: "Passkey",
    "security-key": "Security key",
    backup: "Backup",
    totp: "TOTP",
  };
  return labels[method] ?? method;
}

export function mechanismCopy(method: string) {
  if (method === "passkey") return "Use a platform passkey registered to this account.";
  if (method === "security-key") return "Insert or tap a registered security key.";
  if (method === "backup") return "Enter one of your remaining backup codes.";
  return "Enter the current code from your authenticator app.";
}

export function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function credentialLabel(status: Person["credential"]["password"]) {
  if (status === "healthy") return "Healthy";
  if (status === "needs-update") return "Needs update";
  return "Missing";
}

export function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function sessionStateLabel(session: UserAuthTokenStatus) {
  if (session.state === "revoked") return "Revoked";
  if (session.state === "neverexpires") return "Never expires";
  return `Expires ${formatDateTime(session.state.expiresAt)}`;
}

export function shortId(value: string) {
  return value.length > 12 ? value.slice(0, 8) : value;
}
