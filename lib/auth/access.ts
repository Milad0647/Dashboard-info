import type { AuthSession } from "@/lib/types";
import { isFullAdmin } from "@/lib/auth/get-session";

export function isClientUser(session: AuthSession): boolean {
  return session.role === "client";
}

export function canAccessNotifications(session: AuthSession): boolean {
  return isFullAdmin(session) || isClientUser(session);
}
