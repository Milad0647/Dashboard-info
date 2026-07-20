import { getSql } from "@/lib/db/client";
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
import {
  computeContentScore,
  sumFinalScore,
} from "@/lib/scoring/compute-content-score";
import { getRulesForContentType } from "@/lib/scoring/normalize-scoring-rules";
import type {
  CampaignScoringRules,
  ScoreableContentType,
  ScoringRule,
} from "@/lib/types";
import { isPostgresConfigured } from "@/lib/utils";

export const SCORE_TABLE_BY_TYPE: Record<ScoreableContentType, string> = {
  billboard: "billboards",
  poster: "posters",
  video: "videos",
  file: "campaign_files",
  raw_media: "raw_media_uploads",
  social_post: "social_media_posts",
  site_publication: "social_media_posts",
  activity: "campaign_activities",
  broadcast: "broadcast_reports",
  meeting: "campaign_meetings",
};

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

async function loadCampaignScoringRules(
  campaignId: string
): Promise<CampaignScoringRules> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM campaign_settings WHERE id = ${campaignId} LIMIT 1
  `;
  if (!rows[0]) return {};
  return mapSettingsFromDb(rows[0]).scoringRules ?? {};
}

async function loadContentItem(
  contentType: ScoreableContentType,
  campaignId: string,
  contentId: string
): Promise<Record<string, unknown> | null> {
  const sql = getSql();

  if (contentType === "billboard") {
    const rows = await sql`
      SELECT * FROM billboards WHERE id = ${contentId} AND campaign_id = ${campaignId} LIMIT 1
    `;
    return rows[0] ? asRecord(mapBillboardFromDb(rows[0])) : null;
  }
  if (contentType === "poster") {
    const rows = await sql`
      SELECT * FROM posters WHERE id = ${contentId} AND campaign_id = ${campaignId} LIMIT 1
    `;
    return rows[0] ? asRecord(mapPosterFromDb(rows[0])) : null;
  }
  if (contentType === "video") {
    const rows = await sql`
      SELECT * FROM videos WHERE id = ${contentId} AND campaign_id = ${campaignId} LIMIT 1
    `;
    return rows[0] ? asRecord(mapVideoFromDb(rows[0])) : null;
  }
  if (contentType === "file") {
    const rows = await sql`
      SELECT * FROM campaign_files WHERE id = ${contentId} AND campaign_id = ${campaignId} LIMIT 1
    `;
    return rows[0] ? asRecord(mapCampaignFileFromDb(rows[0])) : null;
  }
  if (contentType === "raw_media") {
    const rows = await sql`
      SELECT * FROM raw_media_uploads WHERE id = ${contentId} AND campaign_id = ${campaignId} LIMIT 1
    `;
    return rows[0] ? asRecord(mapRawMediaUploadFromDb(rows[0])) : null;
  }
  if (contentType === "social_post" || contentType === "site_publication") {
    const rows = await sql`
      SELECT * FROM social_media_posts WHERE id = ${contentId} AND campaign_id = ${campaignId} LIMIT 1
    `;
    if (!rows[0]) return null;
    const mapped = mapSocialPostFromDb(rows[0]);
    const expectedPlatform = contentType === "site_publication" ? "site" : mapped.platform;
    if (contentType === "site_publication" && mapped.platform !== "site") return null;
    if (contentType === "social_post" && mapped.platform === "site") return null;
    void expectedPlatform;
    return asRecord(mapped);
  }
  if (contentType === "activity") {
    const rows = await sql`
      SELECT * FROM campaign_activities WHERE id = ${contentId} AND campaign_id = ${campaignId} LIMIT 1
    `;
    return rows[0] ? asRecord(mapCampaignActivityFromDb(rows[0])) : null;
  }
  if (contentType === "broadcast") {
    const rows = await sql`
      SELECT * FROM broadcast_reports WHERE id = ${contentId} AND campaign_id = ${campaignId} LIMIT 1
    `;
    return rows[0] ? asRecord(mapBroadcastReportFromDb(rows[0])) : null;
  }
  if (contentType === "meeting") {
    const rows = await sql`
      SELECT * FROM campaign_meetings WHERE id = ${contentId} AND campaign_id = ${campaignId} LIMIT 1
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
  finalScore: number
): Promise<void> {
  const sql = getSql();
  const now = new Date().toISOString();
  const table = SCORE_TABLE_BY_TYPE[contentType];

  if (table === "billboards") {
    await sql`
      UPDATE billboards
      SET auto_score = ${autoScore}, manual_score = ${manualScore}, score = ${finalScore}, updated_at = ${now}
      WHERE id = ${contentId} AND campaign_id = ${campaignId}
    `;
  } else if (table === "posters") {
    await sql`
      UPDATE posters
      SET auto_score = ${autoScore}, manual_score = ${manualScore}, score = ${finalScore}, updated_at = ${now}
      WHERE id = ${contentId} AND campaign_id = ${campaignId}
    `;
  } else if (table === "videos") {
    await sql`
      UPDATE videos
      SET auto_score = ${autoScore}, manual_score = ${manualScore}, score = ${finalScore}, updated_at = ${now}
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
      SET auto_score = ${autoScore}, manual_score = ${manualScore}, score = ${finalScore}, updated_at = ${now}
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

export async function applyAutoScoreToItem(input: {
  campaignId: string;
  contentType: ScoreableContentType;
  contentId: string;
  /** When true, wipe manual bonus (used after rule apply). */
  resetManual?: boolean;
  scoringRules?: CampaignScoringRules;
}): Promise<{
  success: boolean;
  autoScore?: number;
  manualScore?: number;
  score?: number;
  error?: string;
}> {
  if (!isPostgresConfigured()) {
    return { success: false, error: "امتیاز خودکار فقط روی دیتابیس فعال است" };
  }

  const scoringRules =
    input.scoringRules ?? (await loadCampaignScoringRules(input.campaignId));
  const rules: ScoringRule[] = getRulesForContentType(scoringRules, input.contentType);
  const item = await loadContentItem(input.contentType, input.campaignId, input.contentId);
  if (!item) {
    return { success: false, error: "محتوا یافت نشد" };
  }

  const { autoScore } = computeContentScore(input.contentType, item, rules);
  const manualScore = input.resetManual ? 0 : readManualScore(item);
  const finalScore = sumFinalScore(autoScore, manualScore);

  await updateScoreColumns(
    input.contentType,
    input.campaignId,
    input.contentId,
    autoScore,
    manualScore,
    finalScore
  );

  return { success: true, autoScore, manualScore, score: finalScore };
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
  scoringRules?: CampaignScoringRules;
  resetManual?: boolean;
}): Promise<{ success: boolean; updated: number; error?: string }> {
  if (!isPostgresConfigured()) {
    return { success: false, updated: 0, error: "امتیاز خودکار فقط روی دیتابیس فعال است" };
  }

  const scoringRules =
    input.scoringRules ?? (await loadCampaignScoringRules(input.campaignId));
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
  scoringRules: CampaignScoringRules
): Promise<{ success: boolean; error?: string }> {
  if (!isPostgresConfigured()) {
    return { success: false, error: "ذخیره قوانین فقط روی دیتابیس فعال است" };
  }
  const sql = getSql();
  const now = new Date().toISOString();
  await sql`
    UPDATE campaign_settings
    SET scoring_rules = ${sql.json(JSON.parse(JSON.stringify(scoringRules)))},
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

  const scoringRules = await loadCampaignScoringRules(input.campaignId);
  const rules = getRulesForContentType(scoringRules, input.contentType);
  const { autoScore } = computeContentScore(input.contentType, item, rules);
  const manualScore =
    input.manualScore == null || !Number.isFinite(input.manualScore) ? 0 : input.manualScore;
  const finalScore = sumFinalScore(autoScore, manualScore);

  await updateScoreColumns(
    input.contentType,
    input.campaignId,
    input.contentId,
    autoScore,
    manualScore,
    finalScore
  );

  return { success: true, autoScore, manualScore, score: finalScore };
}
