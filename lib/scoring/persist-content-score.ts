import { getSql } from "@/lib/db/client";
import { isReviewableContentType } from "@/lib/content-review/types";
import {
  computeContentScore,
  computeOfficialScore,
} from "@/lib/scoring/compute-content-score";
import { normalizeScoringRules } from "@/lib/scoring/normalize-scoring-rules";
import { SCORE_TABLE_BY_TYPE } from "@/lib/scoring/score-tables";
import {
  mapBillboardFromDb,
  mapBroadcastReportFromDb,
  mapCampaignActivityFromDb,
  mapCampaignFileFromDb,
  mapMeetingFromDb,
  mapPosterFromDb,
  mapRawMediaUploadFromDb,
  mapSettingsFromDb,
  mapSocialPostFromDb,
  mapVideoFromDb,
} from "@/lib/db/mappers";
import { pgGetContentReview } from "@/lib/db/content-review-repository";
import type {
  CampaignScoringConfig,
  ScoreableContentType,
} from "@/lib/types";
import { isPostgresConfigured } from "@/lib/utils";

export { SCORE_TABLE_BY_TYPE } from "@/lib/scoring/score-tables";

const ALL_SCOREABLE_TYPES: ScoreableContentType[] = [
  "billboard",
  "poster",
  "video",
  "file",
  "raw_media",
  "social_post",
  "site_publication",
  "activity",
  "broadcast",
  "meeting",
];

function asRecord(item: object): Record<string, unknown> {
  return item as Record<string, unknown>;
}

async function loadCampaignScoringConfig(campaignId: string): Promise<CampaignScoringConfig> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM campaign_settings WHERE id = ${campaignId} LIMIT 1
  `;
  if (!rows[0]) return normalizeScoringRules(null);
  const settings = mapSettingsFromDb(rows[0]);
  return normalizeScoringRules(settings.scoringRules ?? {});
}

async function loadContentItem(
  contentType: ScoreableContentType,
  campaignId: string,
  contentId: string
): Promise<Record<string, unknown> | null> {
  const sql = getSql();

  if (contentType === "billboard") {
    const rows = await sql`
      SELECT b.*, u.province AS owner_province, u.city AS owner_city, u.region AS owner_region
      FROM billboards b
      LEFT JOIN users u ON u.id = b.owner_user_id
      WHERE b.id = ${contentId} AND b.campaign_id = ${campaignId}
      LIMIT 1
    `;
    return rows[0] ? asRecord(mapBillboardFromDb(rows[0])) : null;
  }
  if (contentType === "poster") {
    const rows = await sql`
      SELECT p.*, u.province AS owner_province, u.city AS owner_city, u.region AS owner_region
      FROM posters p
      LEFT JOIN users u ON u.id = p.owner_user_id
      WHERE p.id = ${contentId} AND p.campaign_id = ${campaignId}
      LIMIT 1
    `;
    return rows[0] ? asRecord(mapPosterFromDb(rows[0])) : null;
  }
  if (contentType === "video") {
    const rows = await sql`
      SELECT v.*, u.province AS owner_province, u.city AS owner_city, u.region AS owner_region
      FROM videos v
      LEFT JOIN users u ON u.id = v.owner_user_id
      WHERE v.id = ${contentId} AND v.campaign_id = ${campaignId}
      LIMIT 1
    `;
    return rows[0] ? asRecord(mapVideoFromDb(rows[0])) : null;
  }
  if (contentType === "file") {
    const rows = await sql`
      SELECT f.*, u.province AS owner_province, u.city AS owner_city, u.region AS owner_region
      FROM campaign_files f
      LEFT JOIN users u ON u.id = f.owner_user_id
      WHERE f.id = ${contentId} AND f.campaign_id = ${campaignId}
      LIMIT 1
    `;
    return rows[0] ? asRecord(mapCampaignFileFromDb(rows[0])) : null;
  }
  if (contentType === "raw_media") {
    const rows = await sql`
      SELECT r.*, u.province AS owner_province, u.city AS owner_city, u.region AS owner_region
      FROM raw_media_uploads r
      LEFT JOIN users u ON u.id = r.owner_user_id
      WHERE r.id = ${contentId} AND r.campaign_id = ${campaignId}
      LIMIT 1
    `;
    return rows[0] ? asRecord(mapRawMediaUploadFromDb(rows[0])) : null;
  }
  if (contentType === "social_post" || contentType === "site_publication") {
    const rows = await sql`
      SELECT sp.*, u.province AS owner_province, u.city AS owner_city, u.region AS owner_region
      FROM social_media_posts sp
      LEFT JOIN users u ON u.id = sp.owner_user_id
      WHERE sp.id = ${contentId} AND sp.campaign_id = ${campaignId}
      LIMIT 1
    `;
    if (!rows[0]) return null;
    const mapped = mapSocialPostFromDb(rows[0]);
    if (contentType === "site_publication" && mapped.platform !== "site") return null;
    if (contentType === "social_post" && mapped.platform === "site") return null;
    return asRecord(mapped);
  }
  if (contentType === "activity") {
    const rows = await sql`
      SELECT a.*, u.province AS owner_province, u.city AS owner_city, u.region AS owner_region
      FROM campaign_activities a
      LEFT JOIN users u ON u.id = a.owner_user_id
      WHERE a.id = ${contentId} AND a.campaign_id = ${campaignId}
      LIMIT 1
    `;
    return rows[0] ? asRecord(mapCampaignActivityFromDb(rows[0])) : null;
  }
  if (contentType === "broadcast") {
    const rows = await sql`
      SELECT br.*, u.province AS owner_province, u.city AS owner_city, u.region AS owner_region
      FROM broadcast_reports br
      LEFT JOIN users u ON u.id = br.owner_user_id
      WHERE br.id = ${contentId} AND br.campaign_id = ${campaignId}
      LIMIT 1
    `;
    return rows[0] ? asRecord(mapBroadcastReportFromDb(rows[0])) : null;
  }
  if (contentType === "meeting") {
    const rows = await sql`
      SELECT m.*, u.province AS owner_province, u.city AS owner_city, u.region AS owner_region
      FROM campaign_meetings m
      LEFT JOIN users u ON u.id = m.owner_user_id
      WHERE m.id = ${contentId} AND m.campaign_id = ${campaignId}
      LIMIT 1
    `;
    return rows[0] ? asRecord(mapMeetingFromDb(rows[0])) : null;
  }
  return null;
}

async function updateScoreColumns(
  contentType: ScoreableContentType,
  campaignId: string,
  contentId: string,
  autoScore: number,
  manualScore: number,
  finalScore: number,
  rawScore?: number | null
): Promise<void> {
  const sql = getSql();
  const now = new Date().toISOString();
  const table = SCORE_TABLE_BY_TYPE[contentType];
  const raw = rawScore ?? autoScore;

  if (table === "billboards") {
    await sql`
      UPDATE billboards
      SET auto_score = ${autoScore},
          manual_score = ${manualScore},
          score = ${finalScore},
          raw_score = ${raw},
          updated_at = ${now}
      WHERE id = ${contentId} AND campaign_id = ${campaignId}
    `;
  } else if (table === "posters") {
    await sql`
      UPDATE posters
      SET auto_score = ${autoScore},
          manual_score = ${manualScore},
          score = ${finalScore},
          raw_score = ${raw},
          updated_at = ${now}
      WHERE id = ${contentId} AND campaign_id = ${campaignId}
    `;
  } else if (table === "videos") {
    await sql`
      UPDATE videos
      SET auto_score = ${autoScore},
          manual_score = ${manualScore},
          score = ${finalScore},
          raw_score = ${raw},
          updated_at = ${now}
      WHERE id = ${contentId} AND campaign_id = ${campaignId}
    `;
  } else if (table === "campaign_files") {
    await sql`
      UPDATE campaign_files
      SET auto_score = ${autoScore}, manual_score = ${manualScore}, score = ${finalScore}, updated_at = ${now}
      WHERE id = ${contentId} AND campaign_id = ${campaignId}
    `;
  } else if (table === "raw_media_uploads") {
    await sql`
      UPDATE raw_media_uploads
      SET auto_score = ${autoScore}, manual_score = ${manualScore}, score = ${finalScore}, updated_at = ${now}
      WHERE id = ${contentId} AND campaign_id = ${campaignId}
    `;
  } else if (table === "social_media_posts") {
    await sql`
      UPDATE social_media_posts
      SET auto_score = ${autoScore},
          manual_score = ${manualScore},
          score = ${finalScore},
          raw_score = ${raw},
          updated_at = ${now}
      WHERE id = ${contentId} AND campaign_id = ${campaignId}
    `;
  } else if (table === "campaign_activities") {
    await sql`
      UPDATE campaign_activities
      SET auto_score = ${autoScore}, manual_score = ${manualScore}, score = ${finalScore}, updated_at = ${now}
      WHERE id = ${contentId} AND campaign_id = ${campaignId}
    `;
  } else if (table === "broadcast_reports") {
    await sql`
      UPDATE broadcast_reports
      SET auto_score = ${autoScore}, manual_score = ${manualScore}, score = ${finalScore}, updated_at = ${now}
      WHERE id = ${contentId} AND campaign_id = ${campaignId}
    `;
  } else if (table === "campaign_meetings") {
    await sql`
      UPDATE campaign_meetings
      SET auto_score = ${autoScore}, manual_score = ${manualScore}, score = ${finalScore}, updated_at = ${now}
      WHERE id = ${contentId} AND campaign_id = ${campaignId}
    `;
  }
}

function readManualScore(item: Record<string, unknown>): number {
  const raw = item.manualScore;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  return 0;
}

async function resolveReviewState(
  contentType: ScoreableContentType,
  campaignId: string,
  contentId: string
): Promise<{ requiresApproval: boolean; approved: boolean; everRejected: boolean }> {
  if (!isReviewableContentType(contentType)) {
    return { requiresApproval: false, approved: true, everRejected: false };
  }
  const review = await pgGetContentReview({
    campaignId,
    contentType,
    contentId,
  });
  return {
    requiresApproval: true,
    approved: review?.status === "approved",
    everRejected: Boolean(review?.everRejected),
  };
}

export async function applyAutoScoreToItem(input: {
  campaignId: string;
  contentType: ScoreableContentType;
  contentId: string;
  /** When true, wipe manual bonus (used after rule apply). */
  resetManual?: boolean;
  scoringRules?: CampaignScoringConfig;
  /** Force official score as if approved (used right after approve). */
  forceApproved?: boolean;
  /** Clear official score (used on reject). */
  clearOfficial?: boolean;
}): Promise<{
  success: boolean;
  autoScore?: number;
  manualScore?: number;
  rawScore?: number;
  score?: number;
  error?: string;
}> {
  if (!isPostgresConfigured()) {
    return { success: false, error: "امتیاز خودکار فقط روی دیتابیس فعال است" };
  }

  const scoringRules =
    input.scoringRules ?? (await loadCampaignScoringConfig(input.campaignId));
  const item = await loadContentItem(input.contentType, input.campaignId, input.contentId);
  if (!item) {
    return { success: false, error: "محتوا یافت نشد" };
  }

  const { autoScore, rawScore } = computeContentScore(
    input.contentType,
    item,
    scoringRules
  );
  const manualScore = input.resetManual ? 0 : readManualScore(item);

  let finalScore: number;
  if (input.clearOfficial) {
    finalScore = 0;
  } else {
    const reviewState = await resolveReviewState(
      input.contentType,
      input.campaignId,
      input.contentId
    );
    finalScore = computeOfficialScore({
      autoScore,
      manualScore,
      everRejected: reviewState.everRejected,
      approved: input.forceApproved || reviewState.approved,
      requiresApproval: reviewState.requiresApproval,
    });
  }

  await updateScoreColumns(
    input.contentType,
    input.campaignId,
    input.contentId,
    autoScore,
    manualScore,
    finalScore,
    rawScore
  );

  return { success: true, autoScore, manualScore, rawScore, score: finalScore };
}

/** Persist official score after content approval. */
export async function finalizeOfficialScore(input: {
  campaignId: string;
  contentType: ScoreableContentType;
  contentId: string;
}): Promise<{ success: boolean; score?: number; error?: string }> {
  const result = await applyAutoScoreToItem({
    ...input,
    resetManual: false,
    forceApproved: true,
  });
  return {
    success: result.success,
    score: result.score,
    error: result.error,
  };
}

/** Clear official score when content is rejected for revision. */
export async function clearOfficialScoreOnReject(input: {
  campaignId: string;
  contentType: ScoreableContentType;
  contentId: string;
}): Promise<void> {
  await applyAutoScoreToItem({
    ...input,
    resetManual: false,
    clearOfficial: true,
  });
}

/** Resolve social row to the correct scoreable type from platform. */
export function socialPostScoreableType(platform: string | null | undefined): ScoreableContentType {
  return platform === "site" ? "site_publication" : "social_post";
}

/**
 * Recalculate scores after content create/update. Preserves manual bonus.
 * Safe no-op when Postgres is not configured.
 */
export async function recalculateScoreAfterSave(input: {
  campaignId: string;
  contentType: ScoreableContentType;
  contentId: string;
}): Promise<void> {
  if (!isPostgresConfigured() || !input.campaignId || !input.contentId) return;
  try {
    await applyAutoScoreToItem({
      campaignId: input.campaignId,
      contentType: input.contentType,
      contentId: input.contentId,
      resetManual: false,
    });
  } catch {
    // Do not fail content save if scoring fails
  }
}

async function listIdsForType(
  contentType: ScoreableContentType,
  campaignId: string
): Promise<string[]> {
  const sql = getSql();

  if (contentType === "billboard") {
    const rows = await sql`SELECT id FROM billboards WHERE campaign_id = ${campaignId}`;
    return rows.map((r) => String(r.id));
  }
  if (contentType === "poster") {
    const rows = await sql`SELECT id FROM posters WHERE campaign_id = ${campaignId}`;
    return rows.map((r) => String(r.id));
  }
  if (contentType === "video") {
    const rows = await sql`SELECT id FROM videos WHERE campaign_id = ${campaignId}`;
    return rows.map((r) => String(r.id));
  }
  if (contentType === "file") {
    const rows = await sql`SELECT id FROM campaign_files WHERE campaign_id = ${campaignId}`;
    return rows.map((r) => String(r.id));
  }
  if (contentType === "raw_media") {
    const rows = await sql`SELECT id FROM raw_media_uploads WHERE campaign_id = ${campaignId}`;
    return rows.map((r) => String(r.id));
  }
  if (contentType === "social_post") {
    const rows = await sql`
      SELECT id FROM social_media_posts
      WHERE campaign_id = ${campaignId} AND platform IS DISTINCT FROM 'site'
    `;
    return rows.map((r) => String(r.id));
  }
  if (contentType === "site_publication") {
    const rows = await sql`
      SELECT id FROM social_media_posts
      WHERE campaign_id = ${campaignId} AND platform = 'site'
    `;
    return rows.map((r) => String(r.id));
  }
  if (contentType === "activity") {
    const rows = await sql`SELECT id FROM campaign_activities WHERE campaign_id = ${campaignId}`;
    return rows.map((r) => String(r.id));
  }
  if (contentType === "broadcast") {
    const rows = await sql`SELECT id FROM broadcast_reports WHERE campaign_id = ${campaignId}`;
    return rows.map((r) => String(r.id));
  }
  if (contentType === "meeting") {
    const rows = await sql`SELECT id FROM campaign_meetings WHERE campaign_id = ${campaignId}`;
    return rows.map((r) => String(r.id));
  }
  return [];
}

/**
 * Recalculate all scoreable content in a campaign.
 * Resets manual_score to 0 (used when applying new scoring rules).
 */
export async function recalculateCampaignScores(input: {
  campaignId: string;
  scoringRules?: CampaignScoringConfig;
  resetManual?: boolean;
}): Promise<{ success: boolean; updated: number; error?: string }> {
  if (!isPostgresConfigured()) {
    return { success: false, updated: 0, error: "امتیاز خودکار فقط روی دیتابیس فعال است" };
  }

  const scoringRules =
    input.scoringRules ?? (await loadCampaignScoringConfig(input.campaignId));
  const resetManual = input.resetManual ?? true;
  let updated = 0;

  for (const contentType of ALL_SCOREABLE_TYPES) {
    const ids = await listIdsForType(contentType, input.campaignId);
    for (const contentId of ids) {
      const result = await applyAutoScoreToItem({
        campaignId: input.campaignId,
        contentType,
        contentId,
        resetManual,
        scoringRules,
      });
      if (result.success) updated += 1;
    }
  }

  return { success: true, updated };
}

export async function saveCampaignScoringRules(
  campaignId: string,
  scoringRules: CampaignScoringConfig
): Promise<{ success: boolean; error?: string }> {
  if (!isPostgresConfigured()) {
    return { success: false, error: "ذخیره قوانین فقط روی دیتابیس فعال است" };
  }
  const sql = getSql();
  const now = new Date().toISOString();
  const normalized = normalizeScoringRules(scoringRules);
  await sql`
    UPDATE campaign_settings
    SET scoring_rules = ${sql.json(JSON.parse(JSON.stringify(normalized)))},
        updated_at = ${now}
    WHERE id = ${campaignId}
  `;
  return { success: true };
}

/** @deprecated Policy no longer drives scoring; kept for backup/settings compatibility. */
export async function saveCampaignScoringPolicy(
  campaignId: string,
  scoringPolicy: unknown
): Promise<{ success: boolean; error?: string }> {
  if (!isPostgresConfigured()) {
    return { success: false, error: "ذخیره سیاست امتیاز فقط روی دیتابیس فعال است" };
  }
  const sql = getSql();
  const now = new Date().toISOString();
  await sql`
    UPDATE campaign_settings
    SET scoring_policy = ${sql.json(JSON.parse(JSON.stringify(scoringPolicy ?? {})))},
        updated_at = ${now}
    WHERE id = ${campaignId}
  `;
  return { success: true };
}

export async function setManualScore(input: {
  campaignId: string;
  contentType: ScoreableContentType;
  contentId: string;
  manualScore: number | null;
}): Promise<{
  success: boolean;
  autoScore?: number;
  manualScore?: number;
  score?: number;
  error?: string;
}> {
  if (!isPostgresConfigured()) {
    return { success: false, error: "ذخیره امتیاز فقط روی دیتابیس فعال است" };
  }

  const item = await loadContentItem(input.contentType, input.campaignId, input.contentId);
  if (!item) return { success: false, error: "محتوا یافت نشد" };

  const scoringRules = await loadCampaignScoringConfig(input.campaignId);
  const { autoScore, rawScore } = computeContentScore(
    input.contentType,
    item,
    scoringRules
  );
  const manualScore =
    input.manualScore == null || !Number.isFinite(input.manualScore) ? 0 : input.manualScore;

  // Persist manual on the row first via updateScoreColumns after computing official
  item.manualScore = manualScore;
  const reviewState = await resolveReviewState(
    input.contentType,
    input.campaignId,
    input.contentId
  );
  const finalScore = computeOfficialScore({
    autoScore,
    manualScore,
    everRejected: reviewState.everRejected,
    approved: reviewState.approved,
    requiresApproval: reviewState.requiresApproval,
  });

  await updateScoreColumns(
    input.contentType,
    input.campaignId,
    input.contentId,
    autoScore,
    manualScore,
    finalScore,
    rawScore
  );

  return { success: true, autoScore, manualScore, score: finalScore };
}
