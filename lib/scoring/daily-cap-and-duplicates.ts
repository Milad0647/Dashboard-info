import { getSql } from "@/lib/db/client";
import { getTehranCalendarDateIso } from "@/lib/safe-dates";
import {
  DAILY_CAP_MESSAGE,
  normalizeTitleForDuplicate,
  type CampaignScoringPolicy,
} from "@/lib/scoring/scoring-policy";
import { isPostgresConfigured } from "@/lib/utils";

export { DAILY_CAP_MESSAGE };

async function loadPolicy(campaignId: string): Promise<CampaignScoringPolicy | null> {
  if (!isPostgresConfigured()) return null;
  const { mapSettingsFromDb } = await import("@/lib/db/mappers");
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM campaign_settings WHERE id = ${campaignId} LIMIT 1
  `;
  if (!rows[0]) return null;
  return mapSettingsFromDb(rows[0]).scoringPolicy ?? null;
}

/** Count posters created today (Tehran) by this company in the campaign. */
export async function countTodayPostersForOwner(input: {
  campaignId: string;
  ownerUserId: string;
}): Promise<number> {
  if (!isPostgresConfigured()) return 0;
  const sql = getSql();
  const today = getTehranCalendarDateIso();
  const rows = await sql`
    SELECT COUNT(*)::int AS count
    FROM posters
    WHERE campaign_id = ${input.campaignId}
      AND owner_user_id = ${input.ownerUserId}
      AND (created_at AT TIME ZONE 'Asia/Tehran')::date = ${today}::date
  `;
  return Number(rows[0]?.count) || 0;
}

export async function countTodayVideosForOwner(input: {
  campaignId: string;
  ownerUserId: string;
}): Promise<number> {
  if (!isPostgresConfigured()) return 0;
  const sql = getSql();
  const today = getTehranCalendarDateIso();
  const rows = await sql`
    SELECT COUNT(*)::int AS count
    FROM videos
    WHERE campaign_id = ${input.campaignId}
      AND owner_user_id = ${input.ownerUserId}
      AND (created_at AT TIME ZONE 'Asia/Tehran')::date = ${today}::date
  `;
  return Number(rows[0]?.count) || 0;
}

export async function assertDailyCapForCreate(input: {
  campaignId: string;
  ownerUserId: string | null | undefined;
  section: "poster" | "video";
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!input.ownerUserId) return { ok: true };
  const policy = await loadPolicy(input.campaignId);
  if (!policy?.enabled) return { ok: true };

  const max =
    input.section === "poster" ? policy.poster.dailyMaxItems : policy.video.dailyMaxItems;
  if (max <= 0) return { ok: true };

  const count =
    input.section === "poster"
      ? await countTodayPostersForOwner({
          campaignId: input.campaignId,
          ownerUserId: input.ownerUserId,
        })
      : await countTodayVideosForOwner({
          campaignId: input.campaignId,
          ownerUserId: input.ownerUserId,
        });

  if (count >= max) {
    return { ok: false, error: DAILY_CAP_MESSAGE };
  }
  return { ok: true };
}

export async function findDuplicatePosterOrVideo(input: {
  campaignId: string;
  ownerUserId: string;
  section: "poster" | "video";
  title: string;
  contentHash?: string | null;
  excludeId?: string | null;
}): Promise<{ duplicate: boolean; reason?: string }> {
  if (!isPostgresConfigured()) return { duplicate: false };
  const sql = getSql();
  const normalizedTitle = normalizeTitleForDuplicate(input.title);
  const table = input.section === "poster" ? "posters" : "videos";

  if (input.contentHash?.trim()) {
    const hash = input.contentHash.trim();
    const rows =
      table === "posters"
        ? await sql`
            SELECT id, title FROM posters
            WHERE campaign_id = ${input.campaignId}
              AND owner_user_id = ${input.ownerUserId}
              AND content_hash = ${hash}
              AND (${input.excludeId ?? null}::text IS NULL OR id IS DISTINCT FROM ${input.excludeId ?? null})
            LIMIT 1
          `
        : await sql`
            SELECT id, title FROM videos
            WHERE campaign_id = ${input.campaignId}
              AND owner_user_id = ${input.ownerUserId}
              AND content_hash = ${hash}
              AND (${input.excludeId ?? null}::text IS NULL OR id IS DISTINCT FROM ${input.excludeId ?? null})
            LIMIT 1
          `;
    if (rows[0]) {
      return { duplicate: true, reason: "فایل تکراری برای این شرکت قبلاً ثبت شده است." };
    }
  }

  if (!normalizedTitle) return { duplicate: false };

  const titleRows =
    table === "posters"
      ? await sql`
          SELECT id, title FROM posters
          WHERE campaign_id = ${input.campaignId}
            AND owner_user_id = ${input.ownerUserId}
            AND (${input.excludeId ?? null}::text IS NULL OR id IS DISTINCT FROM ${input.excludeId ?? null})
        `
      : await sql`
          SELECT id, title FROM videos
          WHERE campaign_id = ${input.campaignId}
            AND owner_user_id = ${input.ownerUserId}
            AND (${input.excludeId ?? null}::text IS NULL OR id IS DISTINCT FROM ${input.excludeId ?? null})
        `;

  for (const row of titleRows) {
    if (normalizeTitleForDuplicate(String(row.title ?? "")) === normalizedTitle) {
      return { duplicate: true, reason: "عنوان کاملاً یکسان برای این شرکت قبلاً ثبت شده است." };
    }
  }

  return { duplicate: false };
}

/** Duplicate billboard: same company + structure/location + date range + doc hash — not design alone. */
export async function findDuplicateBillboard(input: {
  campaignId: string;
  ownerUserId: string;
  category?: string | null;
  location?: string | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  date?: string | null;
  contentHash?: string | null;
  excludeId?: string | null;
}): Promise<{ duplicate: boolean; reason?: string }> {
  if (!isPostgresConfigured()) return { duplicate: false };
  if (!input.contentHash?.trim()) return { duplicate: false };

  const sql = getSql();
  const hash = input.contentHash.trim();
  const rows = await sql`
    SELECT id, category, location, city, date, latitude, longitude
    FROM billboards
    WHERE campaign_id = ${input.campaignId}
      AND owner_user_id = ${input.ownerUserId}
      AND content_hash = ${hash}
      AND (${input.excludeId ?? null}::text IS NULL OR id IS DISTINCT FROM ${input.excludeId ?? null})
  `;

  for (const row of rows) {
    const sameCategory =
      !input.category || !row.category || String(row.category) === String(input.category);
    const sameLocation =
      !input.location ||
      !row.location ||
      String(row.location).trim() === String(input.location).trim();
    const sameCity =
      !input.city || !row.city || String(row.city).trim() === String(input.city).trim();
    const sameDate =
      !input.date || !row.date || String(row.date).slice(0, 10) === String(input.date).slice(0, 10);
    const sameCoords =
      input.latitude == null ||
      input.longitude == null ||
      row.latitude == null ||
      row.longitude == null ||
      (Math.abs(Number(row.latitude) - Number(input.latitude)) < 0.0001 &&
        Math.abs(Number(row.longitude) - Number(input.longitude)) < 0.0001);

    if (sameCategory && sameLocation && sameCity && sameDate && sameCoords) {
      return {
        duplicate: true,
        reason: "اکران مشابه (سازه، مکان، بازه و مستند یکسان) برای این شرکت قبلاً ثبت شده است.",
      };
    }
  }

  return { duplicate: false };
}
