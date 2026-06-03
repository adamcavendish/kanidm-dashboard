export function isKanidmPolicyDenial(message: string) {
  return (
    message.includes("accessdenied") ||
    message.includes("AccessDeny") ||
    message.includes("HTTP 403")
  );
}

export function radiusErrorMessage(
  error: unknown,
  fallback: string,
  setPolicyBlocked: (blocked: boolean) => void,
) {
  const message = error instanceof Error ? error.message : "";
  if (isKanidmPolicyDenial(message)) {
    setPolicyBlocked(true);
    return "Kanidm denied RADIUS credential changes for this account.";
  }
  if (message.includes("missingattribute")) {
    return "Kanidm has no RADIUS credential configured for this account.";
  }
  return message || fallback;
}

export function unixErrorMessage(
  error: unknown,
  fallback: string,
  setPolicyBlocked: (blocked: boolean) => void,
) {
  const message = error instanceof Error ? error.message : "";
  if (isKanidmPolicyDenial(message)) {
    setPolicyBlocked(true);
    return "Kanidm denied Unix credential changes for this account.";
  }
  return message || fallback;
}

export function sshKeyErrorMessage(
  error: unknown,
  fallback: string,
  setPolicyBlocked: (blocked: boolean) => void,
) {
  const message = error instanceof Error ? error.message : "";
  if (isKanidmPolicyDenial(message)) {
    setPolicyBlocked(true);
    return "Kanidm denied SSH public-key self-service for this account.";
  }
  return message || fallback;
}
