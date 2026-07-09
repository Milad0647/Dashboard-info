import { isoFromGregorian } from "@/lib/jalali";
import type { PublicCampaignData } from "@/lib/types";

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

function offsetDate(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return isoFromGregorian(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

function dateKey(value: string): string {
  return value.slice(0, 10);
}

type UploadField = Exclude<keyof UploadActivityPoint, "date" | "total">;

export function buildUploadActivityStats(data: PublicCampaignData, days = 14): UploadActivitySummary {
  const buckets = new Map<string, UploadActivityPoint>();

  const add = (createdAt: string, field: UploadField) => {
    const date = dateKey(createdAt);
    const point = buckets.get(date) ?? emptyPoint(date);
    point[field]++;
    point.total++;
    buckets.set(date, point);
  };

  for (const poster of data.posters) add(poster.createdAt, "posters");
  for (const video of data.videos) add(video.createdAt, "videos");
  for (const billboard of data.billboards) add(billboard.createdAt, "billboards");
  for (const post of data.socialPosts) add(post.createdAt, "socialPosts");
  for (const post of data.sitePublications) add(post.createdAt, "sitePublications");
  for (const activity of data.activities) add(activity.createdAt, "activities");
  for (const activity of data.pressPublications) add(activity.createdAt, "activities");
  for (const report of data.broadcastReports) add(report.createdAt, "broadcastReports");
  for (const meeting of data.meetings) add(meeting.meetingDate, "meetings");
  for (const file of data.files) add(file.createdAt, "files");

  const today = offsetDate(0);
  const yesterday = offsetDate(-1);

  const series: UploadActivityPoint[] = [];
  for (let index = days - 1; index >= 0; index -= 1) {
    const date = offsetDate(-index);
    series.push(buckets.get(date) ?? emptyPoint(date));
  }

  return {
    today: buckets.get(today)?.total ?? 0,
    yesterday: buckets.get(yesterday)?.total ?? 0,
    last7Days: series.slice(-7).reduce((sum, point) => sum + point.total, 0),
    series,
  };
}
