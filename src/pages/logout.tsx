import { onMount } from "solid-js";
import { useConsole } from "../store";
import { AuthFrame } from "../components/auth-frame";
import { LogoMark } from "../components/logo-mark";
import { Link } from "../routing";

export function LogoutPage() {
  const { branding, logout } = useConsole();

  onMount(logout);

  return (
    <AuthFrame>
      <section class="auth-card">
        <div class="auth-brand">
          <LogoMark />
          <h1>Signed out</h1>
          <p>Your {branding().companyName} session is closed.</p>
        </div>
        <Link class="primary-action" href="/login">
          Sign in again
        </Link>
      </section>
    </AuthFrame>
  );
}
