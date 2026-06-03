import { For } from "solid-js";
import { ArrowRight, Check } from "lucide-solid";
import { useConsole } from "../store";
import AppIcon from "../components/app-icon";
import KeyValue from "../components/key-value";
import { AuthFrame } from "../components/auth-frame";
import { oauthAccessDeniedHref, oauthAllowHref, oauthRequestFromLocation } from "../utils/oauth";

export function OAuthConsentPage() {
  const { state, currentUser } = useConsole();
  const request = () => oauthRequestFromLocation(state().apps);
  return (
    <AuthFrame>
      <section class="auth-card wide-auth">
        <div class="auth-brand compact-brand">
          <AppIcon app={request().app} />
          <h1>{request().app.displayName}</h1>
          <p>Authenticate as {currentUser().displayName} to continue.</p>
        </div>
        <div class="intent-token">
          <KeyValue label="Client" value={request().clientId} />
          <KeyValue label="Redirect URI" value={request().redirectUri || "Not provided"} />
          <KeyValue label="State" value={request().stateValue || "Not provided"} />
        </div>
        <div class="scope-list">
          <For each={request().scopes}>
            {(scope) => (
              <span>
                <Check size={14} /> {scope}
              </span>
            )}
          </For>
        </div>
        <div class="button-row">
          <a class="secondary-action" href={oauthAccessDeniedHref(request())}>
            Deny
          </a>
          <a class="primary-action" href={oauthAllowHref(request())}>
            Allow access <ArrowRight size={16} />
          </a>
        </div>
      </section>
    </AuthFrame>
  );
}
