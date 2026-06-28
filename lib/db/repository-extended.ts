import { getSql } from "@/lib/db/client";
import {
  mapBroadcastReportFromDb,
  mapSocialPostFromDb,
  mapUserFromDb,
} from "@/lib/db/mappers";
import type { AdminUser, BroadcastReport, SocialMediaPost } from "@/lib/types";
import {
  defaultContributorPermissions,
  normalizeContributorPermissions,
  type ContributorPermissions,
} from "@/lib/contributor-permissions";
import { generateId } from "@/lib/utils";
import { hashPassword } from "@/lib/auth/password";

interface CampaignAccessRow {
  campaignId: string;
  permissions: ContributorPermissions;
}

async function loadUserCampaignAccess(userId: string): Promise<CampaignAccessRow[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT campaign_id, permissions FROM user_campaign_access WHERE user_id = ${userId}
  `;
  return rows.map((row) => ({
    campaignId: String(row.campaign_id),
    permissions: normalizeContributorPermissions(row.permissions),
  }));
}

function mapAccessToUser(row: Record<string, unknown>, access: CampaignAccessRow[]): AdminUser {
  return mapUserFromDb(row, access);
}

export async function pgGetUserByEmail(email: string) {
  const sql = getSql();
  const rows = await sql`SELECT * FROM users WHERE email = ${email.toLowerCase().trim()} LIMIT 1`;
  if (!rows[0]) return null;

  const access = await loadUserCampaignAccess(String(rows[0].id));
  return mapAccessToUser(rows[0], access);
}

export async function pgGetUserAuthByEmail(email: string) {
  const sql = getSql();
  const rows = await sql`SELECT * FROM users WHERE email = ${email.toLowerCase().trim()} LIMIT 1`;
  if (!rows[0]) return null;

  const access = await loadUserCampaignAccess(String(rows[0].id));
  const user = mapAccessToUser(rows[0], access);

  return {
    ...user,
    passwordHash: String(rows[0].password_hash),
  };
}

export async function pgGetUserById(id: string) {
  const sql = getSql();
  const rows = await sql`SELECT * FROM users WHERE id = ${id} LIMIT 1`;
  if (!rows[0]) return null;

  const access = await loadUserCampaignAccess(id);
  return mapAccessToUser(rows[0], access);
}

export async function pgGetUserPermissionsForCampaign(userId: string, campaignId: string) {
  const sql = getSql();
  const rows = await sql`
    SELECT permissions FROM user_campaign_access
    WHERE user_id = ${userId} AND campaign_id = ${campaignId}
    LIMIT 1
  `;
  if (!rows[0]) return null;
  return normalizeContributorPermissions(rows[0].permissions);
}

export async function pgGetAllUsers(): Promise<AdminUser[]> {
  const sql = getSql();
  const rows = await sql`SELECT * FROM users ORDER BY created_at DESC`;
  const users: AdminUser[] = [];

  for (const row of rows) {
    const access = await loadUserCampaignAccess(String(row.id));
    users.push(mapAccessToUser(row, access));
  }

  return users;
}

export async function pgSaveUser(data: {
  id?: string;
  email: string;
  name: string;
  role: "admin" | "contributor";
  password?: string;
  campaignIds?: string[];
  campaignPermissions?: Record<string, ContributorPermissions>;
}) {
  const sql = getSql();
  const id = data.id ?? generateId();
  const email = data.email.toLowerCase().trim();
  const now = new Date().toISOString();

  if (data.id) {
    if (data.password) {
      const passwordHash = await hashPassword(data.password);
      await sql`
        UPDATE users SET
          email = ${email},
          name = ${data.name},
          role = ${data.role},
          password_hash = ${passwordHash}
        WHERE id = ${id}
      `;
    } else {
      await sql`
        UPDATE users SET email = ${email}, name = ${data.name}, role = ${data.role}
        WHERE id = ${id}
      `;
    }
  } else {
    if (!data.password) {
      return { success: false as const, error: "رمز عبور الزامی است" };
    }
    const passwordHash = await hashPassword(data.password);
    await sql`
      INSERT INTO users (id, email, password_hash, name, role, created_at)
      VALUES (${id}, ${email}, ${passwordHash}, ${data.name}, ${data.role}, ${now})
    `;
  }

  await sql`DELETE FROM user_campaign_access WHERE user_id = ${id}`;
  for (const campaignId of data.campaignIds ?? []) {
    const permissions = normalizeContributorPermissions(
      data.campaignPermissions?.[campaignId] ?? defaultContributorPermissions()
    );
    await sql`
      INSERT INTO user_campaign_access (user_id, campaign_id, permissions, created_at)
      VALUES (
        ${id},
        ${campaignId},
        ${sql.json(JSON.parse(JSON.stringify(permissions)))},
        ${now}
      )
      ON CONFLICT (user_id, campaign_id) DO UPDATE SET
        permissions = EXCLUDED.permissions
    `;
  }

  return { success: true as const, id };
}

export async function pgDeleteUser(id: string) {
  const sql = getSql();
  await sql`DELETE FROM users WHERE id = ${id}`;
  return { success: true };
}

export async function pgGetSocialPosts(
  campaignId: string,
  ownerUserId?: string | null
): Promise<SocialMediaPost[]> {
  const sql = getSql();
  const rows =
    ownerUserId === undefined
      ? await sql`
          SELECT sp.*, u.name AS owner_name
          FROM social_media_posts sp
          LEFT JOIN users u ON u.id = sp.owner_user_id
          WHERE sp.campaign_id = ${campaignId}
          ORDER BY sp.sort_order, sp.published_date DESC
        `
      : await sql`
          SELECT sp.*, u.name AS owner_name
          FROM social_media_posts sp
          LEFT JOIN users u ON u.id = sp.owner_user_id
          WHERE sp.campaign_id = ${campaignId}
            AND sp.owner_user_id IS NOT DISTINCT FROM ${ownerUserId}
          ORDER BY sp.sort_order, sp.published_date DESC
        `;

  return rows.map(mapSocialPostFromDb);
}

export async function pgSaveSocialPost(data: Partial<SocialMediaPost> & { id?: string }) {
  const sql = getSql();
  const now = new Date().toISOString();
  const id = data.id ?? generateId();

  const countRows = await sql`
    SELECT COUNT(*)::int AS count FROM social_media_posts WHERE campaign_id = ${data.campaignId ?? ""}
  `;
  const sortOrder = data.sortOrder ?? (Number(countRows[0]?.count) || 0) + 1;

  await sql`
    INSERT INTO social_media_posts (
      id, campaign_id, owner_user_id, platform, title, cover_image_url,
      views, likes, comments, shares, link, content_type, media_url, description,
      published_date, published, sort_order, created_at, updated_at
    ) VALUES (
      ${id},
      ${data.campaignId ?? ""},
      ${data.ownerUserId ?? null},
      ${data.platform ?? "instagram"},
      ${data.title ?? ""},
      ${data.coverImageUrl ?? null},
      ${data.views ?? 0},
      ${data.likes ?? 0},
      ${data.comments ?? 0},
      ${data.shares ?? 0},
      ${data.link ?? ""},
      ${data.contentType ?? "image"},
      ${data.mediaUrl ?? null},
      ${data.description ?? null},
      ${data.publishedDate ?? now.split("T")[0]},
      ${data.published ?? false},
      ${sortOrder},
      ${now},
      ${now}
    )
    ON CONFLICT (id) DO UPDATE SET
      platform = EXCLUDED.platform,
      title = EXCLUDED.title,
      cover_image_url = EXCLUDED.cover_image_url,
      views = EXCLUDED.views,
      likes = EXCLUDED.likes,
      comments = EXCLUDED.comments,
      shares = EXCLUDED.shares,
      link = EXCLUDED.link,
      content_type = EXCLUDED.content_type,
      media_url = EXCLUDED.media_url,
      description = EXCLUDED.description,
      published_date = EXCLUDED.published_date,
      published = EXCLUDED.published,
      sort_order = EXCLUDED.sort_order,
      updated_at = EXCLUDED.updated_at
  `;

  return { success: true, id };
}

export async function pgDeleteSocialPost(id: string) {
  const sql = getSql();
  await sql`DELETE FROM social_media_posts WHERE id = ${id}`;
  return { success: true };
}

export async function pgGetBroadcastReports(
  campaignId: string,
  ownerUserId?: string | null
): Promise<BroadcastReport[]> {
  const sql = getSql();
  const rows =
    ownerUserId === undefined
      ? await sql`
          SELECT br.*, u.name AS owner_name
          FROM broadcast_reports br
          LEFT JOIN users u ON u.id = br.owner_user_id
          WHERE br.campaign_id = ${campaignId}
          ORDER BY br.sort_order, br.report_date DESC
        `
      : await sql`
          SELECT br.*, u.name AS owner_name
          FROM broadcast_reports br
          LEFT JOIN users u ON u.id = br.owner_user_id
          WHERE br.campaign_id = ${campaignId}
            AND br.owner_user_id IS NOT DISTINCT FROM ${ownerUserId}
          ORDER BY br.sort_order, br.report_date DESC
        `;

  return rows.map(mapBroadcastReportFromDb);
}

export async function pgSaveBroadcastReport(data: Partial<BroadcastReport> & { id?: string }) {
  const sql = getSql();
  const now = new Date().toISOString();
  const id = data.id ?? generateId();

  const countRows = await sql`
    SELECT COUNT(*)::int AS count FROM broadcast_reports WHERE campaign_id = ${data.campaignId ?? ""}
  `;
  const sortOrder = data.sortOrder ?? (Number(countRows[0]?.count) || 0) + 1;

  await sql`
    INSERT INTO broadcast_reports (
      id, campaign_id, owner_user_id, title, report_date, pdf_url, file_name,
      summary_data, published, sort_order, created_at, updated_at
    ) VALUES (
      ${id},
      ${data.campaignId ?? ""},
      ${data.ownerUserId ?? null},
      ${data.title ?? ""},
      ${data.reportDate ?? now.split("T")[0]},
      ${data.pdfUrl ?? ""},
      ${data.fileName ?? ""},
      ${sql.json(JSON.parse(JSON.stringify(data.summaryData ?? {})))},
      ${data.published ?? false},
      ${sortOrder},
      ${now},
      ${now}
    )
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      report_date = EXCLUDED.report_date,
      pdf_url = EXCLUDED.pdf_url,
      file_name = EXCLUDED.file_name,
      summary_data = EXCLUDED.summary_data,
      published = EXCLUDED.published,
      sort_order = EXCLUDED.sort_order,
      updated_at = EXCLUDED.updated_at
  `;

  return { success: true, id };
}

export async function pgDeleteBroadcastReport(id: string) {
  const sql = getSql();
  await sql`DELETE FROM broadcast_reports WHERE id = ${id}`;
  return { success: true };
}

export async function pgGetCampaignBackupData(campaignId: string) {
  const sql = getSql();
  const settings = await sql`SELECT * FROM campaign_settings WHERE id = ${campaignId} LIMIT 1`;
  if (!settings[0]) return null;

  const [
    billboards,
    posterCategories,
    posters,
    posterVersions,
    videoCategories,
    videos,
    videoVersions,
    analytics,
    submissions,
    files,
    socialPosts,
    broadcastReports,
  ] = await Promise.all([
    sql`SELECT * FROM billboards WHERE campaign_id = ${campaignId}`,
    sql`SELECT * FROM media_categories WHERE campaign_id = ${campaignId} AND type = 'poster'`,
    sql`SELECT * FROM posters WHERE campaign_id = ${campaignId}`,
    sql`
      SELECT pv.* FROM poster_versions pv
      INNER JOIN posters p ON p.id = pv.poster_id
      WHERE p.campaign_id = ${campaignId}
    `,
    sql`SELECT * FROM media_categories WHERE campaign_id = ${campaignId} AND type = 'video'`,
    sql`SELECT * FROM videos WHERE campaign_id = ${campaignId}`,
    sql`
      SELECT vv.* FROM video_versions vv
      INNER JOIN videos v ON v.id = vv.video_id
      WHERE v.campaign_id = ${campaignId}
    `,
    sql`SELECT * FROM analytics_metrics WHERE campaign_id = ${campaignId}`,
    sql`SELECT * FROM campaign_submissions WHERE campaign_id = ${campaignId}`,
    sql`SELECT * FROM campaign_files WHERE campaign_id = ${campaignId}`,
    sql`SELECT * FROM social_media_posts WHERE campaign_id = ${campaignId}`,
    sql`SELECT * FROM broadcast_reports WHERE campaign_id = ${campaignId}`,
  ]);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    campaign: settings[0],
    billboards,
    posterCategories,
    posters,
    posterVersions,
    videoCategories,
    videos,
    videoVersions,
    analytics,
    submissions,
    files,
    socialPosts,
    broadcastReports,
  };
}
