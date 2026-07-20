import { getBillboardUploadActivityDate } from "@/lib/billboards";
import {
  getSafeCreatedTimestamp,
  getTehranCalendarDateIso,
  getTehranOffsetDateIso,
  timestampToTehranDateIso,
} from "@/lib/safe-dates";
import type {
  Billboard,
  BroadcastReport,
  CampaignActivity,
  CampaignFile,
  MeetingPublicPreview,
  PosterWithVersions,
  PublicCampaignData,
  SocialMediaPost,
  VideoWithVersions,
} from "@/lib/types";

export interface UploadActivityPoint {
  date: string;
  total: number;
  posters: number;
  videos: number;
  billboards: number;
  socialPosts: number;
  sitePublications: number;
  activities: number;
  broadcastReports: number;
  meetings: number;
  files: number;
}

export interface UploadActivitySummary {
  today: number;
  yesterday: number;
  last7Days: number;
  series: UploadActivityPoint[];
}

export type TodayUploadListItem =
  | { kind: "poster"; label: string; item: PosterWithVersions }
  | { kind: "video"; label: string; item: VideoWithVersions }
  | { kind: "billboard"; label: string; item: Billboard }
  | { kind: "social_post"; label: string; item: SocialMediaPost }
  | { kind: "site_publication"; label: string; item: SocialMediaPost }
  | { kind: "activity"; label: string; item: CampaignActivity }
  | { kind: "broadcast"; label: string; item: BroadcastReport }
  | { kind: "meeting"; label: string; item: MeetingPublicPreview }
  | { kind: "file"; label: string; item: CampaignFile };

function emptyPoint(date: string): UploadActivityPoint {
  return {
    date,
    total: 0,
    posters: 0,
    videos: 0,
    billboards: 0,
    socialPosts: 0,
    sitePublications: 0,
    activities: 0,
    broadcastReports: 0,
    meetings: 0,
    files: 0,
  };
}

function dateKey(value?: string | null): string {
  return timestampToTehranDateIso(value);
}

function isOnTehranDay(value: string | null | undefined, dayIso: string): boolean {
  const key = dateKey(value);
  return Boolean(key && key === dayIso);
}

type UploadField = Exclude<keyof UploadActivityPoint, "date" | "total">;

export function buildUploadActivityStats(data: PublicCampaignData, days = 14): UploadActivitySummary {
  const buckets = new Map<string, UploadActivityPoint>();

  const add = (createdAt: string | null | undefined, field: UploadField) => {
    const date = dateKey(createdAt);
    if (!date) return;
    const point = buckets.get(date) ?? emptyPoint(date);
    point[field]++;
    point.total++;
    buckets.set(date, point);
  };

  for (const poster of data.posters) add(getSafeCreatedTimestamp(poster), "posters");
  for (const video of data.videos) add(getSafeCreatedTimestamp(video), "videos");
  for (const billboard of data.billboards) {
    const activityDate = getBillboardUploadActivityDate(billboard);
    if (activityDate) add(activityDate, "billboards");
  }
  for (const post of data.socialPosts) add(getSafeCreatedTimestamp(post), "socialPosts");
  for (const post of data.sitePublications) add(getSafeCreatedTimestamp(post), "sitePublications");
  for (const activity of data.activities) add(getSafeCreatedTimestamp(activity), "activities");
  for (const activity of data.pressPublications) add(getSafeCreatedTimestamp(activity), "activities");
  for (const report of data.broadcastReports) add(getSafeCreatedTimestamp(report), "broadcastReports");
  for (const meeting of data.meetings) add(meeting.meetingDate, "meetings");
  for (const file of data.files) add(getSafeCreatedTimestamp(file), "files");

  const today = getTehranOffsetDateIso(0);
  const yesterday = getTehranOffsetDateIso(-1);

  const series: UploadActivityPoint[] = [];
  for (let index = days - 1; index >= 0; index -= 1) {
    const date = getTehranOffsetDateIso(-index);
    series.push(buckets.get(date) ?? emptyPoint(date));
  }

  return {
    today: buckets.get(today)?.total ?? 0,
    yesterday: buckets.get(yesterday)?.total ?? 0,
    last7Days: series.slice(-7).reduce((sum, point) => sum + point.total, 0),
    series,
  };
}

/** Collect content uploaded on Tehran "today" — same day rules as upload activity stats. */
export function collectTodaysUploads(data: PublicCampaignData): TodayUploadListItem[] {
  const today = getTehranCalendarDateIso();
  const items: TodayUploadListItem[] = [];

  for (const poster of data.posters) {
    if (isOnTehranDay(getSafeCreatedTimestamp(poster), today)) {
      items.push({ kind: "poster", label: "پوستر", item: poster });
    }
  }
  for (const video of data.videos) {
    if (isOnTehranDay(getSafeCreatedTimestamp(video), today)) {
      items.push({ kind: "video", label: "ویدیو", item: video });
    }
  }
  for (const billboard of data.billboards) {
    if (isOnTehranDay(getBillboardUploadActivityDate(billboard), today)) {
      items.push({ kind: "billboard", label: "تبلیغات محیطی", item: billboard });
    }
  }
  for (const post of data.socialPosts) {
    if (isOnTehranDay(getSafeCreatedTimestamp(post), today)) {
      items.push({ kind: "social_post", label: "شبکه اجتماعی", item: post });
    }
  }
  for (const post of data.sitePublications) {
    if (isOnTehranDay(getSafeCreatedTimestamp(post), today)) {
      items.push({ kind: "site_publication", label: "انتشار سایت", item: post });
    }
  }
  for (const activity of data.activities) {
    if (isOnTehranDay(getSafeCreatedTimestamp(activity), today)) {
      items.push({ kind: "activity", label: "اقدام", item: activity });
    }
  }
  for (const activity of data.pressPublications) {
    if (isOnTehranDay(getSafeCreatedTimestamp(activity), today)) {
      items.push({ kind: "activity", label: "نشریه", item: activity });
    }
  }
  for (const report of data.broadcastReports) {
    if (isOnTehranDay(getSafeCreatedTimestamp(report), today)) {
      items.push({ kind: "broadcast", label: "گزارش پخش", item: report });
    }
  }
  for (const meeting of data.meetings) {
    if (isOnTehranDay(meeting.meetingDate, today)) {
      items.push({ kind: "meeting", label: "جلسه", item: meeting });
    }
  }
  for (const file of data.files) {
    if (isOnTehranDay(getSafeCreatedTimestamp(file), today)) {
      items.push({ kind: "file", label: "فایل", item: file });
    }
  }

  return items.sort((a, b) => {
    const aTime = getTodayUploadSortTimestamp(a);
    const bTime = getTodayUploadSortTimestamp(b);
    return bTime.localeCompare(aTime);
  });
}

function getTodayUploadSortTimestamp(entry: TodayUploadListItem): string {
  switch (entry.kind) {
    case "meeting":
      return entry.item.meetingDate || "";
    case "billboard":
      return getBillboardUploadActivityDate(entry.item) || getSafeCreatedTimestamp(entry.item);
    default:
      return getSafeCreatedTimestamp(entry.item);
  }
}

export function getTodayUploadTitle(entry: TodayUploadListItem): string {
  return entry.item.title;
}

export function getTodayUploadCreatedAt(entry: TodayUploadListItem): string | null {
  switch (entry.kind) {
    case "meeting":
      return entry.item.meetingDate || null;
    case "billboard":
      return getBillboardUploadActivityDate(entry.item) || entry.item.createdAt || null;
    default:
      return getSafeCreatedTimestamp(entry.item) || null;
  }
}
