import { getSql } from "@/lib/db/client";
import { loadDailyPostingLimits } from "@/lib/db/posting-limits-repository";
import {
  dailyContentTypeLimitMessage,
  dailyPostingLimitMessage,
  POSTING_LIMIT_CONTENT_TYPE_LABELS,
  resolveContentTypeDailyMax,
  resolveDailyPostingMax,
} from "@/lib/posting-limits";
import type { ScoreableContentType } from "@/lib/types";
import { getTehranCalendarDateIso } from "@/lib/safe-dates";
import {
  DAILY_CAP_MESSAGE,
  normalizeTitleForDuplicate,
  type CampaignScoringPolicy,
} from "@/lib/scoring/scoring-policy";
import { normalizeUserCompanyType } from "@/lib/user-company-types";
import { normalizeUserRegion } from "@/lib/user-regions";
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

export const DAILY_CAP_TABLES = [
  "billboards",
  "posters",
  "videos",
  "campaign_files",
  "raw_media_uploads",
  "social_media_posts",
  "campaign_activities",
  "broadcast_reports",
  "campaign_meetings",
] as const;

export type DailyCapTable = (typeof DAILY_CAP_TABLES)[number];

const TABLE_TO_CONTENT_TYPE: Record<DailyCapTable, ScoreableContentType> = {
  billboards: "billboard",
  posters: "poster",
  videos: "video",
  campaign_files: "file",
  raw_media_uploads: "raw_media",
  social_media_posts: "social_post",
  campaign_activities: "activity",
  broadcast_reports: "broadcast",
  campaign_meetings: "meeting",
};

async function contentRowExists(table: DailyCapTable, id?: string | null): Promise<boolean> {
  if (!id || !isPostgresConfigured()) return false;
  const sql = getSql();
  const rows =
    table === "billboards"
      ? await sql`SELECT 1 FROM billboards WHERE id = ${id} LIMIT 1`
      : table === "posters"
        ? await sql`SELECT 1 FROM posters WHERE id = ${id} LIMIT 1`
        : table === "videos"
          ? await sql`SELECT 1 FROM videos WHERE id = ${id} LIMIT 1`
          : table === "campaign_files"
            ? await sql`SELECT 1 FROM campaign_files WHERE id = ${id} LIMIT 1`
            : table === "raw_media_uploads"
              ? await sql`SELECT 1 FROM raw_media_uploads WHERE id = ${id} LIMIT 1`
              : table === "social_media_posts"
                ? await sql`SELECT 1 FROM social_media_posts WHERE id = ${id} LIMIT 1`
                : table === "campaign_activities"
                  ? await sql`SELECT 1 FROM campaign_activities WHERE id = ${id} LIMIT 1`
                  : table === "broadcast_reports"
                    ? await sql`SELECT 1 FROM broadcast_reports WHERE id = ${id} LIMIT 1`
                    : await sql`SELECT 1 FROM campaign_meetings WHERE id = ${id} LIMIT 1`;
  return Boolean(rows[0]);
}

export async function countTodayContentForOwner(input: {
  campaignId: string;
  ownerUserId: string;
}): Promise<number> {
  if (!isPostgresConfigured()) return 0;
  const sql = getSql();
  const today = getTehranCalendarDateIso();
  const rows = await sql`
    SELECT (
      (SELECT COUNT(*) FROM billboards
        WHERE campaign_id = ${input.campaignId}
          AND owner_user_id = ${input.ownerUserId}
          AND (created_at AT TIME ZONE 'Asia/Tehran')::date = ${today}::date)
      + (SELECT COUNT(*) FROM posters
        WHERE campaign_id = ${input.campaignId}
          AND owner_user_id = ${input.ownerUserId}
          AND (created_at AT TIME ZONE 'Asia/Tehran')::date = ${today}::date)
      + (SELECT COUNT(*) FROM videos
        WHERE campaign_id = ${input.campaignId}
          AND owner_user_id = ${input.ownerUserId}
          AND (created_at AT TIME ZONE 'Asia/Tehran')::date = ${today}::date)
      + (SELECT COUNT(*) FROM campaign_files
        WHERE campaign_id = ${input.campaignId}
          AND owner_user_id = ${input.ownerUserId}
          AND (created_at AT TIME ZONE 'Asia/Tehran')::date = ${today}::date)
      + (SELECT COUNT(*) FROM raw_media_uploads
        WHERE campaign_id = ${input.campaignId}
          AND owner_user_id = ${input.ownerUserId}
          AND (created_at AT TIME ZONE 'Asia/Tehran')::date = ${today}::date)
      + (SELECT COUNT(*) FROM social_media_posts
        WHERE campaign_id = ${input.campaignId}
          AND owner_user_id = ${input.ownerUserId}
          AND (created_at AT TIME ZONE 'Asia/Tehran')::date = ${today}::date)
      + (SELECT COUNT(*) FROM campaign_activities
        WHERE campaign_id = ${input.campaignId}
          AND owner_user_id = ${input.ownerUserId}
          AND (created_at AT TIME ZONE 'Asia/Tehran')::date = ${today}::date)
      + (SELECT COUNT(*) FROM broadcast_reports
        WHERE campaign_id = ${input.campaignId}
          AND owner_user_id = ${input.ownerUserId}
          AND (created_at AT TIME ZONE 'Asia/Tehran')::date = ${today}::date)
      + (SELECT COUNT(*) FROM campaign_meetings
        WHERE campaign_id = ${input.campaignId}
          AND owner_user_id = ${input.ownerUserId}
          AND (created_at AT TIME ZONE 'Asia/Tehran')::date = ${today}::date)
    )::int AS count
  `;
  return Number(rows[0]?.count) || 0;
}

export async function countTodayContentByType(input: {
  campaignId: string;
  ownerUserId: string;
  contentType: ScoreableContentType;
}): Promise<number> {
  if (!isPostgresConfigured()) return 0;
  const sql = getSql();
  const today = getTehranCalendarDateIso();
  const { campaignId, ownerUserId, contentType } = input;

  const rows =
    contentType === "billboard"
      ? await sql`
          SELECT COUNT(*)::int AS count FROM billboards
          WHERE campaign_id = ${campaignId} AND owner_user_id = ${ownerUserId}
            AND (created_at AT TIME ZONE 'Asia/Tehran')::date = ${today}::date
        `
      : contentType === "poster"
        ? await sql`
            SELECT COUNT(*)::int AS count FROM posters
            WHERE campaign_id = ${campaignId} AND owner_user_id = ${ownerUserId}
              AND (created_at AT TIME ZONE 'Asia/Tehran')::date = ${today}::date
          `
        : contentType === "video"
          ? await sql`
              SELECT COUNT(*)::int AS count FROM videos
              WHERE campaign_id = ${campaignId} AND owner_user_id = ${ownerUserId}
                AND (created_at AT TIME ZONE 'Asia/Tehran')::date = ${today}::date
            `
          : contentType === "file"
            ? await sql`
                SELECT COUNT(*)::int AS count FROM campaign_files
                WHERE campaign_id = ${campaignId} AND owner_user_id = ${ownerUserId}
                  AND (created_at AT TIME ZONE 'Asia/Tehran')::date = ${today}::date
              `
            : contentType === "raw_media"
              ? await sql`
                  SELECT COUNT(*)::int AS count FROM raw_media_uploads
                  WHERE campaign_id = ${campaignId} AND owner_user_id = ${ownerUserId}
                    AND (created_at AT TIME ZONE 'Asia/Tehran')::date = ${today}::date
                `
              : contentType === "site_publication"
                ? await sql`
                    SELECT COUNT(*)::int AS count FROM social_media_posts
                    WHERE campaign_id = ${campaignId} AND owner_user_id = ${ownerUserId}
                      AND platform = 'site'
                      AND (created_at AT TIME ZONE 'Asia/Tehran')::date = ${today}::date
                  `
                : contentType === "social_post"
                  ? await sql`
                      SELECT COUNT(*)::int AS count FROM social_media_posts
                      WHERE campaign_id = ${campaignId} AND owner_user_id = ${ownerUserId}
                        AND platform IS DISTINCT FROM 'site'
                        AND (created_at AT TIME ZONE 'Asia/Tehran')::date = ${today}::date
                    `
                  : contentType === "activity"
                    ? await sql`
                        SELECT COUNT(*)::int AS count FROM campaign_activities
                        WHERE campaign_id = ${campaignId} AND owner_user_id = ${ownerUserId}
                          AND (created_at AT TIME ZONE 'Asia/Tehran')::date = ${today}::date
                      `
                    : contentType === "broadcast"
                      ? await sql`
                          SELECT COUNT(*)::int AS count FROM broadcast_reports
                          WHERE campaign_id = ${campaignId} AND owner_user_id = ${ownerUserId}
                            AND (created_at AT TIME ZONE 'Asia/Tehran')::date = ${today}::date
                        `
                      : await sql`
                          SELECT COUNT(*)::int AS count FROM campaign_meetings
                          WHERE campaign_id = ${campaignId} AND owner_user_id = ${ownerUserId}
                            AND (created_at AT TIME ZONE 'Asia/Tehran')::date = ${today}::date
                        `;

  return Number(rows[0]?.count) || 0;
}

export async function assertUserCategoryDailyLimit(input: {
  campaignId: string;
  ownerUserId: string | null | undefined;
  contentType?: ScoreableContentType;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!input.ownerUserId || !input.campaignId) return { ok: true };
  const config = await loadDailyPostingLimits(input.campaignId);
  if (!config.enabled) return { ok: true };

  const sql = getSql();
  const ownerRows = await sql`
    SELECT region, company_type, province FROM users WHERE id = ${input.ownerUserId} LIMIT 1
  `;
  const dailyMax = resolveDailyPostingMax({
    config,
    userId: input.ownerUserId,
    region: normalizeUserRegion(ownerRows[0]?.region),
    companyType: normalizeUserCompanyType(ownerRows[0]?.company_type),
    province: typeof ownerRows[0]?.province === "string" ? ownerRows[0].province : null,
  });
  if (dailyMax != null) {
    const count = await countTodayContentForOwner({
      campaignId: input.campaignId,
      ownerUserId: input.ownerUserId,
    });
    if (count >= dailyMax) {
      return { ok: false, error: dailyPostingLimitMessage(dailyMax) };
    }
  }

  if (input.contentType) {
    const typeMax = resolveContentTypeDailyMax(config, input.contentType);
    if (typeMax != null) {
      const typeCount = await countTodayContentByType({
        campaignId: input.campaignId,
        ownerUserId: input.ownerUserId,
        contentType: input.contentType,
      });
      if (typeCount >= typeMax) {
        return {
          ok: false,
          error: dailyContentTypeLimitMessage(
            POSTING_LIMIT_CONTENT_TYPE_LABELS[input.contentType],
            typeMax
          ),
        };
      }
    }
  }

  return { ok: true };
}

/** Block first-time content create when the owner's daily quota is full. Updates are skipped. */
export async function denyIfCreateQuotaExceeded(input: {
  campaignId?: string | null;
  ownerUserId?: string | null;
  contentId?: string | null;
  table: DailyCapTable;
  contentType?: ScoreableContentType;
  section?: "poster" | "video";
}): Promise<{ success: false; error: string } | null> {
  if (!input.campaignId) return null;
  if (await contentRowExists(input.table, input.contentId)) return null;

  const categoryCap = await assertUserCategoryDailyLimit({
    campaignId: input.campaignId,
    ownerUserId: input.ownerUserId,
    contentType: input.contentType ?? TABLE_TO_CONTENT_TYPE[input.table],
  });
  if (!categoryCap.ok) return { success: false as const, error: categoryCap.error };

  if (input.section) {
    const sectionCap = await assertDailyCapForCreate({
      campaignId: input.campaignId,
      ownerUserId: input.ownerUserId,
      section: input.section,
    });
    if (!sectionCap.ok) return { success: false as const, error: sectionCap.error };
  }

  return null;
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
