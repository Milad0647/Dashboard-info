const TEHRAN_TIME_ZONE = "Asia/Tehran";

const tehranDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TEHRAN_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function safeDatePrefix(value?: string | null): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 10) : "";
}

/** Calendar date in Asia/Tehran as YYYY-MM-DD (Iran has no DST). */
export function getTehranCalendarDateIso(date: Date = new Date()): string {
  return tehranDateFormatter.format(date);
}

/**
 * Convert an ISO timestamp (or date-only string) to its Tehran calendar day.
 * Avoids comparing UTC date prefixes against local "today".
 */
export function timestampToTehranDateIso(value?: string | null): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return safeDatePrefix(trimmed);
  }

  return getTehranCalendarDateIso(parsed);
}

/** Offset from Tehran today (0 = today, -1 = yesterday), as YYYY-MM-DD. */
export function getTehranOffsetDateIso(daysFromToday: number): string {
  const now = new Date();
  const tehranToday = getTehranCalendarDateIso(now);
  // Noon UTC avoids DST edge cases when shifting calendar days.
  const base = new Date(`${tehranToday}T12:00:00+03:30`);
  base.setTime(base.getTime() + daysFromToday * 24 * 60 * 60 * 1000);
  return getTehranCalendarDateIso(base);
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Inclusive start/end of a Tehran calendar day as ISO timestamptz strings.
 * Iran has no DST; offset is fixed at +03:30.
 */
export function getTehranDayBoundsIso(
  dateIso: string
): { from: string; to: string } | null {
  const trimmed = dateIso.trim();
  if (!ISO_DATE_RE.test(trimmed)) return null;

  const from = new Date(`${trimmed}T00:00:00+03:30`);
  const to = new Date(`${trimmed}T23:59:59.999+03:30`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;

  return { from: from.toISOString(), to: to.toISOString() };
}

/**
 * Upload time for "new today" badges / charts: prefer createdAt so edits
 * that bump updatedAt do not re-count old content as today's uploads.
 */
export function getSafeCreatedTimestamp(item: {
  createdAt?: string | null;
  updatedAt?: string | null;
}): string {
  const createdAt = typeof item.createdAt === "string" ? item.createdAt.trim() : "";
  if (createdAt) return createdAt;

  const updatedAt = typeof item.updatedAt === "string" ? item.updatedAt.trim() : "";
  return updatedAt;
}

/** Latest activity timestamp (created or updated) — for feeds, not upload-day stats. */
export function getSafeUploadTimestamp(item: {
  createdAt?: string | null;
  updatedAt?: string | null;
}): string {
  const createdAt = typeof item.createdAt === "string" ? item.createdAt.trim() : "";
  const updatedAt = typeof item.updatedAt === "string" ? item.updatedAt.trim() : "";

  if (createdAt && updatedAt) {
    return updatedAt > createdAt ? updatedAt : createdAt;
  }

  return createdAt || updatedAt || "";
}

export function isSameDay(value?: string | null, dayIso?: string): boolean {
  if (!dayIso) return false;
  const tehranDay = timestampToTehranDateIso(value);
  if (!tehranDay) return false;
  return tehranDay === dayIso;
}

export function isTehranToday(value?: string | null): boolean {
  return isSameDay(value, getTehranCalendarDateIso());
}
