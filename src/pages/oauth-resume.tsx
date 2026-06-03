import { ArrowRight } from "lucide-solid";
import { useConsole } from "../store";
import AppIcon from "../components/app-icon";
import KeyValue from "../components/key-value";
import { AuthFrame } from "../components/auth-frame";
import { Link } from "../routing";
import { oauthConsentHref, oauthRequestFromLocation } from "../utils/oauth";

export function OAuthResumePage() {
  const { state } = useConsole();
  const request = () => oauthRequestFromLocation(state().apps);
  return (
    <AuthFrame>
      <section class="auth-card wide-auth">
        <div class="auth-brand compact-brand">
          <AppIcon app={request().app} />
          <h1>Resume sign-in</h1>
          <p>{request().app.displayName}</p>
        </div>
        <div class="intent-token">
          <KeyValue label="Client" value={request().clientId} />
          <KeyValue label="Redirect URI" value={request().redirectUri || "Not provided"} />
          <KeyValue label="Requested scopes" value={request().scopes.join(", ")} />
        </div>
        <div class="button-row">
          <Link class="secondary-action" href="/login">
            Return to login
          </Link>
          <a class="primary-action" href={oauthConsentHref(request())}>
            Review access <ArrowRight size={16} />
          </a>
        </div>
      </section>
    </AuthFrame>
  );
}
