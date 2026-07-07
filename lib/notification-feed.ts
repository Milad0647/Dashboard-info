import type { Billboard, CampaignActivity, Poster, SocialMediaPost, Video } from "@/lib/types";

export type NotificationRange = "day" | "week" | "month";
export type NotificationSort = "upload" | "date";

export interface NotificationFeedItem {
  key: string;
  title: string;
  ownerName?: string | null;
  typeLabel: string;
  date: string;
  eventAt: string;
  createdAt: string;
}

function eventTimestamp(createdAt: string, updatedAt?: string): string {
  return updatedAt && updatedAt > createdAt ? updatedAt : createdAt;
}

function startOfRange(range: NotificationRange): Date {
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

export function buildNotificationFeed(input: {
  posters: Poster[];
  videos: Video[];
  billboards: Billboard[];
  activities: CampaignActivity[];
  socialPosts: SocialMediaPost[];
}): NotificationFeedItem[] {
  const items: NotificationFeedItem[] = [];

  for (const poster of input.posters) {
    const eventAt = eventTimestamp(poster.createdAt, poster.updatedAt);
    items.push({
      key: `poster:${poster.id}`,
      title: poster.title,
      ownerName: poster.ownerName,
      typeLabel: "پوستر",
      date: eventAt.slice(0, 10),
      eventAt,
      createdAt: poster.createdAt,
    });
  }

  for (const video of input.videos) {
    const eventAt = eventTimestamp(video.createdAt, video.updatedAt);
    items.push({
      key: `video:${video.id}`,
      title: video.title,
      ownerName: video.ownerName,
      typeLabel: "ویدیو",
      date: eventAt.slice(0, 10),
      eventAt,
      createdAt: video.createdAt,
    });
  }

  for (const billboard of input.billboards) {
    const eventAt = eventTimestamp(billboard.createdAt, billboard.updatedAt);
    items.push({
      key: `billboard:${billboard.id}`,
      title: billboard.title,
      ownerName: billboard.ownerName,
      typeLabel: "تبلیغات محیطی",
      date: eventAt.slice(0, 10),
      eventAt,
      createdAt: billboard.createdAt,
    });
  }

  for (const activity of input.activities) {
    const eventAt = eventTimestamp(activity.createdAt, activity.updatedAt);
    items.push({
      key: `activity:${activity.id}`,
      title: activity.title,
      ownerName: activity.ownerName,
      typeLabel: "اقدام / مجله",
      date: eventAt.slice(0, 10),
      eventAt,
      createdAt: activity.createdAt,
    });
  }

  for (const post of input.socialPosts) {
    const eventAt = eventTimestamp(post.createdAt, post.updatedAt);
    items.push({
      key: `social:${post.id}`,
      title: post.title,
      ownerName: post.ownerName,
      typeLabel: post.platform === "site" ? "انتشار در سایت" : "شبکه اجتماعی",
      date: eventAt.slice(0, 10),
      eventAt,
      createdAt: post.createdAt,
    });
  }

  return items;
}

export function sortNotificationFeed(
  feed: NotificationFeedItem[],
  sort: NotificationSort
): NotificationFeedItem[] {
  return [...feed].sort((a, b) => {
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
  const start = startOfRange(range).toISOString();
  return feed.filter((item) => item.eventAt >= start);
}
