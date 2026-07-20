import { getSql } from "@/lib/db/client";

export type DbRow = Record<string, unknown>;

export const UNASSIGNED_OWNER_KEY = "_unassigned";

export interface CampaignBackupFullData {
  version: 2;
  exportedAt: string;
  campaignId: string;
  settings: DbRow;
  users: DbRow[];
  access: DbRow[];
  categories: DbRow[];
  billboards: DbRow[];
  billboardPeriods: DbRow[];
  posters: DbRow[];
  posterVersions: DbRow[];
  videos: DbRow[];
  videoVersions: DbRow[];
  analytics: DbRow[];
  submissions: DbRow[];
  files: DbRow[];
  socialPosts: DbRow[];
  platformStats: DbRow[];
  activities: DbRow[];
  broadcasts: DbRow[];
  meetings: DbRow[];
  meetingTasks: DbRow[];
  meetingDecisions: DbRow[];
  rawMedia: DbRow[];
  directives: DbRow[];
  directiveAttachments: DbRow[];
  directiveRecipients: DbRow[];
  pageAccessCodes: DbRow[];
}

function asRows(result: unknown): DbRow[] {
  return (Array.isArray(result) ? result : []) as DbRow[];
}

function ownerKey(row: DbRow): string {
  const owner = row.owner_user_id;
  return typeof owner === "string" && owner.trim() ? owner : UNASSIGNED_OWNER_KEY;
}

/** Load every campaign-scoped table needed for a full disaster-recovery backup. */
export async function pgGetFullCampaignBackupData(
  campaignId: string
): Promise<CampaignBackupFullData | null> {
  const sql = getSql();
  const settingsRows = asRows(
    await sql`SELECT * FROM campaign_settings WHERE id = ${campaignId} LIMIT 1`
  );
  const settings = settingsRows[0];
  if (!settings) return null;

  const [
    billboards,
    categories,
    posters,
    posterVersions,
    videos,
    videoVersions,
    analytics,
    submissions,
    files,
    socialPosts,
    platformStats,
    activities,
    broadcasts,
    meetings,
    meetingTasks,
    meetingDecisions,
    billboardPeriods,
    rawMedia,
    access,
    directives,
    directiveAttachments,
    directiveRecipients,
    pageAccessCodes,
  ] = await Promise.all([
    sql`SELECT * FROM billboards WHERE campaign_id = ${campaignId}`,
    sql`SELECT * FROM media_categories WHERE campaign_id = ${campaignId}`,
    sql`SELECT * FROM posters WHERE campaign_id = ${campaignId}`,
    sql`
      SELECT pv.* FROM poster_versions pv
      INNER JOIN posters p ON p.id = pv.poster_id
      WHERE p.campaign_id = ${campaignId}
    `,
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
    sql`SELECT * FROM social_platform_stats WHERE campaign_id = ${campaignId}`,
    sql`SELECT * FROM campaign_activities WHERE campaign_id = ${campaignId}`,
    sql`SELECT * FROM broadcast_reports WHERE campaign_id = ${campaignId}`,
    sql`SELECT * FROM campaign_meetings WHERE campaign_id = ${campaignId}`,
    sql`
      SELECT mt.* FROM meeting_tasks mt
      INNER JOIN campaign_meetings m ON m.id = mt.meeting_id
      WHERE m.campaign_id = ${campaignId}
    `,
    sql`
      SELECT md.* FROM meeting_decisions md
      INNER JOIN campaign_meetings m ON m.id = md.meeting_id
      WHERE m.campaign_id = ${campaignId}
    `,
    sql`
      SELECT bdp.* FROM billboard_display_periods bdp
      INNER JOIN billboards b ON b.id = bdp.billboard_id
      WHERE b.campaign_id = ${campaignId}
    `,
    sql`SELECT * FROM raw_media_uploads WHERE campaign_id = ${campaignId}`,
    sql`SELECT * FROM user_campaign_access WHERE campaign_id = ${campaignId}`,
    sql`SELECT * FROM campaign_directives WHERE campaign_id = ${campaignId}`,
    sql`
      SELECT da.* FROM directive_attachments da
      INNER JOIN campaign_directives d ON d.id = da.directive_id
      WHERE d.campaign_id = ${campaignId}
    `,
    sql`
      SELECT dr.* FROM directive_recipients dr
      INNER JOIN campaign_directives d ON d.id = dr.directive_id
      WHERE d.campaign_id = ${campaignId}
    `,
    sql`SELECT * FROM campaign_page_access_codes WHERE campaign_id = ${campaignId}`,
  ]);

  const ownerIds = new Set<string>();
  for (const row of [
    ...asRows(billboards),
    ...asRows(posters),
    ...asRows(videos),
    ...asRows(analytics),
    ...asRows(submissions),
    ...asRows(files),
    ...asRows(socialPosts),
    ...asRows(platformStats),
    ...asRows(activities),
    ...asRows(broadcasts),
    ...asRows(meetings),
    ...asRows(rawMedia),
  ]) {
    const key = ownerKey(row);
    if (key !== UNASSIGNED_OWNER_KEY) ownerIds.add(key);
  }
  for (const row of asRows(access)) {
    if (typeof row.user_id === "string") ownerIds.add(row.user_id);
  }
  for (const row of asRows(directives)) {
    if (typeof row.created_by_user_id === "string") ownerIds.add(row.created_by_user_id);
  }
  for (const row of asRows(directiveRecipients)) {
    if (typeof row.user_id === "string") ownerIds.add(row.user_id);
  }

  const userIdList = [...ownerIds];
  const users =
    userIdList.length === 0
      ? []
      : asRows(await sql`SELECT * FROM users WHERE id IN ${sql(userIdList)}`);

  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    campaignId,
    settings,
    users,
    access: asRows(access),
    categories: asRows(categories),
    billboards: asRows(billboards),
    billboardPeriods: asRows(billboardPeriods),
    posters: asRows(posters),
    posterVersions: asRows(posterVersions),
    videos: asRows(videos),
    videoVersions: asRows(videoVersions),
    analytics: asRows(analytics),
    submissions: asRows(submissions),
    files: asRows(files),
    socialPosts: asRows(socialPosts),
    platformStats: asRows(platformStats),
    activities: asRows(activities),
    broadcasts: asRows(broadcasts),
    meetings: asRows(meetings),
    meetingTasks: asRows(meetingTasks),
    meetingDecisions: asRows(meetingDecisions),
    rawMedia: asRows(rawMedia),
    directives: asRows(directives),
    directiveAttachments: asRows(directiveAttachments),
    directiveRecipients: asRows(directiveRecipients),
    pageAccessCodes: asRows(pageAccessCodes),
  };
}

/** Keep campaign_settings row; delete all campaign content (FK-safe order). */
export async function pgWipeCampaignContent(campaignId: string): Promise<void> {
  const sql = getSql();
  await sql.begin(async (tx) => {
    await tx`
      DELETE FROM billboard_display_periods
      WHERE billboard_id IN (SELECT id FROM billboards WHERE campaign_id = ${campaignId})
    `;
    await tx`
      DELETE FROM poster_versions
      WHERE poster_id IN (SELECT id FROM posters WHERE campaign_id = ${campaignId})
    `;
    await tx`
      DELETE FROM video_versions
      WHERE video_id IN (SELECT id FROM videos WHERE campaign_id = ${campaignId})
    `;
    await tx`
      DELETE FROM meeting_tasks
      WHERE meeting_id IN (SELECT id FROM campaign_meetings WHERE campaign_id = ${campaignId})
    `;
    await tx`
      DELETE FROM meeting_decisions
      WHERE meeting_id IN (SELECT id FROM campaign_meetings WHERE campaign_id = ${campaignId})
    `;
    await tx`
      DELETE FROM directive_attachments
      WHERE directive_id IN (SELECT id FROM campaign_directives WHERE campaign_id = ${campaignId})
    `;
    await tx`
      DELETE FROM directive_recipients
      WHERE directive_id IN (SELECT id FROM campaign_directives WHERE campaign_id = ${campaignId})
    `;

    await tx`DELETE FROM posters WHERE campaign_id = ${campaignId}`;
    await tx`DELETE FROM videos WHERE campaign_id = ${campaignId}`;
    await tx`DELETE FROM billboards WHERE campaign_id = ${campaignId}`;
    await tx`DELETE FROM media_categories WHERE campaign_id = ${campaignId}`;
    await tx`DELETE FROM campaign_meetings WHERE campaign_id = ${campaignId}`;
    await tx`DELETE FROM campaign_directives WHERE campaign_id = ${campaignId}`;
    await tx`DELETE FROM analytics_metrics WHERE campaign_id = ${campaignId}`;
    await tx`DELETE FROM campaign_submissions WHERE campaign_id = ${campaignId}`;
    await tx`DELETE FROM campaign_files WHERE campaign_id = ${campaignId}`;
    await tx`DELETE FROM social_media_posts WHERE campaign_id = ${campaignId}`;
    await tx`DELETE FROM social_platform_stats WHERE campaign_id = ${campaignId}`;
    await tx`DELETE FROM broadcast_reports WHERE campaign_id = ${campaignId}`;
    await tx`DELETE FROM campaign_activities WHERE campaign_id = ${campaignId}`;
    await tx`DELETE FROM raw_media_uploads WHERE campaign_id = ${campaignId}`;
    await tx`DELETE FROM campaign_page_access_codes WHERE campaign_id = ${campaignId}`;
    await tx`DELETE FROM user_campaign_access WHERE campaign_id = ${campaignId}`;
  });
}

/** Delete only content owned by one user inside a campaign. */
export async function pgWipeUserCampaignContent(
  campaignId: string,
  userId: string
): Promise<void> {
  const sql = getSql();
  await sql.begin(async (tx) => {
    await tx`
      DELETE FROM billboard_display_periods
      WHERE billboard_id IN (
        SELECT id FROM billboards
        WHERE campaign_id = ${campaignId} AND owner_user_id = ${userId}
      )
    `;
    await tx`
      DELETE FROM poster_versions
      WHERE poster_id IN (
        SELECT id FROM posters
        WHERE campaign_id = ${campaignId} AND owner_user_id = ${userId}
      )
    `;
    await tx`
      DELETE FROM video_versions
      WHERE video_id IN (
        SELECT id FROM videos
        WHERE campaign_id = ${campaignId} AND owner_user_id = ${userId}
      )
    `;
    await tx`
      DELETE FROM meeting_tasks
      WHERE meeting_id IN (
        SELECT id FROM campaign_meetings
        WHERE campaign_id = ${campaignId} AND owner_user_id = ${userId}
      )
    `;
    await tx`
      DELETE FROM meeting_decisions
      WHERE meeting_id IN (
        SELECT id FROM campaign_meetings
        WHERE campaign_id = ${campaignId} AND owner_user_id = ${userId}
      )
    `;

    await tx`DELETE FROM posters WHERE campaign_id = ${campaignId} AND owner_user_id = ${userId}`;
    await tx`DELETE FROM videos WHERE campaign_id = ${campaignId} AND owner_user_id = ${userId}`;
    await tx`DELETE FROM billboards WHERE campaign_id = ${campaignId} AND owner_user_id = ${userId}`;
    await tx`DELETE FROM campaign_meetings WHERE campaign_id = ${campaignId} AND owner_user_id = ${userId}`;
    await tx`DELETE FROM analytics_metrics WHERE campaign_id = ${campaignId} AND owner_user_id = ${userId}`;
    await tx`DELETE FROM campaign_submissions WHERE campaign_id = ${campaignId} AND owner_user_id = ${userId}`;
    await tx`DELETE FROM campaign_files WHERE campaign_id = ${campaignId} AND owner_user_id = ${userId}`;
    await tx`DELETE FROM social_media_posts WHERE campaign_id = ${campaignId} AND owner_user_id = ${userId}`;
    await tx`DELETE FROM social_platform_stats WHERE campaign_id = ${campaignId} AND owner_user_id = ${userId}`;
    await tx`DELETE FROM broadcast_reports WHERE campaign_id = ${campaignId} AND owner_user_id = ${userId}`;
    await tx`DELETE FROM campaign_activities WHERE campaign_id = ${campaignId} AND owner_user_id = ${userId}`;
    await tx`DELETE FROM raw_media_uploads WHERE campaign_id = ${campaignId} AND owner_user_id = ${userId}`;
    await tx`
      DELETE FROM user_campaign_access
      WHERE campaign_id = ${campaignId} AND user_id = ${userId}
    `;
  });
}

function normalizeRowForInsert(row: DbRow): DbRow {
  const out: DbRow = {};
  for (const [key, value] of Object.entries(row)) {
    if (value instanceof Date) {
      out[key] = value.toISOString();
    } else {
      out[key] = value;
    }
  }
  return out;
}

async function insertRows(table: string, rows: DbRow[]): Promise<void> {
  if (rows.length === 0) return;
  const sql = getSql();
  const prepared = rows.map(normalizeRowForInsert);
  const chunkSize = 40;
  for (let i = 0; i < prepared.length; i += chunkSize) {
    const chunk = prepared.slice(i, i + chunkSize);
    await sql`INSERT INTO ${sql(table)} ${sql(chunk)}`;
  }
}

async function upsertUsers(users: DbRow[]): Promise<void> {
  if (users.length === 0) return;
  const sql = getSql();
  for (const raw of users) {
    const row = normalizeRowForInsert(raw);
    const id = String(row.id ?? "");
    const email = String(row.email ?? "").trim().toLowerCase();
    if (!id || !email) continue;

    const province =
      row.province === null || row.province === undefined
        ? null
        : String(row.province);
    const city =
      row.city === null || row.city === undefined ? null : String(row.city);
    const region =
      row.region === null || row.region === undefined ? null : String(row.region);
    const accountManagerName =
      row.account_manager_name === null || row.account_manager_name === undefined
        ? null
        : String(row.account_manager_name);

    await sql`
      INSERT INTO users (
        id, email, password_hash, name, role, province, city, region,
        account_manager_name, created_at
      ) VALUES (
        ${id},
        ${email},
        ${String(row.password_hash ?? "")},
        ${String(row.name ?? email)},
        ${String(row.role ?? "contributor")},
        ${province},
        ${city},
        ${region},
        ${accountManagerName},
        ${String(row.created_at ?? new Date().toISOString())}
      )
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        password_hash = EXCLUDED.password_hash,
        name = EXCLUDED.name,
        role = EXCLUDED.role,
        province = EXCLUDED.province,
        city = EXCLUDED.city,
        region = EXCLUDED.region,
        account_manager_name = EXCLUDED.account_manager_name
    `;
  }
}

async function updateCampaignSettings(campaignId: string, settings: DbRow): Promise<void> {
  const sql = getSql();
  const row = normalizeRowForInsert(settings);
  const coverImageUrl =
    row.cover_image_url === null || row.cover_image_url === undefined
      ? null
      : String(row.cover_image_url);
  const meetingsHash =
    row.meetings_view_password_hash === null ||
    row.meetings_view_password_hash === undefined
      ? null
      : String(row.meetings_view_password_hash);
  const pageHash =
    row.page_view_password_hash === null || row.page_view_password_hash === undefined
      ? null
      : String(row.page_view_password_hash);

  await sql`
    UPDATE campaign_settings SET
      slug = ${String(row.slug ?? "")},
      title = ${String(row.title ?? "")},
      description = ${String(row.description ?? "")},
      status = ${String(row.status ?? "draft")},
      start_date = ${String(row.start_date ?? new Date().toISOString().slice(0, 10))},
      end_date = ${String(row.end_date ?? new Date().toISOString().slice(0, 10))},
      cover_image_url = ${coverImageUrl},
      published = ${Boolean(row.published)},
      features = ${sql.json((row.features ?? {}) as never)},
      analytics_config = ${sql.json((row.analytics_config ?? {}) as never)},
      billboard_config = ${sql.json((row.billboard_config ?? {}) as never)},
      admin_owner_label = ${String(row.admin_owner_label ?? "مدیریت")},
      meetings_view_password_hash = ${meetingsHash},
      page_view_password_hash = ${pageHash},
      content_plans = ${sql.json((row.content_plans ?? []) as never)},
      scoring_rules = ${sql.json((row.scoring_rules ?? {}) as never)},
      updated_at = ${new Date().toISOString()}
    WHERE id = ${campaignId}
  `;
}

export async function pgRestoreFullCampaignData(
  campaignId: string,
  data: CampaignBackupFullData
): Promise<void> {
  await pgWipeCampaignContent(campaignId);
  await upsertUsers(data.users);
  await updateCampaignSettings(campaignId, { ...data.settings, id: campaignId });

  // Force campaign_id on all owned rows to the target campaign.
  const withCampaign = <T extends DbRow>(rows: T[]): T[] =>
    rows.map((row) => ({ ...row, campaign_id: campaignId }));

  await insertRows("media_categories", withCampaign(data.categories));
  await insertRows("billboards", withCampaign(data.billboards));
  await insertRows("billboard_display_periods", data.billboardPeriods);
  await insertRows("posters", withCampaign(data.posters));
  await insertRows("poster_versions", data.posterVersions);
  await insertRows("videos", withCampaign(data.videos));
  await insertRows("video_versions", data.videoVersions);
  await insertRows("analytics_metrics", withCampaign(data.analytics));
  await insertRows("campaign_submissions", withCampaign(data.submissions));
  await insertRows("campaign_files", withCampaign(data.files));
  await insertRows("social_media_posts", withCampaign(data.socialPosts));
  await insertRows("social_platform_stats", withCampaign(data.platformStats));
  await insertRows("campaign_activities", withCampaign(data.activities));
  await insertRows("broadcast_reports", withCampaign(data.broadcasts));
  await insertRows("campaign_meetings", withCampaign(data.meetings));
  await insertRows("meeting_tasks", data.meetingTasks);
  await insertRows("meeting_decisions", data.meetingDecisions);
  await insertRows("raw_media_uploads", withCampaign(data.rawMedia));
  await insertRows("campaign_directives", withCampaign(data.directives));
  await insertRows("directive_attachments", data.directiveAttachments);
  await insertRows("directive_recipients", data.directiveRecipients);
  await insertRows("campaign_page_access_codes", withCampaign(data.pageAccessCodes));
  await insertRows(
    "user_campaign_access",
    data.access.map((row) => ({ ...row, campaign_id: campaignId }))
  );
}

export async function pgRestoreUserCampaignData(
  campaignId: string,
  userId: string,
  data: CampaignBackupFullData
): Promise<void> {
  await pgWipeUserCampaignContent(campaignId, userId);
  const userRows = data.users.filter((u) => String(u.id) === userId);
  await upsertUsers(userRows);

  const owned = <T extends DbRow>(rows: T[]): T[] =>
    rows
      .filter((row) => String(row.owner_user_id ?? "") === userId)
      .map((row) => ({ ...row, campaign_id: campaignId, owner_user_id: userId }));

  const billboards = owned(data.billboards);
  const billboardIds = new Set(billboards.map((b) => String(b.id)));
  const posters = owned(data.posters);
  const posterIds = new Set(posters.map((p) => String(p.id)));
  const videos = owned(data.videos);
  const videoIds = new Set(videos.map((v) => String(v.id)));
  const meetings = owned(data.meetings);
  const meetingIds = new Set(meetings.map((m) => String(m.id)));

  // Ensure referenced categories exist (insert missing only).
  if (data.categories.length > 0) {
    const sql = getSql();
    for (const raw of data.categories) {
      const row = normalizeRowForInsert({ ...raw, campaign_id: campaignId });
      await sql`
        INSERT INTO media_categories ${sql(row)}
        ON CONFLICT (id) DO NOTHING
      `;
    }
  }

  await insertRows("billboards", billboards);
  await insertRows(
    "billboard_display_periods",
    data.billboardPeriods.filter((p) => billboardIds.has(String(p.billboard_id)))
  );
  await insertRows("posters", posters);
  await insertRows(
    "poster_versions",
    data.posterVersions.filter((v) => posterIds.has(String(v.poster_id)))
  );
  await insertRows("videos", videos);
  await insertRows(
    "video_versions",
    data.videoVersions.filter((v) => videoIds.has(String(v.video_id)))
  );
  await insertRows("analytics_metrics", owned(data.analytics));
  await insertRows("campaign_submissions", owned(data.submissions));
  await insertRows("campaign_files", owned(data.files));
  await insertRows("social_media_posts", owned(data.socialPosts));
  await insertRows("social_platform_stats", owned(data.platformStats));
  await insertRows("campaign_activities", owned(data.activities));
  await insertRows("broadcast_reports", owned(data.broadcasts));
  await insertRows("campaign_meetings", meetings);
  await insertRows(
    "meeting_tasks",
    data.meetingTasks.filter((t) => meetingIds.has(String(t.meeting_id)))
  );
  await insertRows(
    "meeting_decisions",
    data.meetingDecisions.filter((d) => meetingIds.has(String(d.meeting_id)))
  );
  await insertRows("raw_media_uploads", owned(data.rawMedia));

  const accessRows = data.access
    .filter((row) => String(row.user_id) === userId)
    .map((row) => ({ ...row, campaign_id: campaignId, user_id: userId }));
  await insertRows("user_campaign_access", accessRows);
}

export { ownerKey };
