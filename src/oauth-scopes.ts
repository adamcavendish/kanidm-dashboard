export const standardScopes = ["openid", "profile", "email", "groups", "ssh_publickey"];

export const scopeDetails: Record<string, string> = {
  openid: "Required for OIDC",
  profile: "User profile claim",
  email: "Email claim",
  groups: "Group claim",
  ssh_publickey: "SSH key claim",
};
