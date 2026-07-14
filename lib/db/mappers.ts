import type {
  AnalyticsMetric,
  AdminUser,
  Billboard,
  BroadcastReport,
  CampaignActivity,
  CampaignFile,
  CampaignMeeting,
  CampaignSettings,
  CampaignSubmission,
  MediaCategory,
  MeetingDecision,
  MeetingTask,
  MeetingPublicDetail,
  MeetingPublicPreview,
  Ownable,
  Poster,
  PosterVersion,
  RawMediaKind,
  RawMediaUpload,
  SocialMediaPost,
  SocialPlatformStat,
  Video,
  VideoVersion,
} from "@/lib/types";
import type { ContributorPermissions } from "@/lib/contributor-permissions";
import { normalizeAnalyticsConfig } from "@/lib/analytics-config";
import {
  contentPlansFromTopics,
  normalizeContentTopics,
  normalizePlanLabels,
} from "@/lib/content-topics";
import { truncateMeetingSummary } from "@/lib/meeting-preview";

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

function parsePlanLabelsColumn(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapOwnerFromDb(row: any): Ownable {
  const planLabels = normalizePlanLabels(
    parsePlanLabelsColumn(row.plan_labels),
    row.plan_label ?? null
  );
  const scoreRaw = row.score;
  const score =
    scoreRaw == null || scoreRaw === ""
      ? null
      : Number.isFinite(Number(scoreRaw))
        ? Number(scoreRaw)
        : null;

  return {
    ownerUserId: row.owner_user_id ?? null,
    ownerName: row.owner_name ?? null,
    ownerProvince: row.owner_province ?? null,
    ownerCity: row.owner_city ?? null,
    planLabel: planLabels[0] ?? row.plan_label ?? null,
    planLabels,
    score,
  };
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
        ? {
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
            pressPublications: true,
            submissions: true,
            files: true,
            rawMedia: true,
            ...JSON.parse(row.features),
          }
        : {
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
            pressPublications: true,
            submissions: true,
            files: true,
            rawMedia: true,
            ...(row.features ?? {}),
          },
    analyticsConfig: normalizeAnalyticsConfig(
      typeof row.analytics_config === "string"
        ? JSON.parse(row.analytics_config)
        : row.analytics_config
    ),
    billboardConfig:
      typeof row.billboard_config === "string"
        ? JSON.parse(row.billboard_config)
        : (row.billboard_config ?? {}),
    adminOwnerLabel: row.admin_owner_label ?? "مدیریت",
    contentTopics: normalizeContentTopics(row.content_plans),
    contentPlans: contentPlansFromTopics(normalizeContentTopics(row.content_plans)),
    meetingsViewPasswordHash: row.meetings_view_password_hash ?? null,
    pageViewPasswordHash: row.page_view_password_hash ?? null,
    updatedAt: toIsoString(row.updated_at),
  };
}

import type { ActivityMediaItem, BillboardDisplayPeriod } from "@/lib/types";

function parseActivityMediaItems(value: unknown): ActivityMediaItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const url = typeof record.url === "string" ? record.url.trim() : "";
      const type =
        record.type === "video"
          ? "video"
          : record.type === "audio"
            ? "audio"
            : record.type === "image"
              ? "image"
              : null;
      const id = typeof record.id === "string" ? record.id : crypto.randomUUID();
      if (!url || !type) return null;
      return { id, type, url };
    })
    .filter((item): item is ActivityMediaItem => Boolean(item));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapBillboardDisplayPeriodFromDb(row: any): BillboardDisplayPeriod {
  return {
    id: row.id,
    billboardId: row.billboard_id,
    title: row.title ?? null,
    startDate: toDateString(row.start_date),
    endDate: toDateString(row.end_date),
    billboardImageUrl: row.billboard_image_url,
    confirmationImageUrl: row.confirmation_image_url ?? null,
    sortOrder: row.sort_order ?? 0,
    createdAt: toIsoString(row.created_at),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapBillboardFromDb(row: any): Billboard {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    title: row.title,
    description: row.description,
    province: row.province ?? null,
    city: row.city,
    location: row.location,
    date: toDateString(row.date),
    thumbnailUrl: row.thumbnail_url,
    imageUrl: row.image_url ?? row.thumbnail_url,
    externalUrl: row.external_url,
    latitude: row.latitude != null ? Number(row.latitude) : null,
    longitude: row.longitude != null ? Number(row.longitude) : null,
    source: row.source ?? "manual",
    externalId: row.external_id ?? null,
    category: row.category ?? null,
    areaSqm: row.area_sqm != null ? Number(row.area_sqm) : null,
    status: row.status,
    tags: row.tags ?? [],
    notes: row.notes,
    published: row.published,
    sortOrder: row.sort_order,
    ...mapOwnerFromDb(row),
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
    ...mapOwnerFromDb(row),
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
    ...mapOwnerFromDb(row),
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
    channel: row.channel ?? "site",
    date: toDateString(row.date),
    visitors: row.visitors,
    uniqueVisitors: row.unique_visitors,
    pageViews: row.page_views,
    avgSessionDuration: row.avg_session_duration,
    source: row.source,
    device: row.device,
    page: row.page,
    city: row.city,
    ...mapOwnerFromDb(row),
    createdAt: toIsoString(row.created_at),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapSubmissionFromDb(row: any): CampaignSubmission {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    externalUuid: row.external_uuid ?? null,
    submissionType: row.submission_type ?? "",
    participantName: row.participant_name,
    participantPhone: row.participant_phone,
    participantEmail: row.participant_email,
    title: row.title,
    text: row.text,
    mediaUrl: row.media_url,
    status: row.status,
    published: row.published,
    ...mapOwnerFromDb(row),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapSocialPostFromDb(row: any): SocialMediaPost {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    ...mapOwnerFromDb(row),
    platform: row.platform,
    title: row.title,
    coverImageUrl: row.cover_image_url,
    views: Number(row.views ?? 0),
    likes: Number(row.likes ?? 0),
    comments: Number(row.comments ?? 0),
    shares: Number(row.shares ?? 0),
    link: row.link ?? "",
    contentType: row.content_type,
    mediaUrl: row.media_url,
    description: row.description,
    publishedDate: toDateString(row.published_date),
    published: row.published ?? false,
    sortOrder: row.sort_order ?? 0,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapSocialPlatformStatFromDb(row: any): SocialPlatformStat {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    ...mapOwnerFromDb(row),
    platform: row.platform,
    followers: Number(row.followers ?? 0),
    posts: Number(row.posts ?? 0),
    profileUrl: row.profile_url ?? null,
    sortOrder: row.sort_order ?? 0,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapBroadcastReportFromDb(row: any): BroadcastReport {
  const summary =
    typeof row.summary_data === "string"
      ? JSON.parse(row.summary_data)
      : (row.summary_data ?? {});

  return {
    id: row.id,
    campaignId: row.campaign_id,
    ...mapOwnerFromDb(row),
    title: row.title,
    reportDate: toDateString(row.report_date),
    pdfUrl: row.pdf_url,
    fileName: row.file_name,
    summaryData: summary,
    published: row.published ?? false,
    sortOrder: row.sort_order ?? 0,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapCampaignActivityFromDb(row: any): CampaignActivity {
  const mediaItems = parseActivityMediaItems(row.media_items);
  return {
    id: row.id,
    campaignId: row.campaign_id,
    ...mapOwnerFromDb(row),
    title: row.title,
    activityType: row.activity_type ?? "other",
    activityDate: toDateString(row.activity_date),
    location: row.location ?? "",
    imageUrl: row.image_url ?? null,
    videoUrl: row.video_url ?? null,
    mediaItems:
      mediaItems.length > 0
        ? mediaItems
        : [
            ...(row.image_url
              ? [{ id: `${row.id}-image`, type: "image" as const, url: row.image_url }]
              : []),
            ...(row.video_url
              ? [{ id: `${row.id}-video`, type: "video" as const, url: row.video_url }]
              : []),
          ],
    description: row.description ?? null,
    published: row.published ?? false,
    sortOrder: row.sort_order ?? 0,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseAttendees(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      }
    } catch {
      return [];
    }
  }
  return [];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapMeetingFromDb(row: any): CampaignMeeting {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    ...mapOwnerFromDb(row),
    title: row.title ?? "",
    meetingDate: toDateString(row.meeting_date),
    location: row.location ?? "",
    imageUrl: row.image_url ?? null,
    discussionSummary: row.discussion_summary ?? "",
    attendees: parseAttendees(row.attendees),
    audioUrl: row.audio_url ?? null,
    viewPasswordHash: row.view_password_hash ?? null,
    published: row.published ?? false,
    sortOrder: row.sort_order ?? 0,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapMeetingPreviewFromDb(row: any): MeetingPublicPreview {
  const summary = row.discussion_summary ?? "";
  return {
    id: row.id,
    campaignId: row.campaign_id,
    ...mapOwnerFromDb(row),
    title: row.title ?? "",
    meetingDate: toDateString(row.meeting_date),
    imageUrl: row.image_url ?? null,
    summaryPreview: truncateMeetingSummary(summary),
    hasPassword: Boolean(row.has_password),
    sortOrder: row.sort_order ?? 0,
  };
}

export function mapMeetingPublicDetailFromDb(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  row: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  taskRows: any[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  decisionRows: any[] = []
): MeetingPublicDetail {
  return {
    id: row.id,
    title: row.title ?? "",
    meetingDate: toDateString(row.meeting_date),
    location: row.location ?? "",
    imageUrl: row.image_url ?? null,
    discussionSummary: row.discussion_summary ?? "",
    attendees: parseAttendees(row.attendees),
    audioUrl: row.audio_url ?? null,
    tasks: taskRows.map((task) => ({
      id: task.id,
      title: task.title,
      completed: task.completed ?? false,
      sortOrder: task.sort_order ?? 0,
    })),
    decisions: decisionRows.map((decision) => ({
      id: decision.id,
      title: decision.title,
      sortOrder: decision.sort_order ?? 0,
    })),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapMeetingTaskFromDb(row: any): MeetingTask {
  return {
    id: row.id,
    meetingId: row.meeting_id,
    title: row.title,
    completed: row.completed ?? false,
    sortOrder: row.sort_order ?? 0,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapMeetingDecisionFromDb(row: any): MeetingDecision {
  return {
    id: row.id,
    meetingId: row.meeting_id,
    title: row.title,
    sortOrder: row.sort_order ?? 0,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

export function mapUserFromDb(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  row: any,
  campaignAccess: { campaignId: string; permissions: ContributorPermissions }[] = []
): AdminUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    province: row.province ?? null,
    city: row.city ?? null,
    region: row.region === "north" || row.region === "south" || row.region === "east" || row.region === "west"
      ? row.region
      : null,
    accountManagerName: row.account_manager_name ?? null,
    campaignIds: campaignAccess.map((access) => access.campaignId),
    campaignPermissions: Object.fromEntries(
      campaignAccess.map((access) => [access.campaignId, access.permissions])
    ),
    createdAt: toIsoString(row.created_at),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapCampaignFileFromDb(row: any): CampaignFile {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    title: row.title,
    description: row.description,
    fileUrl: row.file_url,
    fileName: row.file_name,
    mimeType: row.mime_type,
    fileSize: Number(row.file_size ?? 0),
    published: row.published ?? false,
    sortOrder: row.sort_order ?? 0,
    ...mapOwnerFromDb(row),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapRawMediaUploadFromDb(row: any): RawMediaUpload {
  const mediaKind: RawMediaKind = row.media_kind === "video" ? "video" : "image";
  return {
    id: row.id,
    campaignId: row.campaign_id,
    title: row.title,
    description: row.description,
    mediaKind,
    fileUrl: row.file_url,
    fileName: row.file_name,
    mimeType: row.mime_type,
    fileSize: Number(row.file_size ?? 0),
    published: row.published ?? false,
    sortOrder: row.sort_order ?? 0,
    ...mapOwnerFromDb(row),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}
