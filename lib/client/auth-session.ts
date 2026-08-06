/**
 * Client helpers for expired / missing auth sessions.
 * When a protected API returns 401, send the user back to login immediately
 * so they do not keep hitting upload/action errors with a dead cookie.
 */

let redirectingToLogin = false;

export function redirectToLoginForExpiredSession(): void {
  if (typeof window === "undefined" || redirectingToLogin) return;
  redirectingToLogin = true;

  const path = window.location.pathname + window.location.search;
  const params = new URLSearchParams();
  if (
    (path.startsWith("/admin") && !path.startsWith("/admin/login")) ||
    path.startsWith("/campaign")
  ) {
    params.set("next", path);
  }

  const qs = params.toString();
  window.location.assign(`/admin/login${qs ? `?${qs}` : ""}`);
}

/** Returns true when a redirect was triggered. */
export function redirectIfUnauthorized(response: Response): boolean {
  if (response.status !== 401) return false;
  redirectToLoginForExpiredSession();
  return true;
}
