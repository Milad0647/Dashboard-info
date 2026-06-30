import { getSql } from "@/lib/db/client";
import { pgGetCampaignActivities, pgGetMeetingsWithTasks, pgGetPublicMeetingPreviews } from "@/lib/db/repository-extended";
import {
  mapAnalyticsFromDb,
  mapBillboardFromDb,
  mapBroadcastReportFromDb,
  mapCampaignFileFromDb,
  mapCategoryFromDb,
  mapPosterFromDb,
  mapPosterVersionFromDb,
  mapSettingsFromDb,
  mapSocialPostFromDb,
  mapSocialPlatformStatFromDb,
  mapSubmissionFromDb,
  mapVideoFromDb,
  mapVideoVersionFromDb,
} from "@/lib/db/mappers";
import type {
  AnalyticsMetric,
  Billboard,
  CampaignFile,
  CampaignSettings,
  CampaignSubmission,
  MediaCategory,
  Poster,
  PosterVersion,
  Video,
  VideoVersion,
} from "@/lib/types";
import { generateId, slugify } from "@/lib/utils";
import { serializeAnalyticsConfig } from "@/lib/analytics-config";

const defaultFeatures = {
  billboards: true,
  posters: true,
  videos: true,
  analytics: true,
  socialAnalytics: true,
  socialPosts: true,
  sitePublications: true,
  broadcastReports: true,
  meetings: true,
  activities: true,
  submissions: true,
  files: true,
};

export async function pgGetAllCampaigns(): Promise<CampaignSettings[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM campaign_settings ORDER BY updated_at DESC
  `;
  return rows.map(mapSettingsFromDb);
}

export async function pgGetCampaignById(id: string): Promise<CampaignSettings | null> {
  const sql = getSql();
  const rows = await sql`SELECT * FROM campaign_settings WHERE id = ${id} LIMIT 1`;
  return rows[0] ? mapSettingsFromDb(rows[0]) : null;
}

export async function pgGetAdminData(campaignId: string, ownerUserId?: string | null) {
  const sql = getSql();
  const ownerFilter = ownerUserId === undefined ? sql`` : sql`AND owner_user_id IS NOT DISTINCT FROM ${ownerUserId}`;

  const [
    campaigns,
    settingsRows,
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
    socialPlatformStats,
    meetings,
    activities,
  ] = await Promise.all([
    sql`SELECT * FROM campaign_settings ORDER BY updated_at DESC`,
    sql`SELECT * FROM campaign_settings WHERE id = ${campaignId} LIMIT 1`,
    sql`
      SELECT b.*, u.name AS owner_name, u.province AS owner_province, u.city AS owner_city
      FROM billboards b
      LEFT JOIN users u ON u.id = b.owner_user_id
      WHERE b.campaign_id = ${campaignId}
      ${ownerFilter}
      ORDER BY b.sort_order
    `,
    sql`SELECT * FROM media_categories WHERE campaign_id = ${campaignId} AND type = 'poster' ORDER BY sort_order`,
    sql`
      SELECT p.*, u.name AS owner_name, u.province AS owner_province, u.city AS owner_city
      FROM posters p
      LEFT JOIN users u ON u.id = p.owner_user_id
      WHERE p.campaign_id = ${campaignId}
      ${ownerFilter}
      ORDER BY p.sort_order
    `,
    sql`
      SELECT pv.* FROM poster_versions pv
      INNER JOIN posters p ON p.id = pv.poster_id
      WHERE p.campaign_id = ${campaignId}
      ${ownerUserId === undefined ? sql`` : sql`AND p.owner_user_id IS NOT DISTINCT FROM ${ownerUserId}`}
    `,
    sql`SELECT * FROM media_categories WHERE campaign_id = ${campaignId} AND type = 'video' ORDER BY sort_order`,
    sql`
      SELECT v.*, u.name AS owner_name, u.province AS owner_province, u.city AS owner_city
      FROM videos v
      LEFT JOIN users u ON u.id = v.owner_user_id
      WHERE v.campaign_id = ${campaignId}
      ${ownerFilter}
      ORDER BY v.sort_order
    `,
    sql`
      SELECT vv.* FROM video_versions vv
      INNER JOIN videos v ON v.id = vv.video_id
      WHERE v.campaign_id = ${campaignId}
      ${ownerUserId === undefined ? sql`` : sql`AND v.owner_user_id IS NOT DISTINCT FROM ${ownerUserId}`}
    `,
    sql`
      SELECT a.*, u.name AS owner_name, u.province AS owner_province, u.city AS owner_city
      FROM analytics_metrics a
      LEFT JOIN users u ON u.id = a.owner_user_id
      WHERE a.campaign_id = ${campaignId}
      ${ownerFilter}
      ORDER BY a.date DESC
    `,
    sql`
      SELECT s.*, u.name AS owner_name, u.province AS owner_province, u.city AS owner_city
      FROM campaign_submissions s
      LEFT JOIN users u ON u.id = s.owner_user_id
      WHERE s.campaign_id = ${campaignId}
      ${ownerFilter}
      ORDER BY s.created_at DESC
    `,
    sql`
      SELECT f.*, u.name AS owner_name, u.province AS owner_province, u.city AS owner_city
      FROM campaign_files f
      LEFT JOIN users u ON u.id = f.owner_user_id
      WHERE f.campaign_id = ${campaignId}
      ${ownerFilter}
      ORDER BY f.sort_order
    `,
    sql`
      SELECT sp.*, u.name AS owner_name, u.province AS owner_province, u.city AS owner_city
      FROM social_media_posts sp
      LEFT JOIN users u ON u.id = sp.owner_user_id
      WHERE sp.campaign_id = ${campaignId}
      ${ownerUserId === undefined ? sql`` : sql`AND sp.owner_user_id IS NOT DISTINCT FROM ${ownerUserId}`}
      ORDER BY sp.sort_order
    `,
    sql`
      SELECT br.*, u.name AS owner_name, u.province AS owner_province, u.city AS owner_city
      FROM broadcast_reports br
      LEFT JOIN users u ON u.id = br.owner_user_id
      WHERE br.campaign_id = ${campaignId}
      ${ownerUserId === undefined ? sql`` : sql`AND br.owner_user_id IS NOT DISTINCT FROM ${ownerUserId}`}
      ORDER BY br.sort_order
    `,
    sql`
      SELECT sps.*, u.name AS owner_name, u.province AS owner_province, u.city AS owner_city
      FROM social_platform_stats sps
      LEFT JOIN users u ON u.id = sps.owner_user_id
      WHERE sps.campaign_id = ${campaignId}
      ${ownerUserId === undefined ? sql`` : sql`AND sps.owner_user_id IS NOT DISTINCT FROM ${ownerUserId}`}
      ORDER BY sps.sort_order, sps.platform
    `,
    pgGetMeetingsWithTasks(campaignId, { ownerUserId }),
    pgGetCampaignActivities(campaignId, ownerUserId),
  ]);

  return {
    settings: settingsRows[0] ? mapSettingsFromDb(settingsRows[0]) : null,
    campaigns: campaigns.map(mapSettingsFromDb),
    billboards: billboards.map(mapBillboardFromDb),
    posterCategories: posterCategories.map(mapCategoryFromDb),
    posters: posters.map(mapPosterFromDb),
    posterVersions: posterVersions.map(mapPosterVersionFromDb),
    videoCategories: videoCategories.map(mapCategoryFromDb),
    videos: videos.map(mapVideoFromDb),
    videoVersions: videoVersions.map(mapVideoVersionFromDb),
    analytics: analytics.map(mapAnalyticsFromDb),
    submissions: submissions.map(mapSubmissionFromDb),
    files: files.map(mapCampaignFileFromDb),
    socialPosts: socialPosts.map(mapSocialPostFromDb),
    broadcastReports: broadcastReports.map(mapBroadcastReportFromDb),
    socialPlatformStats: socialPlatformStats.map(mapSocialPlatformStatFromDb),
    meetings,
    activities,
  };
}

export async function pgSaveCampaign(data: Partial<CampaignSettings> & { id?: string }) {
  const sql = getSql();
  const now = new Date().toISOString();
  const id = data.id ?? generateId();
  const features = data.features ?? defaultFeatures;

  await sql`
    INSERT INTO campaign_settings (
      id, slug, title, description, status, start_date, end_date,
      cover_image_url, published, features, analytics_config, billboard_config, admin_owner_label, updated_at
    ) VALUES (
      ${id},
      ${data.slug ?? slugify(data.title ?? id)},
      ${data.title ?? ""},
      ${data.description ?? ""},
      ${data.status ?? "draft"},
      ${data.startDate ?? now.split("T")[0]},
      ${data.endDate ?? now.split("T")[0]},
      ${data.coverImageUrl ?? null},
      ${data.published ?? false},
      ${sql.json({ ...features })},
      ${sql.json(JSON.parse(JSON.stringify(serializeAnalyticsConfig(data.analyticsConfig ?? { site: { source: "manual" }, social: { source: "manual" } }))))},
      ${sql.json(JSON.parse(JSON.stringify(data.billboardConfig ?? {})))},
      ${data.adminOwnerLabel?.trim() || "مدیریت"},
      ${now}
    )
    ON CONFLICT (id) DO UPDATE SET
      slug = EXCLUDED.slug,
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      status = EXCLUDED.status,
      start_date = EXCLUDED.start_date,
      end_date = EXCLUDED.end_date,
      cover_image_url = EXCLUDED.cover_image_url,
      published = EXCLUDED.published,
      features = EXCLUDED.features,
      analytics_config = EXCLUDED.analytics_config,
      billboard_config = EXCLUDED.billboard_config,
      admin_owner_label = EXCLUDED.admin_owner_label,
      updated_at = EXCLUDED.updated_at
  `;

  return { success: true, id };
}

export async function pgDeleteCampaign(id: string) {
  const sql = getSql();
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    throw new Error("Invalid campaign id");
  }
  await sql`DELETE FROM campaign_settings WHERE id = ${id}::uuid`;
  return { success: true };
}

export async function pgUpdateCampaignSettings(data: Partial<CampaignSettings>) {
  if (!data.id) return { success: false };
  return pgSaveCampaign(data);
}

export async function pgSaveBillboard(data: Partial<Billboard> & { id?: string }) {
  const sql = getSql();
  const now = new Date().toISOString();
  const id = data.id ?? generateId();

  const countRows = await sql`
    SELECT COUNT(*)::int AS count FROM billboards WHERE campaign_id = ${data.campaignId ?? ""}
  `;
  const sortOrder = data.sortOrder ?? (Number(countRows[0]?.count) || 0) + 1;

  await sql`
    INSERT INTO billboards (
      id, campaign_id, title, description, city, location, date,
      thumbnail_url, image_url, external_url, latitude, longitude, source, external_id,
      status, tags, notes, published, sort_order, owner_user_id,
      created_at, updated_at
    ) VALUES (
      ${id},
      ${data.campaignId ?? ""},
      ${data.title ?? ""},
      ${data.description ?? null},
      ${data.city ?? ""},
      ${data.location ?? ""},
      ${data.date ?? now.split("T")[0]},
      ${data.thumbnailUrl ?? ""},
      ${data.imageUrl ?? data.thumbnailUrl ?? ""},
      ${data.externalUrl ?? ""},
      ${data.latitude ?? null},
      ${data.longitude ?? null},
      ${data.source ?? "manual"},
      ${data.externalId ?? null},
      ${data.status ?? "draft"},
      ${sql.array(data.tags ?? [])},
      ${data.notes ?? null},
      ${data.published ?? false},
      ${sortOrder},
      ${data.ownerUserId ?? null},
      ${now},
      ${now}
    )
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      city = EXCLUDED.city,
      location = EXCLUDED.location,
      date = EXCLUDED.date,
      thumbnail_url = EXCLUDED.thumbnail_url,
      image_url = EXCLUDED.image_url,
      external_url = EXCLUDED.external_url,
      latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude,
      source = EXCLUDED.source,
      external_id = EXCLUDED.external_id,
      status = EXCLUDED.status,
      tags = EXCLUDED.tags,
      notes = EXCLUDED.notes,
      published = EXCLUDED.published,
      sort_order = EXCLUDED.sort_order,
      updated_at = EXCLUDED.updated_at
  `;

  return { success: true };
}

export async function pgDeleteBillboard(id: string) {
  const sql = getSql();
  await sql`DELETE FROM billboards WHERE id = ${id}`;
  return { success: true };
}

export async function pgSaveMediaCategory(data: Partial<MediaCategory> & { id?: string }) {
  const sql = getSql();
  const now = new Date().toISOString();
  const id = data.id ?? generateId();

  const countRows = await sql`
    SELECT COUNT(*)::int AS count FROM media_categories
    WHERE campaign_id = ${data.campaignId ?? ""} AND type = ${data.type ?? "poster"}
  `;
  const sortOrder = data.sortOrder ?? (Number(countRows[0]?.count) || 0) + 1;

  await sql`
    INSERT INTO media_categories (
      id, campaign_id, type, title, description, sort_order, published, created_at
    ) VALUES (
      ${id},
      ${data.campaignId ?? ""},
      ${data.type ?? "poster"},
      ${data.title ?? ""},
      ${data.description ?? null},
      ${sortOrder},
      ${data.published ?? false},
      ${now}
    )
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      sort_order = EXCLUDED.sort_order,
      published = EXCLUDED.published
  `;

  return { success: true };
}

export async function pgDeleteMediaCategory(id: string) {
  const sql = getSql();
  await sql`DELETE FROM media_categories WHERE id = ${id}`;
  return { success: true };
}

export async function pgSavePoster(data: Partial<Poster> & { id?: string }) {
  const sql = getSql();
  const now = new Date().toISOString();
  const id = data.id ?? generateId();

  const countRows = await sql`
    SELECT COUNT(*)::int AS count FROM posters WHERE campaign_id = ${data.campaignId ?? ""}
  `;
  const sortOrder = data.sortOrder ?? (Number(countRows[0]?.count) || 0) + 1;

  await sql`
    INSERT INTO posters (
      id, campaign_id, category_id, title, description, published, sort_order, owner_user_id, created_at, updated_at
    ) VALUES (
      ${id},
      ${data.campaignId ?? ""},
      ${data.categoryId ?? ""},
      ${data.title ?? ""},
      ${data.description ?? null},
      ${data.published ?? false},
      ${sortOrder},
      ${data.ownerUserId ?? null},
      ${now},
      ${now}
    )
    ON CONFLICT (id) DO UPDATE SET
      category_id = EXCLUDED.category_id,
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      published = EXCLUDED.published,
      sort_order = EXCLUDED.sort_order,
      updated_at = EXCLUDED.updated_at
  `;

  return { success: true };
}

export async function pgDeletePoster(id: string) {
  const sql = getSql();
  await sql`DELETE FROM posters WHERE id = ${id}`;
  return { success: true };
}

export async function pgSavePosterVersion(data: Partial<PosterVersion> & { id?: string; posterId: string }) {
  const sql = getSql();
  const now = new Date().toISOString();
  const id = data.id ?? generateId();
  const isFinal = Boolean(data.isFinal);
  const status = isFinal ? "final" : "draft";

  if (isFinal) {
    await sql`
      UPDATE poster_versions
      SET is_final = false,
          status = CASE WHEN status = 'final' THEN 'revised' ELSE status END
      WHERE poster_id = ${data.posterId}
    `;
  }

  const countRows = await sql`
    SELECT COUNT(*)::int AS count FROM poster_versions WHERE poster_id = ${data.posterId}
  `;
  const versionNumber = data.versionNumber ?? (Number(countRows[0]?.count) || 0) + 1;

  await sql`
    INSERT INTO poster_versions (
      id, poster_id, version_number, image_url, thumbnail_url, notes, status, is_final, date, created_at
    ) VALUES (
      ${id},
      ${data.posterId},
      ${versionNumber},
      ${data.imageUrl ?? ""},
      ${data.thumbnailUrl ?? data.imageUrl ?? ""},
      ${data.notes ?? null},
      ${status},
      ${isFinal},
      ${data.date ?? now.split("T")[0]},
      ${now}
    )
    ON CONFLICT (id) DO UPDATE SET
      version_number = EXCLUDED.version_number,
      image_url = EXCLUDED.image_url,
      thumbnail_url = EXCLUDED.thumbnail_url,
      notes = EXCLUDED.notes,
      status = EXCLUDED.status,
      is_final = EXCLUDED.is_final,
      date = EXCLUDED.date
  `;

  return { success: true, id, versionNumber, isFinal, status };
}

export async function pgDeletePosterVersion(id: string) {
  const sql = getSql();
  await sql`DELETE FROM poster_versions WHERE id = ${id}`;
  return { success: true };
}

export async function pgSaveVideo(data: Partial<Video> & { id?: string }) {
  const sql = getSql();
  const now = new Date().toISOString();
  const id = data.id ?? generateId();

  const countRows = await sql`
    SELECT COUNT(*)::int AS count FROM videos WHERE campaign_id = ${data.campaignId ?? ""}
  `;
  const sortOrder = data.sortOrder ?? (Number(countRows[0]?.count) || 0) + 1;

  await sql`
    INSERT INTO videos (
      id, campaign_id, category_id, title, description, published, sort_order, owner_user_id, created_at, updated_at
    ) VALUES (
      ${id},
      ${data.campaignId ?? ""},
      ${data.categoryId ?? ""},
      ${data.title ?? ""},
      ${data.description ?? null},
      ${data.published ?? false},
      ${sortOrder},
      ${data.ownerUserId ?? null},
      ${now},
      ${now}
    )
    ON CONFLICT (id) DO UPDATE SET
      category_id = EXCLUDED.category_id,
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      published = EXCLUDED.published,
      sort_order = EXCLUDED.sort_order,
      updated_at = EXCLUDED.updated_at
  `;

  return { success: true };
}

export async function pgDeleteVideo(id: string) {
  const sql = getSql();
  await sql`DELETE FROM videos WHERE id = ${id}`;
  return { success: true };
}

export async function pgSaveVideoVersion(data: Partial<VideoVersion> & { id?: string; videoId: string }) {
  const sql = getSql();
  const now = new Date().toISOString();
  const id = data.id ?? generateId();
  const isFinal = Boolean(data.isFinal);
  const status = isFinal ? "final" : "draft";

  if (isFinal) {
    await sql`
      UPDATE video_versions
      SET is_final = false,
          status = CASE WHEN status = 'final' THEN 'revised' ELSE status END
      WHERE video_id = ${data.videoId}
    `;
  }

  const countRows = await sql`
    SELECT COUNT(*)::int AS count FROM video_versions WHERE video_id = ${data.videoId}
  `;
  const versionNumber = data.versionNumber ?? (Number(countRows[0]?.count) || 0) + 1;

  await sql`
    INSERT INTO video_versions (
      id, video_id, version_number, video_url, thumbnail_url, duration, notes, status, is_final, date, created_at
    ) VALUES (
      ${id},
      ${data.videoId},
      ${versionNumber},
      ${data.videoUrl ?? ""},
      ${data.thumbnailUrl || data.videoUrl || ""},
      ${data.duration ?? null},
      ${data.notes ?? null},
      ${status},
      ${isFinal},
      ${data.date ?? now.split("T")[0]},
      ${now}
    )
    ON CONFLICT (id) DO UPDATE SET
      version_number = EXCLUDED.version_number,
      video_url = EXCLUDED.video_url,
      thumbnail_url = EXCLUDED.thumbnail_url,
      duration = EXCLUDED.duration,
      notes = EXCLUDED.notes,
      status = EXCLUDED.status,
      is_final = EXCLUDED.is_final,
      date = EXCLUDED.date
  `;

  return { success: true, id, versionNumber, isFinal, status };
}

export async function pgDeleteVideoVersion(id: string) {
  const sql = getSql();
  await sql`DELETE FROM video_versions WHERE id = ${id}`;
  return { success: true };
}

export async function pgSaveAnalyticsMetric(data: Partial<AnalyticsMetric> & { id?: string }) {
  const sql = getSql();
  const now = new Date().toISOString();
  const id = data.id ?? generateId();

  await sql`
    INSERT INTO analytics_metrics (
      id, campaign_id, channel, date, visitors, unique_visitors, page_views,
      avg_session_duration, source, device, page, city, owner_user_id, created_at
    ) VALUES (
      ${id},
      ${data.campaignId ?? ""},
      ${data.channel ?? "site"},
      ${data.date ?? now.split("T")[0]},
      ${data.visitors ?? 0},
      ${data.uniqueVisitors ?? 0},
      ${data.pageViews ?? 0},
      ${data.avgSessionDuration ?? 0},
      ${data.source ?? null},
      ${data.device ?? null},
      ${data.page ?? null},
      ${data.city ?? null},
      ${data.ownerUserId ?? null},
      ${now}
    )
    ON CONFLICT (id) DO UPDATE SET
      channel = EXCLUDED.channel,
      date = EXCLUDED.date,
      visitors = EXCLUDED.visitors,
      unique_visitors = EXCLUDED.unique_visitors,
      page_views = EXCLUDED.page_views,
      avg_session_duration = EXCLUDED.avg_session_duration,
      source = EXCLUDED.source,
      device = EXCLUDED.device,
      page = EXCLUDED.page,
      city = EXCLUDED.city
  `;

  return { success: true };
}

export async function pgDeleteAnalyticsMetric(id: string) {
  const sql = getSql();
  await sql`DELETE FROM analytics_metrics WHERE id = ${id}`;
  return { success: true };
}

export async function pgUpdateSubmission(id: string, data: Partial<CampaignSubmission>) {
  const sql = getSql();
  const now = new Date().toISOString();

  await sql`
    UPDATE campaign_submissions SET
      status = COALESCE(${data.status ?? null}, status),
      published = COALESCE(${data.published ?? null}, published),
      updated_at = ${now}
    WHERE id = ${id}
  `;

  return { success: true };
}

export async function pgDeleteSubmission(id: string) {
  const sql = getSql();
  await sql`DELETE FROM campaign_submissions WHERE id = ${id}`;
  return { success: true };
}

export async function pgBulkImportSubmissions(
  campaignId: string,
  rows: {
    externalUuid: string;
    submissionType: string;
    participantName: string;
    participantPhone?: string;
    title: string;
    text: string;
    mediaUrl?: string;
    status: CampaignSubmission["status"];
    published: boolean;
    createdAt: string;
  }[],
  ownerUserId?: string | null
) {
  const sql = getSql();
  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const existing = await sql`
      SELECT id FROM campaign_submissions
      WHERE campaign_id = ${campaignId} AND external_uuid = ${row.externalUuid}
      LIMIT 1
    `;

    if (existing[0]?.id) {
      await sql`
        UPDATE campaign_submissions SET
          submission_type = ${row.submissionType},
          participant_name = ${row.participantName},
          participant_phone = ${row.participantPhone ?? null},
          title = ${row.title},
          text = ${row.text},
          media_url = ${row.mediaUrl ?? null},
          status = ${row.status},
          published = ${row.published},
          created_at = ${row.createdAt},
          updated_at = ${new Date().toISOString()}
        WHERE id = ${existing[0].id}
      `;
      updated += 1;
      continue;
    }

    await sql`
      INSERT INTO campaign_submissions (
        id, campaign_id, owner_user_id, external_uuid, submission_type,
        participant_name, participant_phone, title, text, media_url,
        status, published, created_at, updated_at
      ) VALUES (
        ${generateId()},
        ${campaignId},
        ${ownerUserId ?? null},
        ${row.externalUuid},
        ${row.submissionType},
        ${row.participantName},
        ${row.participantPhone ?? null},
        ${row.title},
        ${row.text},
        ${row.mediaUrl ?? null},
        ${row.status},
        ${row.published},
        ${row.createdAt},
        ${new Date().toISOString()}
      )
    `;
    created += 1;
  }

  return { created, updated, total: rows.length };
}

export async function pgGetCampaignList() {
  const sql = getSql();
  const rows = await sql`
    SELECT id, slug, title, description, status, start_date, end_date, cover_image_url
    FROM campaign_settings
    WHERE published = true
    ORDER BY updated_at DESC
  `;

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    status: row.status,
    startDate: String(row.start_date).split("T")[0],
    endDate: String(row.end_date).split("T")[0],
    coverImageUrl: row.cover_image_url,
  }));
}

export async function pgGetPublicCampaignData(campaignId: string) {
  const sql = getSql();
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
    socialPlatformStats,
    meetings,
    activities,
  ] = await Promise.all([
    sql`
      SELECT b.*, u.name AS owner_name, u.province AS owner_province, u.city AS owner_city
      FROM billboards b
      LEFT JOIN users u ON u.id = b.owner_user_id
      WHERE b.campaign_id = ${campaignId} AND b.published = true
      ORDER BY b.sort_order
    `,
    sql`SELECT * FROM media_categories WHERE campaign_id = ${campaignId} AND type = 'poster' AND published = true ORDER BY sort_order`,
    sql`
      SELECT p.*, u.name AS owner_name, u.province AS owner_province, u.city AS owner_city
      FROM posters p
      LEFT JOIN users u ON u.id = p.owner_user_id
      WHERE p.campaign_id = ${campaignId} AND p.published = true
      ORDER BY p.sort_order
    `,
    sql`
      SELECT pv.* FROM poster_versions pv
      INNER JOIN posters p ON p.id = pv.poster_id
      WHERE p.campaign_id = ${campaignId} AND p.published = true
      ORDER BY pv.version_number
    `,
    sql`SELECT * FROM media_categories WHERE campaign_id = ${campaignId} AND type = 'video' AND published = true ORDER BY sort_order`,
    sql`
      SELECT v.*, u.name AS owner_name, u.province AS owner_province, u.city AS owner_city
      FROM videos v
      LEFT JOIN users u ON u.id = v.owner_user_id
      WHERE v.campaign_id = ${campaignId} AND v.published = true
      ORDER BY v.sort_order
    `,
    sql`
      SELECT vv.* FROM video_versions vv
      INNER JOIN videos v ON v.id = vv.video_id
      WHERE v.campaign_id = ${campaignId} AND v.published = true
      ORDER BY vv.version_number
    `,
    sql`
      SELECT a.*, u.name AS owner_name, u.province AS owner_province, u.city AS owner_city
      FROM analytics_metrics a
      LEFT JOIN users u ON u.id = a.owner_user_id
      WHERE a.campaign_id = ${campaignId}
      ORDER BY a.date
    `,
    sql`
      SELECT s.*, u.name AS owner_name, u.province AS owner_province, u.city AS owner_city
      FROM campaign_submissions s
      LEFT JOIN users u ON u.id = s.owner_user_id
      WHERE s.campaign_id = ${campaignId} AND s.published = true AND s.status = 'approved'
      ORDER BY s.created_at DESC
    `,
    sql`
      SELECT f.*, u.name AS owner_name, u.province AS owner_province, u.city AS owner_city
      FROM campaign_files f
      LEFT JOIN users u ON u.id = f.owner_user_id
      WHERE f.campaign_id = ${campaignId} AND f.published = true
      ORDER BY f.sort_order
    `,
    sql`
      SELECT sp.*, u.name AS owner_name, u.province AS owner_province, u.city AS owner_city
      FROM social_media_posts sp
      LEFT JOIN users u ON u.id = sp.owner_user_id
      WHERE sp.campaign_id = ${campaignId} AND sp.published = true
      ORDER BY sp.sort_order
    `,
    sql`
      SELECT br.*, u.name AS owner_name, u.province AS owner_province, u.city AS owner_city
      FROM broadcast_reports br
      LEFT JOIN users u ON u.id = br.owner_user_id
      WHERE br.campaign_id = ${campaignId} AND br.published = true
      ORDER BY br.sort_order, br.report_date DESC
    `,
    sql`
      SELECT sps.*, u.name AS owner_name, u.province AS owner_province, u.city AS owner_city
      FROM social_platform_stats sps
      LEFT JOIN users u ON u.id = sps.owner_user_id
      WHERE sps.campaign_id = ${campaignId}
      ORDER BY sps.sort_order, sps.platform
    `,
    pgGetPublicMeetingPreviews(campaignId),
    pgGetCampaignActivities(campaignId),
  ]);

  return {
    billboards: billboards.map(mapBillboardFromDb),
    posterCategories: posterCategories.map(mapCategoryFromDb),
    posters: posters.map(mapPosterFromDb),
    posterVersions: posterVersions.map(mapPosterVersionFromDb),
    videoCategories: videoCategories.map(mapCategoryFromDb),
    videos: videos.map(mapVideoFromDb),
    videoVersions: videoVersions.map(mapVideoVersionFromDb),
    analytics: analytics.map(mapAnalyticsFromDb),
    submissions: submissions.map(mapSubmissionFromDb),
    files: files.map(mapCampaignFileFromDb),
    socialPosts: socialPosts.map(mapSocialPostFromDb),
    broadcastReports: broadcastReports.map(mapBroadcastReportFromDb),
    socialPlatformStats: socialPlatformStats.map(mapSocialPlatformStatFromDb),
    meetings,
    activities,
  };
}

export async function pgSaveCampaignFile(data: Partial<CampaignFile> & { id?: string }) {
  const sql = getSql();
  const now = new Date().toISOString();
  const id = data.id ?? generateId();

  await sql`
    INSERT INTO campaign_files (
      id, campaign_id, title, description, file_url, file_name, mime_type, file_size,
      published, sort_order, owner_user_id, created_at, updated_at
    ) VALUES (
      ${id},
      ${data.campaignId ?? ""},
      ${data.title ?? ""},
      ${data.description ?? null},
      ${data.fileUrl ?? ""},
      ${data.fileName ?? ""},
      ${data.mimeType ?? "application/octet-stream"},
      ${data.fileSize ?? 0},
      ${data.published ?? false},
      ${data.sortOrder ?? 0},
      ${data.ownerUserId ?? null},
      ${now},
      ${now}
    )
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      file_url = EXCLUDED.file_url,
      file_name = EXCLUDED.file_name,
      mime_type = EXCLUDED.mime_type,
      file_size = EXCLUDED.file_size,
      published = EXCLUDED.published,
      sort_order = EXCLUDED.sort_order,
      updated_at = EXCLUDED.updated_at
  `;

  return { success: true, id };
}

export async function pgDeleteCampaignFile(id: string) {
  const sql = getSql();
  await sql`DELETE FROM campaign_files WHERE id = ${id}`;
  return { success: true };
}

export async function pgGetPublishedCampaignBySlug(slug: string) {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM campaign_settings WHERE slug = ${slug} AND published = true LIMIT 1
  `;
  return rows[0] ? mapSettingsFromDb(rows[0]) : null;
}
