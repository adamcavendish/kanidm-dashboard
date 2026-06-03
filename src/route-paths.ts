export const publicRoutes = [
  "/login",
  "/oauth/consent",
  "/oauth/resume",
  "/oauth/access-denied",
  "/recover",
  "/reset",
  "/logout",
] as const;

export function isPublicRoute(path: string) {
  return publicRoutes.includes(path as (typeof publicRoutes)[number]);
}
