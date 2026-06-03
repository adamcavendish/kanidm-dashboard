import { Show } from "solid-js";
import { ArrowRight, CircleAlert } from "lucide-solid";
import { useConsole } from "../store";
import { AuthFrame } from "../components/auth-frame";
import { Link } from "../routing";
import { oauthDeniedRedirectHref, oauthRequestFromLocation } from "../utils/oauth";

export function OAuthAccessDeniedPage() {
  const { state } = useConsole();
  const request = () => oauthRequestFromLocation(state().apps);
  const reason = () =>
    new URLSearchParams(window.location.search).get("error_description") ||
    "The authorization request was denied.";
  return (
    <AuthFrame>
      <section class="auth-card wide-auth">
        <div class="auth-brand compact-brand">
          <CircleAlert size={28} />
          <h1>Access denied</h1>
          <p>{request().app.displayName}</p>
        </div>
        <div class="review-box danger">
          <CircleAlert size={18} />
          <span>{reason()}</span>
        </div>
        <div class="button-row">
          <Link class="secondary-action" href="/login">
            Return to login
          </Link>
          <Show when={request().redirectUri}>
            <a class="primary-action" href={oauthDeniedRedirectHref(request())}>
              Return to application <ArrowRight size={16} />
            </a>
          </Show>
        </div>
      </section>
    </AuthFrame>
  );
}
