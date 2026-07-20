"use server";

import { getAuthSession, isFullAdmin } from "@/lib/auth/get-session";
import { pgListAuditEvents } from "@/lib/db/audit-repository";
import type { AuditCategory, AuditEvent } from "@/lib/audit/types";
import { getTehranDayBoundsIso } from "@/lib/safe-dates";
import { isPostgresConfigured } from "@/lib/utils";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Recent audit events for a single user (admin-only).
 * Heartbeats are excluded so the feed stays meaningful.
 */
export async function getUserAuditEventsAction(
  userId: string,
  limit = 50
): Promise<{ ok: true; events: AuditEvent[] } | { ok: false; error: string }> {
  const session = await getAuthSession();
  if (!session || !isFullAdmin(session)) {
    return { ok: false, error: "دسترسی مجاز نیست." };
  }

  if (!isPostgresConfigured()) {
    return { ok: false, error: "پایگاه‌داده پیکربندی نشده است." };
  }

  const trimmed = userId?.trim() ?? "";
  if (!UUID_RE.test(trimmed)) {
    return { ok: false, error: "شناسه کاربر نامعتبر است." };
  }

  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const events = await pgListAuditEvents({
    actorUserId: trimmed,
    limit: safeLimit,
    excludeHeartbeat: true,
  });

  return { ok: true, events };
}

export type AuditDayEventsOptions = {
  category?: AuditCategory;
  actorUserId?: string;
  search?: string;
  limit?: number;
};

/**
 * All meaningful audit events for a single Tehran calendar day (admin-only).
 * Heartbeats are excluded. Used by the Rasad day calendar tab.
 */
export async function getAuditEventsForDayAction(
  dateIso: string,
  options: AuditDayEventsOptions = {}
): Promise<{ ok: true; events: AuditEvent[] } | { ok: false; error: string }> {
  const session = await getAuthSession();
  if (!session || !isFullAdmin(session)) {
    return { ok: false, error: "دسترسی مجاز نیست." };
  }

  if (!isPostgresConfigured()) {
    return { ok: false, error: "پایگاه‌داده پیکربندی نشده است." };
  }

  const bounds = getTehranDayBoundsIso(dateIso);
  if (!bounds) {
    return { ok: false, error: "تاریخ نامعتبر است." };
  }

  const actorUserId = options.actorUserId?.trim() || undefined;
  if (actorUserId && !UUID_RE.test(actorUserId)) {
    return { ok: false, error: "شناسه کاربر نامعتبر است." };
  }

  const events = await pgListAuditEvents({
    from: bounds.from,
    to: bounds.to,
    category: options.category,
    actorUserId,
    search: options.search?.trim() || undefined,
    limit: Math.min(Math.max(options.limit ?? 500, 1), 500),
    excludeHeartbeat: true,
  });

  return { ok: true, events };
}
