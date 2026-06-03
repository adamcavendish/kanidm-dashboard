import { createSignal, Show } from "solid-js";
import { ArrowRight, BadgeCheck, ShieldCheck } from "lucide-solid";
import { useConsole } from "../store";
import { AuthFrame } from "../components/auth-frame";
import { LogoMark } from "../components/logo-mark";
import { Link } from "../routing";

export function RecoveryPage() {
  const { branding, config } = useConsole();
  const [email, setEmail] = createSignal("");
  const [submitted, setSubmitted] = createSignal(false);
  const realKanidm = () => config().dataSource.mode === "kanidm";

  function submit(event: SubmitEvent) {
    event.preventDefault();
    if (realKanidm()) return;
    setSubmitted(true);
  }

  return (
    <AuthFrame>
      <form class="auth-card" onSubmit={submit}>
        <div class="auth-brand">
          <LogoMark />
          <h1>Account recovery</h1>
          <p>{branding().companyName}</p>
        </div>
        <Show
          when={realKanidm()}
          fallback={
            <>
              <label>
                Username or email
                <input
                  value={email()}
                  onInput={(event) => setEmail(event.currentTarget.value)}
                  placeholder="ava@aster.example"
                />
              </label>
              <Show when={submitted()}>
                <div class="review-box success">
                  <BadgeCheck size={18} />
                  <span>If that account can recover credentials, instructions have been sent.</span>
                </div>
              </Show>
              <button class="primary-action" type="submit" disabled={!email().trim()}>
                Send recovery instructions
              </button>
            </>
          }
        >
          <div class="review-box">
            <ShieldCheck size={18} />
            <span>Continue through Kanidm's protected recovery form.</span>
          </div>
          <a class="primary-action" href="/ui/recover">
            Open recovery <ArrowRight size={16} />
          </a>
        </Show>
        <Link class="quiet-link" href="/login">
          Return to login
        </Link>
      </form>
    </AuthFrame>
  );
}
