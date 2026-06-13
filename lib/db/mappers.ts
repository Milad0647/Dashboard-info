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

function toDateString(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString().split("T")[0];
  }
  return String(value ?? "").split("T")[0];
}

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value ?? "");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapSettingsFromDb(row: any): CampaignSettings {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    status: row.status,
    startDate: toDateString(row.start_date),
    endDate: toDateString(row.end_date),
    coverImageUrl: row.cover_image_url,
    published: row.published ?? false,
    features:
      typeof row.features === "string"
        ? JSON.parse(row.features)
        : (row.features ?? {
            billboards: true,
            posters: true,
            videos: true,
            analytics: true,
            submissions: true,
          }),
    updatedAt: toIsoString(row.updated_at),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapBillboardFromDb(row: any): Billboard {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    title: row.title,
    description: row.description,
    city: row.city,
    location: row.location,
    date: toDateString(row.date),
    thumbnailUrl: row.thumbnail_url,
    externalUrl: row.external_url,
    status: row.status,
    tags: row.tags ?? [],
    notes: row.notes,
    published: row.published,
    sortOrder: row.sort_order,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapCategoryFromDb(row: any): MediaCategory {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    type: row.type,
    title: row.title,
    description: row.description,
    sortOrder: row.sort_order,
    published: row.published,
    createdAt: toIsoString(row.created_at),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapPosterFromDb(row: any): Poster {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    categoryId: row.category_id,
    title: row.title,
    description: row.description,
    published: row.published,
    sortOrder: row.sort_order,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapPosterVersionFromDb(row: any): PosterVersion {
  return {
    id: row.id,
    posterId: row.poster_id,
    versionNumber: row.version_number,
    imageUrl: row.image_url,
    thumbnailUrl: row.thumbnail_url,
    notes: row.notes,
    status: row.status,
    isFinal: row.is_final,
    date: toDateString(row.date ?? row.created_at),
    createdAt: toIsoString(row.created_at),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapVideoFromDb(row: any): Video {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    categoryId: row.category_id,
    title: row.title,
    description: row.description,
    published: row.published,
    sortOrder: row.sort_order,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapVideoVersionFromDb(row: any): VideoVersion {
  return {
    id: row.id,
    videoId: row.video_id,
    versionNumber: row.version_number,
    videoUrl: row.video_url,
    thumbnailUrl: row.thumbnail_url,
    duration: row.duration,
    notes: row.notes,
    status: row.status,
    isFinal: row.is_final,
    date: toDateString(row.date ?? row.created_at),
    createdAt: toIsoString(row.created_at),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapAnalyticsFromDb(row: any): AnalyticsMetric {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    date: toDateString(row.date),
    visitors: row.visitors,
    uniqueVisitors: row.unique_visitors,
    pageViews: row.page_views,
    avgSessionDuration: row.avg_session_duration,
    source: row.source,
    device: row.device,
    page: row.page,
    city: row.city,
    createdAt: toIsoString(row.created_at),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapSubmissionFromDb(row: any): CampaignSubmission {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    submissionType: row.submission_type ?? "",
    participantName: row.participant_name,
    participantPhone: row.participant_phone,
    participantEmail: row.participant_email,
    title: row.title,
    text: row.text,
    mediaUrl: row.media_url,
    status: row.status,
    published: row.published,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}
