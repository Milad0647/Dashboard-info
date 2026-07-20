import type {
  Billboard,
  CampaignActivity,
  Poster,
  PosterVersion,
  ScoreableContentType,
  SocialMediaPost,
  Video,
  VideoVersion,
} from "@/lib/types";

export type NotificationRange = "day" | "week" | "month" | "all";
export type NotificationSort = "upload" | "date" | "owner" | "province";
export type NotificationView = "new" | "seen";

export interface NotificationFeedItem {
  key: string;
  contentType: ScoreableContentType;
  contentId: string;
  title: string;
  ownerName?: string | null;
  ownerProvince?: string | null;
  ownerCity?: string | null;
  planLabel?: string | null;
  typeLabel: string;
  date: string;
  eventAt: string;
  createdAt: string;
  thumbnailUrl?: string | null;
  published: boolean;
  adminPath: string;
  score?: number | null;
  autoScore?: number | null;
  manualScore?: number | null;
}

function eventTimestamp(createdAt: string, updatedAt?: string): string {
  return updatedAt && updatedAt > createdAt ? updatedAt : createdAt;
}

function startOfRange(range: NotificationRange): Date | null {
  if (range === "all") return null;

  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (range === "day") return start;
  if (range === "week") {
    start.setDate(start.getDate() - 7);
    return start;
  }
  start.setMonth(start.getMonth() - 1);
  return start;
}

function posterThumbnail(posterId: string, versions: PosterVersion[]): string | null {
  const versionsForPoster = versions
    .filter((version) => version.posterId === posterId)
    .sort((a, b) => b.versionNumber - a.versionNumber);
  return versionsForPoster[0]?.thumbnailUrl ?? versionsForPoster[0]?.imageUrl ?? null;
}

function videoThumbnail(videoId: string, versions: VideoVersion[]): string | null {
  const versionsForVideo = versions
    .filter((version) => version.videoId === videoId)
    .sort((a, b) => b.versionNumber - a.versionNumber);
  return versionsForVideo[0]?.thumbnailUrl ?? null;
}

function activityThumbnail(activity: CampaignActivity): string | null {
  if (activity.imageUrl) return activity.imageUrl;
  const firstImage = activity.mediaItems.find((item) => item.type === "image");
  return firstImage?.url ?? null;
}

function buildAdminEditPath(basePath: string, campaignId: string, contentId: string): string {
  const params = new URLSearchParams({
    campaign: campaignId,
    edit: contentId,
  });
  return `${basePath}?${params.toString()}`;
}

export function buildNotificationFeed(input: {
  campaignId: string;
  posters: Poster[];
  videos: Video[];
  billboards: Billboard[];
  activities: CampaignActivity[];
  socialPosts: SocialMediaPost[];
  posterVersions?: PosterVersion[];
  videoVersions?: VideoVersion[];
}): NotificationFeedItem[] {
  const { campaignId } = input;
  const posterVersions = input.posterVersions ?? [];
  const videoVersions = input.videoVersions ?? [];
  const items: NotificationFeedItem[] = [];

  for (const poster of input.posters) {
    const eventAt = eventTimestamp(poster.createdAt, poster.updatedAt);
    items.push({
      key: `poster:${poster.id}`,
      contentType: "poster",
      contentId: poster.id,
      title: poster.title,
      ownerName: poster.ownerName,
      ownerProvince: poster.ownerProvince,
      ownerCity: poster.ownerCity,
      planLabel: poster.planLabel,
      typeLabel: "پوستر",
      date: eventAt.slice(0, 10),
      eventAt,
      createdAt: poster.createdAt,
      thumbnailUrl: posterThumbnail(poster.id, posterVersions),
      published: poster.published,
      adminPath: buildAdminEditPath("/admin/posters", campaignId, poster.id),
      score: poster.score,
      autoScore: poster.autoScore,
      manualScore: poster.manualScore,
    });
  }

  for (const video of input.videos) {
    const eventAt = eventTimestamp(video.createdAt, video.updatedAt);
    items.push({
      key: `video:${video.id}`,
      contentType: "video",
      contentId: video.id,
      title: video.title,
      ownerName: video.ownerName,
      ownerProvince: video.ownerProvince,
      ownerCity: video.ownerCity,
      planLabel: video.planLabel,
      typeLabel: "ویدیو",
      date: eventAt.slice(0, 10),
      eventAt,
      createdAt: video.createdAt,
      thumbnailUrl: videoThumbnail(video.id, videoVersions),
      published: video.published,
      adminPath: buildAdminEditPath("/admin/videos", campaignId, video.id),
      score: video.score,
      autoScore: video.autoScore,
      manualScore: video.manualScore,
    });
  }

  for (const billboard of input.billboards) {
    const eventAt = eventTimestamp(billboard.createdAt, billboard.updatedAt);
    items.push({
      key: `billboard:${billboard.id}`,
      contentType: "billboard",
      contentId: billboard.id,
      title: billboard.title,
      ownerName: billboard.ownerName,
      ownerProvince: billboard.ownerProvince ?? billboard.province,
      ownerCity: billboard.ownerCity ?? billboard.city,
      planLabel: billboard.planLabel,
      typeLabel: "تبلیغات محیطی",
      date: eventAt.slice(0, 10),
      eventAt,
      createdAt: billboard.createdAt,
      thumbnailUrl: billboard.thumbnailUrl,
      published: billboard.published,
      adminPath: buildAdminEditPath("/admin/billboards", campaignId, billboard.id),
      score: billboard.score,
      autoScore: billboard.autoScore,
      manualScore: billboard.manualScore,
    });
  }

  for (const activity of input.activities) {
    const eventAt = eventTimestamp(activity.createdAt, activity.updatedAt);
    items.push({
      key: `activity:${activity.id}`,
      contentType: "activity",
      contentId: activity.id,
      title: activity.title,
      ownerName: activity.ownerName,
      ownerProvince: activity.ownerProvince,
      ownerCity: activity.ownerCity,
      planLabel: activity.planLabel,
      typeLabel: "اقدام / مجله",
      date: eventAt.slice(0, 10),
      eventAt,
      createdAt: activity.createdAt,
      thumbnailUrl: activityThumbnail(activity),
      published: activity.published,
      adminPath: buildAdminEditPath("/admin/activities", campaignId, activity.id),
      score: activity.score,
      autoScore: activity.autoScore,
      manualScore: activity.manualScore,
    });
  }

  for (const post of input.socialPosts) {
    const eventAt = eventTimestamp(post.createdAt, post.updatedAt);
    const isSite = post.platform === "site";
    items.push({
      key: `social:${post.id}`,
      contentType: isSite ? "site_publication" : "social_post",
      contentId: post.id,
      title: post.title,
      ownerName: post.ownerName,
      ownerProvince: post.ownerProvince,
      ownerCity: post.ownerCity,
      planLabel: post.planLabel,
      typeLabel: isSite ? "انتشار در سایت" : "شبکه اجتماعی",
      date: eventAt.slice(0, 10),
      eventAt,
      createdAt: post.createdAt,
      thumbnailUrl: post.coverImageUrl ?? post.mediaUrl,
      published: post.published,
      adminPath: buildAdminEditPath(
        isSite ? "/admin/site-publications" : "/admin/social-posts",
        campaignId,
        post.id
      ),
      score: post.score,
      autoScore: post.autoScore,
      manualScore: post.manualScore,
    });
  }

  return items;
}

export function sortNotificationFeed(
  feed: NotificationFeedItem[],
  sort: NotificationSort
): NotificationFeedItem[] {
  return [...feed].sort((a, b) => {
    if (sort === "owner") {
      return (b.ownerName ?? "").localeCompare(a.ownerName ?? "", "fa") || b.eventAt.localeCompare(a.eventAt);
    }
    if (sort === "province") {
      return (
        (b.ownerProvince ?? "").localeCompare(a.ownerProvince ?? "", "fa") ||
        (b.ownerCity ?? "").localeCompare(a.ownerCity ?? "", "fa") ||
        b.eventAt.localeCompare(a.eventAt)
      );
    }
    if (sort === "date") {
      return b.date.localeCompare(a.date) || b.eventAt.localeCompare(a.eventAt);
    }
    return b.eventAt.localeCompare(a.eventAt);
  });
}

export function filterNotificationFeed(
  feed: NotificationFeedItem[],
  range: NotificationRange
): NotificationFeedItem[] {
  const start = startOfRange(range);
  if (!start) return feed;
  const startIso = start.toISOString();
  return feed.filter((item) => item.eventAt >= startIso);
}

export function filterNotificationByProvince(
  feed: NotificationFeedItem[],
  province: string
): NotificationFeedItem[] {
  if (!province || province === "all") return feed;
  return feed.filter((item) => item.ownerProvince === province);
}

export function filterNotificationByOwner(
  feed: NotificationFeedItem[],
  ownerName: string
): NotificationFeedItem[] {
  if (!ownerName || ownerName === "all") return feed;
  return feed.filter((item) => item.ownerName === ownerName);
}

export function filterNotificationByPlan(
  feed: NotificationFeedItem[],
  planLabel: string
): NotificationFeedItem[] {
  if (!planLabel || planLabel === "all") return feed;
  return feed.filter((item) => item.planLabel === planLabel);
}

export function collectNotificationProvinces(feed: NotificationFeedItem[]): string[] {
  return [...new Set(feed.map((item) => item.ownerProvince?.trim()).filter(Boolean) as string[])].sort(
    (a, b) => a.localeCompare(b, "fa")
  );
}

export function collectNotificationOwners(feed: NotificationFeedItem[]): string[] {
  return [...new Set(feed.map((item) => item.ownerName?.trim()).filter(Boolean) as string[])].sort(
    (a, b) => a.localeCompare(b, "fa")
  );
}

export function collectNotificationPlans(feed: NotificationFeedItem[]): string[] {
  return [...new Set(feed.map((item) => item.planLabel?.trim()).filter(Boolean) as string[])].sort(
    (a, b) => a.localeCompare(b, "fa")
  );
}
