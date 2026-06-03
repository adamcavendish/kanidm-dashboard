import { isPublicRoute } from "./route-paths";

const returnAfterLoginKey = "kanidm-dashboard-return-after-login";

export function rememberReturnAfterLogin(path: string) {
  if (!path || !path.startsWith("/") || path.startsWith("//") || isPublicRoute(path)) return;
  sessionStorage.setItem(returnAfterLoginKey, path);
}

export function consumeReturnAfterLoginPath() {
  const stored = sessionStorage.getItem(returnAfterLoginKey);
  sessionStorage.removeItem(returnAfterLoginKey);
  if (!stored || !stored.startsWith("/") || stored.startsWith("//") || isPublicRoute(stored)) {
    return "/portal";
  }
  return stored;
}
