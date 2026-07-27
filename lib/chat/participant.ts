import type { AuthSession } from "@/lib/types";

export const ENV_ADMIN_PARTICIPANT_KEY = "env_admin";
export const ENV_ADMIN_DISPLAY_NAME = "مدیر سیستم";

const USER_KEY_PREFIX = "user:";

export function userParticipantKey(userId: string): string {
  return `${USER_KEY_PREFIX}${userId}`;
}

export function participantKeyFromSession(session: AuthSession): string {
  if (session.type === "env_admin") return ENV_ADMIN_PARTICIPANT_KEY;
  if (!session.userId) {
    throw new Error("Session has no participant key");
  }
  return userParticipantKey(session.userId);
}

export function tryParticipantKeyFromSession(session: AuthSession): string | null {
  try {
    return participantKeyFromSession(session);
  } catch {
    return null;
  }
}

export function parseParticipantKey(
  key: string
): { type: "env_admin" } | { type: "user"; userId: string } | null {
  if (key === ENV_ADMIN_PARTICIPANT_KEY) return { type: "env_admin" };
  if (key.startsWith(USER_KEY_PREFIX)) {
    const userId = key.slice(USER_KEY_PREFIX.length).trim();
    if (!userId) return null;
    return { type: "user", userId };
  }
  return null;
}

export function userIdFromParticipantKey(key: string): string | null {
  const parsed = parseParticipantKey(key);
  return parsed?.type === "user" ? parsed.userId : null;
}

/** Stable pair so (A,B) and (B,A) map to the same conversation. */
export function normalizeConversationPair(
  a: string,
  b: string
): { participantAKey: string; participantBKey: string } {
  if (a === b) {
    throw new Error("Cannot create a conversation with yourself");
  }
  return a < b
    ? { participantAKey: a, participantBKey: b }
    : { participantAKey: b, participantBKey: a };
}

export function otherParticipantKey(
  participantAKey: string,
  participantBKey: string,
  myKey: string
): string {
  return participantAKey === myKey ? participantBKey : participantAKey;
}
