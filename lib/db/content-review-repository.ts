import { getSql } from "@/lib/db/client";
import {
  REVIEWABLE_CONTENT_TYPES,
  type ContentReview,
  type ContentReviewStatus,
  type ReviewableContentType,
} from "@/lib/content-review/types";
import { SCORE_TABLE_BY_TYPE } from "@/lib/scoring/score-tables";
import { isPostgresConfigured } from "@/lib/utils";

const REVIEWABLE_TYPE_SET = new Set<string>(REVIEWABLE_CONTENT_TYPES);

let contentReviewsReady: Promise<void> | null = null;

function mapRow(row: Record<string, unknown>): ContentReview {
  const toIso = (value: unknown): string | null =>
    value ? new Date(String(value)).toISOString() : null;
  const everRejected =
    row.ever_rejected === true ||
    row.ever_rejected === "t" ||
    row.ever_rejected === 1 ||
    Boolean(row.rejected_at);
  return {
    id: String(row.id),
    campaignId: String(row.campaign_id),
    contentType: row.content_type as ReviewableContentType,
    contentId: String(row.content_id),
    status: row.status as ContentReviewStatus,
    rejectionReason: row.rejection_reason ? String(row.rejection_reason) : null,
    rejectedByUserId: row.rejected_by_user_id ? String(row.rejected_by_user_id) : null,
    rejectedAt: toIso(row.rejected_at),
    resubmittedAt: toIso(row.resubmitted_at),
    resolvedAt: toIso(row.resolved_at),
    everRejected,
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

export async function ensureContentReviewsTable(): Promise<void> {
  if (!isPostgresConfigured()) return;
  if (!contentReviewsReady) {
    contentReviewsReady = (async () => {
      const sql = getSql();
      await sql`
        CREATE TABLE IF NOT EXISTS content_reviews (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          campaign_id UUID NOT NULL REFERENCES campaign_settings(id) ON DELETE CASCADE,
          content_type TEXT NOT NULL
            CHECK (content_type IN (
              'billboard',
              'poster',
              'video',
              'activity',
              'social_post',
              'site_publication'
            )),
          content_id UUID NOT NULL,
          status TEXT NOT NULL
            CHECK (status IN ('needs_revision', 'resubmitted', 'approved'))
            DEFAULT 'needs_revision',
          rejection_reason TEXT,
          rejected_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
          rejected_at TIMESTAMPTZ,
          resubmitted_at TIMESTAMPTZ,
          resolved_at TIMESTAMPTZ,
          ever_rejected BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE (campaign_id, content_type, content_id)
        )
      `;
      await sql`
        ALTER TABLE content_reviews
        ADD COLUMN IF NOT EXISTS ever_rejected BOOLEAN NOT NULL DEFAULT false
      `;
      await sql`
        UPDATE content_reviews
        SET ever_rejected = true
        WHERE rejected_at IS NOT NULL AND ever_rejected = false
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_content_reviews_campaign_status
          ON content_reviews(campaign_id, status, updated_at DESC)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_content_reviews_content
          ON content_reviews(content_type, content_id, updated_at DESC)
      `;
    })().catch((error) => {
      contentReviewsReady = null;
      throw error;
    });
  }
  await contentReviewsReady;
}

export async function pgUpsertContentReview(input: {
  campaignId: string;
  contentType: ReviewableContentType;
  contentId: string;
  status: ContentReviewStatus;
  rejectionReason?: string | null;
  rejectedByUserId?: string | null;
}): Promise<ContentReview | null> {
  if (!isPostgresConfigured()) return null;
  if (!REVIEWABLE_TYPE_SET.has(input.contentType)) return null;
  await ensureContentReviewsTable();
  const sql = getSql();

  const rows = await sql`
    INSERT INTO content_reviews (
      campaign_id,
      content_type,
      content_id,
      status,
      rejection_reason,
      rejected_by_user_id,
      rejected_at,
      resubmitted_at,
      resolved_at,
      ever_rejected,
      updated_at
    ) VALUES (
      ${input.campaignId}::uuid,
      ${input.contentType},
      ${input.contentId}::uuid,
      ${input.status},
      ${input.status === "needs_revision" ? (input.rejectionReason ?? null) : null},
      ${input.status === "needs_revision" ? (input.rejectedByUserId ?? null) : null},
      ${input.status === "needs_revision" ? new Date().toISOString() : null},
      ${input.status === "resubmitted" ? new Date().toISOString() : null},
      ${input.status === "approved" ? new Date().toISOString() : null},
      ${input.status === "needs_revision"},
      ${new Date().toISOString()}
    )
    ON CONFLICT (campaign_id, content_type, content_id) DO UPDATE SET
      status = EXCLUDED.status,
      rejection_reason = CASE
        WHEN EXCLUDED.status = 'needs_revision' THEN EXCLUDED.rejection_reason
        ELSE content_reviews.rejection_reason
      END,
      rejected_by_user_id = CASE
        WHEN EXCLUDED.status = 'needs_revision' THEN EXCLUDED.rejected_by_user_id
        ELSE content_reviews.rejected_by_user_id
      END,
      rejected_at = CASE
        WHEN EXCLUDED.status = 'needs_revision' THEN EXCLUDED.rejected_at
        ELSE content_reviews.rejected_at
      END,
      resubmitted_at = CASE
        WHEN EXCLUDED.status = 'resubmitted' THEN EXCLUDED.resubmitted_at
        ELSE content_reviews.resubmitted_at
      END,
      resolved_at = CASE
        WHEN EXCLUDED.status = 'approved' THEN EXCLUDED.resolved_at
        ELSE content_reviews.resolved_at
      END,
      ever_rejected = CASE
        WHEN EXCLUDED.status = 'needs_revision' THEN true
        ELSE content_reviews.ever_rejected
      END,
      updated_at = EXCLUDED.updated_at
    RETURNING *
  `;

  return rows[0] ? mapRow(rows[0] as Record<string, unknown>) : null;
}

export async function pgGetContentReview(input: {
  campaignId: string;
  contentType: ReviewableContentType;
  contentId: string;
}): Promise<ContentReview | null> {
  if (!isPostgresConfigured()) return null;
  await ensureContentReviewsTable();
  const sql = getSql();
  const rows = await sql`
    SELECT *
    FROM content_reviews
    WHERE campaign_id = ${input.campaignId}::uuid
      AND content_type = ${input.contentType}
      AND content_id = ${input.contentId}::uuid
    LIMIT 1
  `;
  return rows[0] ? mapRow(rows[0] as Record<string, unknown>) : null;
}

export async function pgListContentReviews(input: {
  campaignId: string;
  statuses?: ContentReviewStatus[];
  ownerUserId?: string | null;
  limit?: number;
}): Promise<ContentReview[]> {
  if (!isPostgresConfigured()) return [];
  await ensureContentReviewsTable();
  const sql = getSql();
  const limit = Math.min(Math.max(input.limit ?? 400, 1), 1000);
  const statuses = input.statuses?.length ? input.statuses : null;
  const ownerUserId = input.ownerUserId?.trim() || null;

  const rows = await sql`
    SELECT cr.*
    FROM content_reviews cr
    INNER JOIN (
      SELECT 'billboard'::text AS content_type, id, owner_user_id
      FROM billboards
      WHERE campaign_id = ${input.campaignId}::uuid
      UNION ALL
      SELECT 'poster'::text AS content_type, id, owner_user_id
      FROM posters
      WHERE campaign_id = ${input.campaignId}::uuid
      UNION ALL
      SELECT 'video'::text AS content_type, id, owner_user_id
      FROM videos
      WHERE campaign_id = ${input.campaignId}::uuid
      UNION ALL
      SELECT 'activity'::text AS content_type, id, owner_user_id
      FROM campaign_activities
      WHERE campaign_id = ${input.campaignId}::uuid
      UNION ALL
      SELECT 'social_post'::text AS content_type, id, owner_user_id
      FROM social_media_posts
      WHERE campaign_id = ${input.campaignId}::uuid
        AND platform IS DISTINCT FROM 'site'
      UNION ALL
      SELECT 'site_publication'::text AS content_type, id, owner_user_id
      FROM social_media_posts
      WHERE campaign_id = ${input.campaignId}::uuid
        AND platform = 'site'
    ) c
      ON c.content_type = cr.content_type
     AND c.id = cr.content_id
    WHERE cr.campaign_id = ${input.campaignId}::uuid
      AND (${statuses}::text[] IS NULL OR cr.status = ANY(${statuses}::text[]))
      AND (${ownerUserId}::uuid IS NULL OR c.owner_user_id IS NOT DISTINCT FROM ${ownerUserId}::uuid)
    ORDER BY cr.updated_at DESC
    LIMIT ${limit}
  `;

  return rows.map((row) => mapRow(row as Record<string, unknown>));
}

export async function pgSetContentPublished(input: {
  campaignId: string;
  contentType: ReviewableContentType;
  contentId: string;
  published: boolean;
}): Promise<boolean> {
  if (!isPostgresConfigured()) return false;
  const sql = getSql();
  const table = SCORE_TABLE_BY_TYPE[input.contentType];
  if (!table) return false;

  const result = await sql.unsafe(
    `UPDATE ${table}
     SET published = $1, updated_at = NOW()
     WHERE id = $2::uuid
       AND campaign_id = $3::uuid
     RETURNING id`,
    [input.published, input.contentId, input.campaignId]
  );
  return Boolean(result[0]?.id);
}

