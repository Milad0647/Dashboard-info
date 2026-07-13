import { cookies } from "next/headers";
import { getAdminSessionCookieName } from "@/lib/auth/admin-session";
import { parseSessionTokenSync } from "@/lib/auth/session-node";
import type { AuthSession } from "@/lib/types";

export async function getAuthSession(): Promise<AuthSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(getAdminSessionCookieName())?.value;
  return parseSessionTokenSync(token);
}

export async function requireAuthSession(): Promise<AuthSession> {
  const session = await getAuthSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}

export function isFullAdmin(session: AuthSession): boolean {
  return session.type === "env_admin" || session.role === "admin";
}

/**
 * Owner scope for admin panel data.
 * - Admin: no filter (see all)
 * - Client (کارفرما): no filter (needs all content for scoring/oversight)
 * - Contributor: only their own `userId` rows
 */
export function getOwnerFilter(session: AuthSession): string | null | undefined {
  if (isFullAdmin(session)) return undefined;
  if (session.role === "client") return undefined;
  // Missing userId must not fall through as "unscoped" (undefined).
  return session.userId ?? null;
}
