import { getSql } from "@/lib/db/client";
import {
  mapAnalyticsFromDb,
  mapBillboardFromDb,
  mapCategoryFromDb,
  mapPosterFromDb,
  mapPosterVersionFromDb,
  mapSettingsFromDb,
  mapSubmissionFromDb,
  mapVideoFromDb,
  mapVideoVersionFromDb,
} from "@/lib/db/mappers";
import type {
  AnalyticsMetric,
  Billboard,
  CampaignSettings,
  CampaignSubmission,
  MediaCategory,
  Poster,
  PosterVersion,
  Video,
  VideoVersion,
} from "@/lib/types";
import { generateId, slugify } from "@/lib/utils";

const defaultFeatures = {
  billboards: true,
  posters: true,
  videos: true,
  analytics: true,
  submissions: true,
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

export async function pgGetAdminData(campaignId: string) {
  const sql = getSql();
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
  ] = await Promise.all([
    sql`SELECT * FROM campaign_settings ORDER BY updated_at DESC`,
    sql`SELECT * FROM campaign_settings WHERE id = ${campaignId} LIMIT 1`,
    sql`SELECT * FROM billboards WHERE campaign_id = ${campaignId} ORDER BY sort_order`,
    sql`SELECT * FROM media_categories WHERE campaign_id = ${campaignId} AND type = 'poster' ORDER BY sort_order`,
    sql`SELECT * FROM posters WHERE campaign_id = ${campaignId} ORDER BY sort_order`,
    sql`
      SELECT pv.* FROM poster_versions pv
      INNER JOIN posters p ON p.id = pv.poster_id
      WHERE p.campaign_id = ${campaignId}
    `,
    sql`SELECT * FROM media_categories WHERE campaign_id = ${campaignId} AND type = 'video' ORDER BY sort_order`,
    sql`SELECT * FROM videos WHERE campaign_id = ${campaignId} ORDER BY sort_order`,
    sql`
      SELECT vv.* FROM video_versions vv
      INNER JOIN videos v ON v.id = vv.video_id
      WHERE v.campaign_id = ${campaignId}
    `,
    sql`SELECT * FROM analytics_metrics WHERE campaign_id = ${campaignId} ORDER BY date DESC`,
    sql`SELECT * FROM campaign_submissions WHERE campaign_id = ${campaignId} ORDER BY created_at DESC`,
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
      cover_image_url, published, features, updated_at
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
      updated_at = EXCLUDED.updated_at
  `;

  return { success: true, id };
}

export async function pgDeleteCampaign(id: string) {
  const sql = getSql();
  await sql`DELETE FROM campaign_settings WHERE id = ${id}`;
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
      thumbnail_url, external_url, status, tags, notes, published, sort_order,
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
      ${data.externalUrl ?? ""},
      ${data.status ?? "draft"},
      ${sql.array(data.tags ?? [])},
      ${data.notes ?? null},
      ${data.published ?? false},
      ${sortOrder},
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
      external_url = EXCLUDED.external_url,
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
      id, campaign_id, category_id, title, description, published, sort_order, created_at, updated_at
    ) VALUES (
      ${id},
      ${data.campaignId ?? ""},
      ${data.categoryId ?? ""},
      ${data.title ?? ""},
      ${data.description ?? null},
      ${data.published ?? false},
      ${sortOrder},
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

  if (data.isFinal) {
    await sql`UPDATE poster_versions SET is_final = false WHERE poster_id = ${data.posterId}`;
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
      ${data.status ?? "draft"},
      ${data.isFinal ?? false},
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

  return { success: true };
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
      id, campaign_id, category_id, title, description, published, sort_order, created_at, updated_at
    ) VALUES (
      ${id},
      ${data.campaignId ?? ""},
      ${data.categoryId ?? ""},
      ${data.title ?? ""},
      ${data.description ?? null},
      ${data.published ?? false},
      ${sortOrder},
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

  if (data.isFinal) {
    await sql`UPDATE video_versions SET is_final = false WHERE video_id = ${data.videoId}`;
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
      ${data.thumbnailUrl ?? ""},
      ${data.duration ?? null},
      ${data.notes ?? null},
      ${data.status ?? "draft"},
      ${data.isFinal ?? false},
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

  return { success: true };
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
      id, campaign_id, date, visitors, unique_visitors, page_views,
      avg_session_duration, source, device, page, city, created_at
    ) VALUES (
      ${id},
      ${data.campaignId ?? ""},
      ${data.date ?? now.split("T")[0]},
      ${data.visitors ?? 0},
      ${data.uniqueVisitors ?? 0},
      ${data.pageViews ?? 0},
      ${data.avgSessionDuration ?? 0},
      ${data.source ?? null},
      ${data.device ?? null},
      ${data.page ?? null},
      ${data.city ?? null},
      ${now}
    )
    ON CONFLICT (id) DO UPDATE SET
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
  ] = await Promise.all([
    sql`SELECT * FROM billboards WHERE campaign_id = ${campaignId} AND published = true ORDER BY sort_order`,
    sql`SELECT * FROM media_categories WHERE campaign_id = ${campaignId} AND type = 'poster' AND published = true ORDER BY sort_order`,
    sql`SELECT * FROM posters WHERE campaign_id = ${campaignId} AND published = true ORDER BY sort_order`,
    sql`
      SELECT pv.* FROM poster_versions pv
      INNER JOIN posters p ON p.id = pv.poster_id
      WHERE p.campaign_id = ${campaignId} AND p.published = true
      ORDER BY pv.version_number
    `,
    sql`SELECT * FROM media_categories WHERE campaign_id = ${campaignId} AND type = 'video' AND published = true ORDER BY sort_order`,
    sql`SELECT * FROM videos WHERE campaign_id = ${campaignId} AND published = true ORDER BY sort_order`,
    sql`
      SELECT vv.* FROM video_versions vv
      INNER JOIN videos v ON v.id = vv.video_id
      WHERE v.campaign_id = ${campaignId} AND v.published = true
      ORDER BY vv.version_number
    `,
    sql`SELECT * FROM analytics_metrics WHERE campaign_id = ${campaignId} ORDER BY date`,
    sql`
      SELECT * FROM campaign_submissions
      WHERE campaign_id = ${campaignId} AND published = true AND status = 'approved'
      ORDER BY created_at DESC
    `,
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
  };
}

export async function pgGetPublishedCampaignBySlug(slug: string) {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM campaign_settings WHERE slug = ${slug} AND published = true LIMIT 1
  `;
  return rows[0] ? mapSettingsFromDb(rows[0]) : null;
}
