import type { AuthSession } from "@/lib/types";
import { isFullAdmin } from "@/lib/auth/get-session";

export function isClientUser(session: AuthSession): boolean {
  return session.role === "client";
}

/** Admin and کارفرما can manage any campaign content and transfer ownership. */
export function canManageAllContent(session: AuthSession): boolean {
  return isFullAdmin(session) || isClientUser(session);
}

export function canTransferContentOwnership(session: AuthSession): boolean {
  return canManageAllContent(session);
}

export function canAccessNotifications(session: AuthSession): boolean {
  return isFullAdmin(session) || isClientUser(session);
}

/**
 * All authenticated panel users can open the directives inbox.
 * Campaign membership is enforced separately when loading data.
 */
export function canViewDirectives(session: AuthSession): boolean {
  return Boolean(session);
}

/** Only admin and client (کارفرما) can create/edit/delete directives. */
export function canManageDirectives(session: AuthSession): boolean {
  return isFullAdmin(session) || isClientUser(session);
}

/** Only admin and client (کارفرما) can score. Contributors never can. */
export function canScoreContent(session: AuthSession): boolean {
  if (isFullAdmin(session)) return true;
  if (isClientUser(session)) return true;
  return false;
}

/** Admin and کارفرما can send content-card messages to owners. */
export function canSendContentMessages(session: AuthSession): boolean {
  return canManageAllContent(session);
}
