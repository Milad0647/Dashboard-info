const SESSION_COOKIE = "admin_session";
const LEGACY_MOCK_COOKIE = "mock_admin";

export function getAdminSessionCookieName() {
  return SESSION_COOKIE;
}

export function getLegacyMockCookieName() {
  return LEGACY_MOCK_COOKIE;
}

export function verifyAdminCredentials(email: string, password: string): boolean {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";
  if (!adminEmail || !adminPassword) return false;
  if (process.env.NODE_ENV === "production") {
    const weak = new Set(["", "password", "admin", "1234", "123456", "admin123"]);
    if (weak.has(adminPassword.toLowerCase()) || adminPassword.length < 8) return false;
  }
  return email.trim().toLowerCase() === adminEmail && password === adminPassword;
}

/** Prefer database override, then fall back to ADMIN_EMAIL / ADMIN_PASSWORD. */
export { verifyEffectiveAdminCredentials } from "@/lib/auth/admin-credentials";

export {
  buildEnvAdminPayload as buildAdminSessionToken,
  createSignedSessionToken as createAdminSessionToken,
  parseSessionToken,
  verifyAdminSessionToken,
} from "@/lib/auth/session";

export function getAdminSessionCookieOptions(maxAge = 60 * 60 * 24) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export function isAdminAuthConfigured(): boolean {
  return Boolean(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD);
}
