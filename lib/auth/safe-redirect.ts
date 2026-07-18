/**
 * Resolve a post-login redirect path. Only same-origin relative paths under
 * /admin or /campaign are allowed (open-redirect safe).
 */
export function resolveSafeAuthRedirect(next: string | null | undefined): string {
  if (!next) return "/admin";

  const trimmed = next.trim();
  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.includes("://") ||
    trimmed.includes("\\")
  ) {
    return "/admin";
  }

  if (trimmed.startsWith("/admin") || trimmed.startsWith("/campaign")) {
    return trimmed;
  }

  return "/admin";
}
