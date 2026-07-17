import { getSql } from "@/lib/db/client";
import {
  mapBroadcastReportFromDb,
  mapCampaignActivityFromDb,
  mapMeetingDecisionFromDb,
  mapMeetingFromDb,
  mapMeetingPreviewFromDb,
  mapMeetingPublicDetailFromDb,
  mapMeetingTaskFromDb,
  mapSocialPlatformStatFromDb,
  mapSocialPostFromDb,
  mapUserFromDb,
} from "@/lib/db/mappers";
import type {
  AdminUser,
  BroadcastReport,
  CampaignActivity,
  CampaignMeeting,
  MeetingDecision,
  MeetingPublicDetail,
  MeetingPublicPreview,
  MeetingTask,
  MeetingWithTasks,
  Ownable,
  SocialMediaPost,
  SocialPlatformStat,
} from "@/lib/types";
import { verifyPassword } from "@/lib/auth/password";
import { buildLoginEmailCandidates, normalizeStoredUserEmail } from "@/lib/auth/user-login";
import {
  defaultContributorPermissions,
  normalizeContributorPermissions,
  type ContributorPermissions,
} from "@/lib/contributor-permissions";
import type { ParsedUserImportRow } from "@/lib/services/users-excel-parser";
import { normalizePlanLabels } from "@/lib/content-topics";
import { generateId } from "@/lib/utils";
import { hashPassword } from "@/lib/auth/password";

function resolvePlanFields(data: Partial<Ownable>) {
  const planLabels = normalizePlanLabels(data.planLabels, data.planLabel);
  return {
    planLabel: planLabels[0] ?? null,
    planLabels,
  };
}

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

export async function pgGetUserAuthByLogin(identifier: string) {
  const candidates = buildLoginEmailCandidates(identifier);
  for (const email of candidates) {
    const user = await pgGetUserAuthByEmail(email);
    if (user) return user;
  }
  return null;
}

export async function pgGetUserById(id: string) {
  const sql = getSql();
  const rows = await sql`SELECT * FROM users WHERE id = ${id} LIMIT 1`;
  if (!rows[0]) return null;

  const access = await loadUserCampaignAccess(id);
  return mapAccessToUser(rows[0], access);
}

/** Find a user id by display name (exact match preferred, then contains). */
export async function pgFindUserIdByName(name: string): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const sql = getSql();
  const exact = await sql`
    SELECT id FROM users
    WHERE LOWER(TRIM(name)) = LOWER(${trimmed})
    ORDER BY created_at ASC
    LIMIT 1
  `;
  if (exact[0]?.id) return String(exact[0].id);

  const fuzzy = await sql`
    SELECT id FROM users
    WHERE LOWER(name) LIKE ${`%${trimmed.toLowerCase()}%`}
    ORDER BY created_at ASC
    LIMIT 1
  `;
  return fuzzy[0]?.id ? String(fuzzy[0].id) : null;
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
  role: "admin" | "contributor" | "client";
  password?: string;
  province?: string | null;
  city?: string | null;
  region?: string | null;
  accountManagerName?: string | null;
  campaignIds?: string[];
  campaignPermissions?: Record<string, ContributorPermissions>;
}) {
  const sql = getSql();
  const id = data.id ?? generateId();
  const email = normalizeStoredUserEmail(data.email);
  const now = new Date().toISOString();
  const province = data.province?.trim() || null;
  const city = data.city?.trim() || null;
  const region =
    data.region === "north" ||
    data.region === "south" ||
    data.region === "east" ||
    data.region === "west"
      ? data.region
      : null;
  const accountManagerName = data.accountManagerName?.trim() || null;

  try {
  if (data.id) {
    if (data.password) {
      const passwordHash = await hashPassword(data.password);
      await sql`
        UPDATE users SET
          email = ${email},
          name = ${data.name},
          role = ${data.role},
          province = ${province},
          city = ${city},
          region = ${region},
          account_manager_name = ${accountManagerName},
          password_hash = ${passwordHash}
        WHERE id = ${id}
      `;
    } else {
      await sql`
        UPDATE users SET
          email = ${email},
          name = ${data.name},
          role = ${data.role},
          province = ${province},
          city = ${city},
          region = ${region},
          account_manager_name = ${accountManagerName}
        WHERE id = ${id}
      `;
    }
  } else {
    if (!data.password) {
      return { success: false as const, error: "رمز عبور الزامی است" };
    }
    const passwordHash = await hashPassword(data.password);
    await sql`
      INSERT INTO users (id, email, password_hash, name, role, province, city, region, account_manager_name, created_at)
      VALUES (${id}, ${email}, ${passwordHash}, ${data.name}, ${data.role}, ${province}, ${city}, ${region}, ${accountManagerName}, ${now})
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
  } catch (error) {
    const message = error instanceof Error ? error.message : "ذخیره کاربر ناموفق بود";
    if (message.includes("duplicate key") || message.includes("unique")) {
      return { success: false as const, error: "این نام کاربری قبلاً ثبت شده است" };
    }
    return { success: false as const, error: message };
  }
}

export async function pgUpdateUserRegion(userId: string, region: string | null) {
  const sql = getSql();
  const normalized =
    region === "north" || region === "south" || region === "east" || region === "west"
      ? region
      : null;
  await sql`UPDATE users SET region = ${normalized} WHERE id = ${userId}`;
  return { success: true as const };
}

export async function pgImportUsersFromExcel(params: {
  rows: ParsedUserImportRow[];
  campaignIds: string[];
  campaignPermissions: ContributorPermissions;
  updateExisting: boolean;
}) {
  const sql = getSql();
  const now = new Date().toISOString();
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of params.rows) {
    try {
      const email = normalizeStoredUserEmail(row.username);
      const existingRows = await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
      const permissions = normalizeContributorPermissions(params.campaignPermissions);

      if (existingRows[0]) {
        if (!params.updateExisting) {
          skipped += 1;
          continue;
        }

        const userId = String(existingRows[0].id);
        const passwordHash = await hashPassword(row.password);
        await sql`
          UPDATE users SET
            name = ${row.companyName},
            password_hash = ${passwordHash},
            province = ${row.province},
            city = ${row.city},
            role = 'contributor'
          WHERE id = ${userId}
        `;

        for (const campaignId of params.campaignIds) {
          await sql`
            INSERT INTO user_campaign_access (user_id, campaign_id, permissions, created_at)
            VALUES (
              ${userId},
              ${campaignId},
              ${sql.json(JSON.parse(JSON.stringify(permissions)))},
              ${now}
            )
            ON CONFLICT (user_id, campaign_id) DO UPDATE SET
              permissions = EXCLUDED.permissions
          `;
        }

        updated += 1;
        continue;
      }

      const userId = generateId();
      const passwordHash = await hashPassword(row.password);
      await sql`
        INSERT INTO users (id, email, password_hash, name, role, province, city, created_at)
        VALUES (
          ${userId},
          ${email},
          ${passwordHash},
          ${row.companyName},
          'contributor',
          ${row.province},
          ${row.city},
          ${now}
        )
      `;

      for (const campaignId of params.campaignIds) {
        await sql`
          INSERT INTO user_campaign_access (user_id, campaign_id, permissions, created_at)
          VALUES (
            ${userId},
            ${campaignId},
            ${sql.json(JSON.parse(JSON.stringify(permissions)))},
            ${now}
          )
        `;
      }

      created += 1;
    } catch (error) {
      errors.push(
        `${row.username}: ${error instanceof Error ? error.message : "خطای ناشناخته"}`
      );
    }
  }

  return { created, updated, skipped, errors };
}

export async function pgDeleteUser(id: string) {
  const sql = getSql();
  await sql`DELETE FROM users WHERE id = ${id}`;
  return { success: true };
}

export async function pgDeleteUsers(ids: string[]) {
  if (ids.length === 0) {
    return { success: true, deleted: 0 };
  }

  const sql = getSql();
  await sql`DELETE FROM users WHERE id IN ${sql(ids)}`;
  return { success: true, deleted: ids.length };
}

export async function pgGetSocialPosts(
  campaignId: string,
  ownerUserId?: string | null
): Promise<SocialMediaPost[]> {
  const sql = getSql();
  const rows =
    ownerUserId === undefined
      ? await sql`
          SELECT sp.*, u.name AS owner_name, u.province AS owner_province, u.city AS owner_city
          FROM social_media_posts sp
          LEFT JOIN users u ON u.id = sp.owner_user_id
          WHERE sp.campaign_id = ${campaignId}
          ORDER BY sp.sort_order, sp.published_date DESC
        `
      : await sql`
          SELECT sp.*, u.name AS owner_name, u.province AS owner_province, u.city AS owner_city
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
  const { planLabel, planLabels } = resolvePlanFields(data);

  const countRows = await sql`
    SELECT COUNT(*)::int AS count FROM social_media_posts WHERE campaign_id = ${data.campaignId ?? ""}
  `;
  const sortOrder = data.sortOrder ?? (Number(countRows[0]?.count) || 0) + 1;

  await sql`
    INSERT INTO social_media_posts (
      id, campaign_id, owner_user_id, platform, title, cover_image_url,
      views, likes, comments, shares, link, content_type, media_url, description,
      published_date, published, sort_order, plan_label, plan_labels, created_at, updated_at
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
      ${data.published ?? true},
      ${sortOrder},
      ${planLabel},
      ${sql.json(planLabels)},
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
      owner_user_id = COALESCE(EXCLUDED.owner_user_id, social_media_posts.owner_user_id),
      plan_label = EXCLUDED.plan_label,
      plan_labels = EXCLUDED.plan_labels,
      updated_at = EXCLUDED.updated_at
  `;

  return { success: true, id };
}

export async function pgDeleteSocialPost(id: string) {
  const sql = getSql();
  await sql`DELETE FROM social_media_posts WHERE id = ${id}`;
  return { success: true };
}

export async function pgGetSocialPlatformStatById(id: string): Promise<SocialPlatformStat | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT sps.*, u.name AS owner_name, u.province AS owner_province, u.city AS owner_city
    FROM social_platform_stats sps
    LEFT JOIN users u ON u.id = sps.owner_user_id
    WHERE sps.id = ${id}
    LIMIT 1
  `;
  return rows[0] ? mapSocialPlatformStatFromDb(rows[0]) : null;
}

export async function pgGetSocialPlatformStats(
  campaignId: string,
  ownerUserId?: string | null
): Promise<SocialPlatformStat[]> {
  const sql = getSql();
  const rows =
    ownerUserId === undefined
      ? await sql`
          SELECT sps.*, u.name AS owner_name, u.province AS owner_province, u.city AS owner_city
          FROM social_platform_stats sps
          LEFT JOIN users u ON u.id = sps.owner_user_id
          WHERE sps.campaign_id = ${campaignId}
          ORDER BY sps.sort_order, sps.platform
        `
      : await sql`
          SELECT sps.*, u.name AS owner_name, u.province AS owner_province, u.city AS owner_city
          FROM social_platform_stats sps
          LEFT JOIN users u ON u.id = sps.owner_user_id
          WHERE sps.campaign_id = ${campaignId}
            AND sps.owner_user_id IS NOT DISTINCT FROM ${ownerUserId}
          ORDER BY sps.sort_order, sps.platform
        `;

  return rows.map(mapSocialPlatformStatFromDb);
}

export async function pgSaveSocialPlatformStat(data: Partial<SocialPlatformStat> & { id?: string }) {
  const sql = getSql();
  const now = new Date().toISOString();
  const campaignId = data.campaignId ?? "";
  const ownerUserId = data.ownerUserId ?? null;
  const platform = data.platform ?? "instagram";
  const title = data.title?.trim() || null;
  const followers = data.followers ?? 0;
  const posts = data.posts ?? 0;
  const profileUrl = data.profileUrl ?? null;

  if (data.id) {
    await sql`
      UPDATE social_platform_stats SET
        platform = ${platform},
        title = ${title},
        followers = ${followers},
        posts = ${posts},
        profile_url = ${profileUrl},
        updated_at = ${now}
      WHERE id = ${data.id}
    `;
    return { success: true, id: data.id };
  }

  const countRows = ownerUserId
    ? await sql`
        SELECT COUNT(*)::int AS count
        FROM social_platform_stats
        WHERE campaign_id = ${campaignId} AND owner_user_id = ${ownerUserId}
      `
    : await sql`
        SELECT COUNT(*)::int AS count
        FROM social_platform_stats
        WHERE campaign_id = ${campaignId} AND owner_user_id IS NULL
      `;
  const sortOrder = data.sortOrder ?? (Number(countRows[0]?.count) || 0) + 1;
  const id = generateId();

  await sql`
    INSERT INTO social_platform_stats (
      id, campaign_id, owner_user_id, platform, title, followers, posts, profile_url,
      sort_order, created_at, updated_at
    ) VALUES (
      ${id},
      ${campaignId},
      ${ownerUserId},
      ${platform},
      ${title},
      ${followers},
      ${posts},
      ${profileUrl},
      ${sortOrder},
      ${now},
      ${now}
    )
  `;

  return { success: true, id };
}

export async function pgDeleteSocialPlatformStat(id: string) {
  const sql = getSql();
  await sql`DELETE FROM social_platform_stats WHERE id = ${id}`;
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
          SELECT br.*, u.name AS owner_name, u.province AS owner_province, u.city AS owner_city
          FROM broadcast_reports br
          LEFT JOIN users u ON u.id = br.owner_user_id
          WHERE br.campaign_id = ${campaignId}
          ORDER BY br.sort_order, br.report_date DESC
        `
      : await sql`
          SELECT br.*, u.name AS owner_name, u.province AS owner_province, u.city AS owner_city
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
  const { planLabel, planLabels } = resolvePlanFields(data);

  const countRows = await sql`
    SELECT COUNT(*)::int AS count FROM broadcast_reports WHERE campaign_id = ${data.campaignId ?? ""}
  `;
  const sortOrder = data.sortOrder ?? (Number(countRows[0]?.count) || 0) + 1;

  await sql`
    INSERT INTO broadcast_reports (
      id, campaign_id, owner_user_id, title, report_date, pdf_url, file_name,
      summary_data, published, sort_order, plan_label, plan_labels, created_at, updated_at
    ) VALUES (
      ${id},
      ${data.campaignId ?? ""},
      ${data.ownerUserId ?? null},
      ${data.title ?? ""},
      ${data.reportDate ?? now.split("T")[0]},
      ${data.pdfUrl ?? ""},
      ${data.fileName ?? ""},
      ${sql.json(JSON.parse(JSON.stringify(data.summaryData ?? {})))},
      ${data.published ?? true},
      ${sortOrder},
      ${planLabel},
      ${sql.json(planLabels)},
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
      owner_user_id = COALESCE(EXCLUDED.owner_user_id, broadcast_reports.owner_user_id),
      plan_label = EXCLUDED.plan_label,
      plan_labels = EXCLUDED.plan_labels,
      updated_at = EXCLUDED.updated_at
  `;

  return { success: true, id };
}

export async function pgDeleteBroadcastReport(id: string) {
  const sql = getSql();
  await sql`DELETE FROM broadcast_reports WHERE id = ${id}`;
  return { success: true };
}

export async function pgGetCampaignActivities(
  campaignId: string,
  ownerUserId?: string | null
): Promise<CampaignActivity[]> {
  const sql = getSql();
  const rows =
    ownerUserId === undefined
      ? await sql`
          SELECT ca.*, u.name AS owner_name, u.province AS owner_province, u.city AS owner_city
          FROM campaign_activities ca
          LEFT JOIN users u ON u.id = ca.owner_user_id
          WHERE ca.campaign_id = ${campaignId}
          ORDER BY ca.activity_date DESC, ca.sort_order
        `
      : await sql`
          SELECT ca.*, u.name AS owner_name, u.province AS owner_province, u.city AS owner_city
          FROM campaign_activities ca
          LEFT JOIN users u ON u.id = ca.owner_user_id
          WHERE ca.campaign_id = ${campaignId}
            AND ca.owner_user_id IS NOT DISTINCT FROM ${ownerUserId}
          ORDER BY ca.activity_date DESC, ca.sort_order
        `;

  return rows.map(mapCampaignActivityFromDb);
}

export async function pgSaveCampaignActivity(data: Partial<CampaignActivity> & { id?: string }) {
  const sql = getSql();
  const now = new Date().toISOString();
  const id = data.id ?? generateId();
  const { planLabel, planLabels } = resolvePlanFields(data);

  const countRows = await sql`
    SELECT COUNT(*)::int AS count FROM campaign_activities WHERE campaign_id = ${data.campaignId ?? ""}
  `;
  const sortOrder = data.sortOrder ?? (Number(countRows[0]?.count) || 0) + 1;

  await sql`
    INSERT INTO campaign_activities (
      id, campaign_id, owner_user_id, title, activity_type, activity_date,
      location, image_url, video_url, media_items, description, published, sort_order, plan_label, plan_labels, created_at, updated_at
    ) VALUES (
      ${id},
      ${data.campaignId ?? ""},
      ${data.ownerUserId ?? null},
      ${data.title ?? ""},
      ${data.activityType ?? "other"},
      ${data.activityDate ?? now.split("T")[0]},
      ${data.location ?? ""},
      ${data.imageUrl ?? null},
      ${data.videoUrl ?? null},
      ${sql.json(JSON.parse(JSON.stringify(data.mediaItems ?? [])))},
      ${data.description ?? null},
      ${data.published ?? true},
      ${sortOrder},
      ${planLabel},
      ${sql.json(planLabels)},
      ${now},
      ${now}
    )
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      activity_type = EXCLUDED.activity_type,
      activity_date = EXCLUDED.activity_date,
      location = EXCLUDED.location,
      image_url = EXCLUDED.image_url,
      video_url = EXCLUDED.video_url,
      media_items = EXCLUDED.media_items,
      description = EXCLUDED.description,
      published = EXCLUDED.published,
      sort_order = EXCLUDED.sort_order,
      owner_user_id = COALESCE(EXCLUDED.owner_user_id, campaign_activities.owner_user_id),
      plan_label = EXCLUDED.plan_label,
      plan_labels = EXCLUDED.plan_labels,
      updated_at = EXCLUDED.updated_at
  `;

  return { success: true, id };
}

export async function pgDeleteCampaignActivity(id: string) {
  const sql = getSql();
  await sql`DELETE FROM campaign_activities WHERE id = ${id}`;
  return { success: true };
}

export async function pgGetNotificationReads(readerKey: string): Promise<string[]> {
  const sql = getSql();
  const rows = await sql<{ content_key: string }[]>`
    SELECT content_key FROM user_notification_reads
    WHERE reader_key = ${readerKey}
  `;
  return rows.map((row) => row.content_key);
}

export async function pgMarkNotificationReads(
  readerKey: string,
  contentKeys: string[],
  confirmed = false
) {
  if (contentKeys.length === 0) return { success: true };
  const sql = getSql();
  const now = new Date().toISOString();

  for (const contentKey of contentKeys) {
    await sql`
      INSERT INTO user_notification_reads (reader_key, content_key, seen_at, confirmed)
      VALUES (${readerKey}, ${contentKey}, ${now}, ${confirmed})
      ON CONFLICT (reader_key, content_key) DO UPDATE SET
        seen_at = EXCLUDED.seen_at,
        confirmed = CASE WHEN EXCLUDED.confirmed THEN true ELSE user_notification_reads.confirmed END
    `;
  }

  return { success: true };
}

export interface MeetingTaskPayload {
  id?: string;
  title: string;
  completed: boolean;
  sortOrder: number;
}

export interface MeetingDecisionPayload {
  id?: string;
  title: string;
  sortOrder: number;
}

function groupMeetingTasks(rows: MeetingTask[]): Map<string, MeetingTask[]> {
  const map = new Map<string, MeetingTask[]>();
  for (const task of rows) {
    const list = map.get(task.meetingId) ?? [];
    list.push(task);
    map.set(task.meetingId, list);
  }
  return map;
}

function groupMeetingDecisions(rows: MeetingDecision[]): Map<string, MeetingDecision[]> {
  const map = new Map<string, MeetingDecision[]>();
  for (const decision of rows) {
    const list = map.get(decision.meetingId) ?? [];
    list.push(decision);
    map.set(decision.meetingId, list);
  }
  return map;
}

export async function pgGetPublicMeetingPreviews(campaignId: string): Promise<MeetingPublicPreview[]> {
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT
        m.id,
        m.campaign_id,
        m.meeting_date,
        m.title,
        m.image_url,
        m.discussion_summary,
        m.sort_order,
        m.owner_user_id,
        u.name AS owner_name, u.province AS owner_province, u.city AS owner_city,
        (cs.meetings_view_password_hash IS NOT NULL AND LENGTH(cs.meetings_view_password_hash) > 0) AS has_password
      FROM campaign_meetings m
      INNER JOIN campaign_settings cs ON cs.id = m.campaign_id
      LEFT JOIN users u ON u.id = m.owner_user_id
      WHERE m.campaign_id = ${campaignId}
      ORDER BY m.meeting_date DESC, m.sort_order
    `;

    return rows.map(mapMeetingPreviewFromDb);
  } catch (error) {
    console.error("pgGetPublicMeetingPreviews failed:", error);
    return [];
  }
}

export type MeetingUnlockResult =
  | { status: "ok"; meeting: MeetingPublicDetail }
  | { status: "not_found" }
  | { status: "wrong_password" };

export type CampaignMeetingsUnlockResult =
  | { status: "ok"; meetings: MeetingPublicDetail[] }
  | { status: "not_found" }
  | { status: "wrong_password" };

async function loadMeetingDetailsForCampaign(
  sql: ReturnType<typeof getSql>,
  campaignId: string
): Promise<MeetingPublicDetail[]> {
  const meetingRows = await sql`
    SELECT * FROM campaign_meetings
    WHERE campaign_id = ${campaignId} AND published = true
    ORDER BY meeting_date DESC, sort_order
  `;

  if (meetingRows.length === 0) return [];

  const meetingIds = meetingRows.map((row) => row.id as string);

  const taskRows = await sql`
    SELECT * FROM meeting_tasks
    WHERE meeting_id IN ${sql(meetingIds)}
    ORDER BY sort_order
  `;

  const decisionRows = await sql`
    SELECT * FROM meeting_decisions
    WHERE meeting_id IN ${sql(meetingIds)}
    ORDER BY sort_order
  `;

  const tasksByMeeting = new Map<string, Record<string, unknown>[]>();
  for (const task of taskRows) {
    const meetingId = task.meeting_id as string;
    const list = tasksByMeeting.get(meetingId) ?? [];
    list.push(task);
    tasksByMeeting.set(meetingId, list);
  }

  const decisionsByMeeting = new Map<string, Record<string, unknown>[]>();
  for (const decision of decisionRows) {
    const meetingId = decision.meeting_id as string;
    const list = decisionsByMeeting.get(meetingId) ?? [];
    list.push(decision);
    decisionsByMeeting.set(meetingId, list);
  }

  return meetingRows.map((row) =>
    mapMeetingPublicDetailFromDb(
      row,
      tasksByMeeting.get(row.id as string) ?? [],
      decisionsByMeeting.get(row.id as string) ?? []
    )
  );
}

export async function pgUnlockCampaignMeetings(
  slug: string,
  password: string
): Promise<CampaignMeetingsUnlockResult> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, meetings_view_password_hash
    FROM campaign_settings
    WHERE slug = ${slug} AND published = true
    LIMIT 1
  `;

  if (!rows[0]) return { status: "not_found" };

  const campaignId = rows[0].id as string;
  const hash = rows[0].meetings_view_password_hash as string | null;

  if (hash) {
    const valid = await verifyPassword(password, hash);
    if (!valid) return { status: "wrong_password" };
  }

  const meetings = await loadMeetingDetailsForCampaign(sql, campaignId);
  return { status: "ok", meetings };
}

export async function pgUpdateMeetingsViewPassword(campaignId: string, passwordHash: string | null) {
  const sql = getSql();
  const now = new Date().toISOString();
  await sql`
    UPDATE campaign_settings
    SET meetings_view_password_hash = ${passwordHash}, updated_at = ${now}
    WHERE id = ${campaignId}
  `;
  return { success: true };
}

export async function pgUpdatePageViewPassword(campaignId: string, passwordHash: string | null) {
  const sql = getSql();
  const now = new Date().toISOString();
  await sql`
    UPDATE campaign_settings
    SET page_view_password_hash = ${passwordHash}, updated_at = ${now}
    WHERE id = ${campaignId}
  `;
  return { success: true };
}

export async function pgVerifyCampaignPagePassword(
  slug: string,
  password: string
): Promise<
  | { status: "not_found" }
  | { status: "wrong_password" }
  | { status: "ok"; passwordHash: string | null; title: string }
> {
  const sql = getSql();
  const rows = await sql`
    SELECT title, page_view_password_hash
    FROM campaign_settings
    WHERE slug = ${slug} AND published = true
    LIMIT 1
  `;

  if (!rows[0]) return { status: "not_found" };

  const hash = (rows[0].page_view_password_hash as string | null) ?? null;
  if (hash) {
    const valid = await verifyPassword(password, hash);
    if (!valid) return { status: "wrong_password" };
  }

  return {
    status: "ok",
    passwordHash: hash,
    title: String(rows[0].title ?? ""),
  };
}

export async function pgUnlockMeetingDetail(
  meetingId: string,
  password: string
): Promise<MeetingUnlockResult> {
  const sql = getSql();
  const rows = await sql`
    SELECT m.*, cs.meetings_view_password_hash
    FROM campaign_meetings m
    INNER JOIN campaign_settings cs ON cs.id = m.campaign_id
    WHERE m.id = ${meetingId} AND m.published = true
    LIMIT 1
  `;

  if (!rows[0]) return { status: "not_found" };

  const hash = rows[0].meetings_view_password_hash as string | null;
  if (hash) {
    const valid = await verifyPassword(password, hash);
    if (!valid) return { status: "wrong_password" };
  }

  const taskRows = await sql`
    SELECT * FROM meeting_tasks
    WHERE meeting_id = ${meetingId}
    ORDER BY sort_order
  `;

  const decisionRows = await sql`
    SELECT * FROM meeting_decisions
    WHERE meeting_id = ${meetingId}
    ORDER BY sort_order
  `;

  return {
    status: "ok",
    meeting: mapMeetingPublicDetailFromDb(rows[0], taskRows, decisionRows),
  };
}

export async function pgGetMeetingsWithTasks(
  campaignId: string,
  options?: { publishedOnly?: boolean; ownerUserId?: string | null }
): Promise<MeetingWithTasks[]> {
  try {
    const sql = getSql();
    const publishedOnly = options?.publishedOnly ?? false;
    const ownerUserId = options?.ownerUserId;

    const ownerFilter =
      ownerUserId === undefined ? sql`` : sql`AND m.owner_user_id IS NOT DISTINCT FROM ${ownerUserId}`;
    const publishedFilter = publishedOnly ? sql`AND m.published = true` : sql``;

    const meetingRows = await sql`
      SELECT m.*, u.name AS owner_name, u.province AS owner_province, u.city AS owner_city
      FROM campaign_meetings m
      LEFT JOIN users u ON u.id = m.owner_user_id
      WHERE m.campaign_id = ${campaignId}
      ${ownerFilter}
      ${publishedFilter}
      ORDER BY m.meeting_date DESC, m.sort_order
    `;

    if (meetingRows.length === 0) return [];

    const taskRows = await sql`
      SELECT mt.*
      FROM meeting_tasks mt
      INNER JOIN campaign_meetings m ON m.id = mt.meeting_id
      WHERE m.campaign_id = ${campaignId}
      ${ownerFilter}
      ${publishedFilter}
      ORDER BY mt.sort_order
    `;

    const decisionRows = await sql`
      SELECT md.*
      FROM meeting_decisions md
      INNER JOIN campaign_meetings m ON m.id = md.meeting_id
      WHERE m.campaign_id = ${campaignId}
      ${ownerFilter}
      ${publishedFilter}
      ORDER BY md.sort_order
    `;

    const tasksByMeeting = groupMeetingTasks(taskRows.map(mapMeetingTaskFromDb));
    const decisionsByMeeting = groupMeetingDecisions(decisionRows.map(mapMeetingDecisionFromDb));

    return meetingRows.map((row) => ({
      ...mapMeetingFromDb(row),
      tasks: tasksByMeeting.get(row.id) ?? [],
      decisions: decisionsByMeeting.get(row.id) ?? [],
    }));
  } catch (error) {
    console.error("pgGetMeetingsWithTasks failed:", error);
    return [];
  }
}

export async function pgSaveMeetingWithTasks(
  data: Partial<CampaignMeeting> & { id?: string },
  tasks: MeetingTaskPayload[],
  decisions: MeetingDecisionPayload[] = []
) {
  const sql = getSql();
  const now = new Date().toISOString();
  const id = data.id ?? generateId();

  const countRows = await sql`
    SELECT COUNT(*)::int AS count FROM campaign_meetings WHERE campaign_id = ${data.campaignId ?? ""}
  `;
  const sortOrder = data.sortOrder ?? (Number(countRows[0]?.count) || 0) + 1;
  const attendees = JSON.stringify(data.attendees ?? []);

  if (data.id) {
    await sql`
      INSERT INTO campaign_meetings (
        id, campaign_id, owner_user_id, title, meeting_date, location, image_url,
        discussion_summary, attendees, audio_url, view_password_hash,
        published, sort_order, created_at, updated_at
      ) VALUES (
        ${id},
        ${data.campaignId ?? ""},
        ${data.ownerUserId ?? null},
        ${data.title ?? ""},
        ${data.meetingDate ?? now.split("T")[0]},
        ${data.location ?? ""},
        ${data.imageUrl ?? null},
        ${data.discussionSummary ?? ""},
        ${sql.json(JSON.parse(attendees))},
        ${data.audioUrl ?? null},
        ${null},
        ${data.published ?? false},
        ${sortOrder},
        ${now},
        ${now}
      )
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        meeting_date = EXCLUDED.meeting_date,
        location = EXCLUDED.location,
        image_url = EXCLUDED.image_url,
        discussion_summary = EXCLUDED.discussion_summary,
        attendees = EXCLUDED.attendees,
        audio_url = EXCLUDED.audio_url,
        published = EXCLUDED.published,
        sort_order = EXCLUDED.sort_order,
        owner_user_id = COALESCE(EXCLUDED.owner_user_id, campaign_meetings.owner_user_id),
        updated_at = EXCLUDED.updated_at
      `;
  } else {
    await sql`
      INSERT INTO campaign_meetings (
        id, campaign_id, owner_user_id, title, meeting_date, location, image_url,
        discussion_summary, attendees, audio_url, view_password_hash,
        published, sort_order, created_at, updated_at
      ) VALUES (
        ${id},
        ${data.campaignId ?? ""},
        ${data.ownerUserId ?? null},
        ${data.title ?? ""},
        ${data.meetingDate ?? now.split("T")[0]},
        ${data.location ?? ""},
        ${data.imageUrl ?? null},
        ${data.discussionSummary ?? ""},
        ${sql.json(JSON.parse(attendees))},
        ${data.audioUrl ?? null},
        ${null},
        ${data.published ?? false},
        ${sortOrder},
        ${now},
        ${now}
      )
    `;
  }

  const keptIds: string[] = [];
  for (const task of tasks) {
    const taskId = task.id ?? generateId();
    keptIds.push(taskId);
    await sql`
      INSERT INTO meeting_tasks (
        id, meeting_id, title, completed, sort_order, created_at, updated_at
      ) VALUES (
        ${taskId},
        ${id},
        ${task.title},
        ${task.completed},
        ${task.sortOrder},
        ${now},
        ${now}
      )
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        completed = EXCLUDED.completed,
        sort_order = EXCLUDED.sort_order,
        updated_at = EXCLUDED.updated_at
    `;
  }

  if (keptIds.length === 0) {
    await sql`DELETE FROM meeting_tasks WHERE meeting_id = ${id}`;
  } else {
    await sql`
      DELETE FROM meeting_tasks
      WHERE meeting_id = ${id}
      AND id NOT IN ${sql(keptIds)}
    `;
  }

  const keptDecisionIds: string[] = [];
  for (const decision of decisions) {
    const decisionId = decision.id ?? generateId();
    keptDecisionIds.push(decisionId);
    await sql`
      INSERT INTO meeting_decisions (
        id, meeting_id, title, sort_order, created_at, updated_at
      ) VALUES (
        ${decisionId},
        ${id},
        ${decision.title},
        ${decision.sortOrder},
        ${now},
        ${now}
      )
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        sort_order = EXCLUDED.sort_order,
        updated_at = EXCLUDED.updated_at
    `;
  }

  if (keptDecisionIds.length === 0) {
    await sql`DELETE FROM meeting_decisions WHERE meeting_id = ${id}`;
  } else {
    await sql`
      DELETE FROM meeting_decisions
      WHERE meeting_id = ${id}
      AND id NOT IN ${sql(keptDecisionIds)}
    `;
  }

  return { success: true, id };
}

export async function pgDeleteMeeting(id: string) {
  const sql = getSql();
  await sql`DELETE FROM campaign_meetings WHERE id = ${id}`;
  return { success: true };
}

export async function pgGetMeetingById(id: string) {
  const sql = getSql();
  const rows = await sql`
    SELECT id, campaign_id, owner_user_id
    FROM campaign_meetings
    WHERE id = ${id}
    LIMIT 1
  `;
  if (!rows[0]) return null;
  return {
    id: String(rows[0].id),
    campaignId: String(rows[0].campaign_id),
    ownerUserId: rows[0].owner_user_id ? String(rows[0].owner_user_id) : null,
  };
}

export async function pgGetMeetingTaskOwner(taskId: string) {
  const sql = getSql();
  const rows = await sql`
    SELECT m.id, m.campaign_id, m.owner_user_id
    FROM meeting_tasks t
    INNER JOIN campaign_meetings m ON m.id = t.meeting_id
    WHERE t.id = ${taskId}
    LIMIT 1
  `;
  if (!rows[0]) return null;
  return {
    meetingId: String(rows[0].id),
    campaignId: String(rows[0].campaign_id),
    ownerUserId: rows[0].owner_user_id ? String(rows[0].owner_user_id) : null,
  };
}

export async function pgToggleMeetingTask(taskId: string, completed: boolean) {
  const sql = getSql();
  const now = new Date().toISOString();
  await sql`
    UPDATE meeting_tasks
    SET completed = ${completed}, updated_at = ${now}
    WHERE id = ${taskId}
  `;
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
