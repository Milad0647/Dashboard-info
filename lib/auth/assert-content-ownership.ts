import { canManageAllContent } from "@/lib/auth/access";
import { getAuthSession } from "@/lib/auth/get-session";
import { getSql } from "@/lib/db/client";
import type { AuthSession } from "@/lib/types";
import { isPostgresConfigured } from "@/lib/utils";

export type OwnedContentTable =
  | "billboards"
  | "posters"
  | "videos"
  | "analytics_metrics"
  | "campaign_submissions"
  | "campaign_files"
  | "raw_media_uploads"
  | "social_media_posts"
  | "social_platform_stats"
  | "broadcast_reports"
  | "campaign_activities"
  | "campaign_meetings"
  | "sms_send_reports";

const OWNED_TABLES = new Set<OwnedContentTable>([
  "billboards",
  "posters",
  "videos",
  "analytics_metrics",
  "campaign_submissions",
  "campaign_files",
  "raw_media_uploads",
  "social_media_posts",
  "social_platform_stats",
  "broadcast_reports",
  "campaign_activities",
  "campaign_meetings",
  "sms_send_reports",
]);

type OwnershipRow = {
  ownerUserId: string | null;
  campaignId: string | null;
};

async function getOwnedRow(
  table: OwnedContentTable,
  id: string
): Promise<OwnershipRow | null> {
  if (!OWNED_TABLES.has(table) || !isPostgresConfigured()) return null;

  const sql = getSql();
  // Table names are allowlisted above — never pass user input as identifier.
  const rows = await sql.unsafe(
    `SELECT owner_user_id, campaign_id FROM ${table} WHERE id = $1 LIMIT 1`,
    [id]
  );

  if (!rows[0]) return null;
  return {
    ownerUserId: rows[0].owner_user_id ? String(rows[0].owner_user_id) : null,
    campaignId: rows[0].campaign_id ? String(rows[0].campaign_id) : null,
  };
}

async function getPosterOwnerFromVersion(versionId: string): Promise<OwnershipRow | null> {
  if (!isPostgresConfigured()) return null;
  const sql = getSql();
  const rows = await sql`
    SELECT p.owner_user_id, p.campaign_id
    FROM poster_versions v
    INNER JOIN posters p ON p.id = v.poster_id
    WHERE v.id = ${versionId}
    LIMIT 1
  `;
  if (!rows[0]) return null;
  return {
    ownerUserId: rows[0].owner_user_id ? String(rows[0].owner_user_id) : null,
    campaignId: rows[0].campaign_id ? String(rows[0].campaign_id) : null,
  };
}

async function getVideoOwnerFromVersion(versionId: string): Promise<OwnershipRow | null> {
  if (!isPostgresConfigured()) return null;
  const sql = getSql();
  const rows = await sql`
    SELECT vdo.owner_user_id, vdo.campaign_id
    FROM video_versions vv
    INNER JOIN videos vdo ON vdo.id = vv.video_id
    WHERE vv.id = ${versionId}
    LIMIT 1
  `;
  if (!rows[0]) return null;
  return {
    ownerUserId: rows[0].owner_user_id ? String(rows[0].owner_user_id) : null,
    campaignId: rows[0].campaign_id ? String(rows[0].campaign_id) : null,
  };
}

/**
 * Full admins and کارفرما may manage all content.
 * Contributors may only mutate rows they own.
 */
export async function assertCanMutateOwnedContent(
  session: AuthSession,
  table: OwnedContentTable | "poster_versions" | "video_versions",
  id: string
): Promise<{ success: false; error: string } | null> {
  if (canManageAllContent(session)) return null;
  if (!isPostgresConfigured()) return null;

  const row =
    table === "poster_versions"
      ? await getPosterOwnerFromVersion(id)
      : table === "video_versions"
        ? await getVideoOwnerFromVersion(id)
        : await getOwnedRow(table, id);

  if (!row) return { success: false, error: "مورد یافت نشد" };
  if (!session.userId || row.ownerUserId !== session.userId) {
    return { success: false, error: "دسترسی ندارید" };
  }
  return null;
}

/**
 * For upsert saves that send a client-generated id on create:
 * skip ownership when the row does not exist yet; enforce it on updates.
 */
export async function assertCanMutateOwnedContentIfExists(
  session: AuthSession,
  table: OwnedContentTable,
  id: string
): Promise<{ success: false; error: string } | null> {
  if (canManageAllContent(session)) return null;
  if (!isPostgresConfigured()) return null;

  const row = await getOwnedRow(table, id);
  if (!row) return null;
  if (!session.userId || row.ownerUserId !== session.userId) {
    return { success: false, error: "دسترسی ندارید" };
  }
  return null;
}

export async function assertCanMutateOwnedContentFromSession(
  table: OwnedContentTable | "poster_versions" | "video_versions",
  id: string
): Promise<{ success: false; error: string } | null> {
  const session = await getAuthSession();
  if (!session) return { success: false, error: "Unauthorized" };
  return assertCanMutateOwnedContent(session, table, id);
}
