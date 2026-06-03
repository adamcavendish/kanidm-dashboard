import type { Application } from "../domain";

export interface OAuthDisplayRequest {
  app: Application;
  clientId: string;
  redirectUri: string;
  stateValue: string;
  scopes: string[];
}

export function oauthRequestFromLocation(apps: Application[]): OAuthDisplayRequest {
  const params = new URLSearchParams(window.location.search);
  const fallbackApp = apps[0];
  const requestedClient = params.get("client_id") || params.get("app") || "";
  const app = apps.find(
    (candidate) =>
      candidate.name === requestedClient ||
      candidate.id === requestedClient ||
      candidate.displayName === requestedClient,
  ) ??
    fallbackApp ?? {
      id: "unknown-oauth-client",
      name: requestedClient || "unknown-oauth-client",
      displayName: requestedClient || "OAuth application",
      landingUrl: "/portal",
      imageUrl: "",
      clientType: "public",
      redirectUris: [],
      allowedGroups: [],
      scopes: ["openid", "profile", "email"],
      status: "attention",
    };

  return {
    app,
    clientId: requestedClient || app.name,
    redirectUri: params.get("redirect_uri") || params.get("resume_uri") || "",
    stateValue: params.get("state") || "",
    scopes: normaliseScopes(params.get("scope") || app.scopes.join(" ")),
  };
}

export function normaliseScopes(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[,\s]+/)
        .map((scope) => scope.trim())
        .filter(Boolean),
    ),
  );
}

export function oauthConsentHref(request: OAuthDisplayRequest) {
  const params = new URLSearchParams({
    client_id: request.clientId,
    scope: request.scopes.join(" "),
  });
  if (request.redirectUri) params.set("redirect_uri", request.redirectUri);
  if (request.stateValue) params.set("state", request.stateValue);
  return `/oauth/consent?${params.toString()}`;
}

export function oauthAccessDeniedHref(request: OAuthDisplayRequest) {
  const params = new URLSearchParams({
    client_id: request.clientId,
    scope: request.scopes.join(" "),
    error_description: "The user denied the authorization request.",
  });
  if (request.redirectUri) params.set("redirect_uri", request.redirectUri);
  if (request.stateValue) params.set("state", request.stateValue);
  return `/oauth/access-denied?${params.toString()}`;
}

export function oauthAllowHref(request: OAuthDisplayRequest) {
  if (!request.redirectUri) return request.app.landingUrl || "/portal";
  return appendOauthResult(request.redirectUri, {
    code: `dashboard-preview-${request.clientId}`,
    state: request.stateValue,
  });
}

export function oauthDeniedRedirectHref(request: OAuthDisplayRequest) {
  if (!request.redirectUri) return "/login";
  return appendOauthResult(request.redirectUri, {
    error: "access_denied",
    error_description: "The user denied the authorization request.",
    state: request.stateValue,
  });
}

function appendOauthResult(target: string, values: Record<string, string>) {
  const url = new URL(target, window.location.origin);
  for (const [key, value] of Object.entries(values)) {
    if (value) url.searchParams.set(key, value);
  }
  return url.href;
}
