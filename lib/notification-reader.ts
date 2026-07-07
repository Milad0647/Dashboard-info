import type { AuthSession } from "@/lib/types";

export function getNotificationReaderKey(session: AuthSession): string {
  if (session.userId) return session.userId;
  return `env:${session.email?.trim() || "admin"}`;
}
