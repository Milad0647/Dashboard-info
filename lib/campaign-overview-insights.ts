import { buildProvinceLeaderboard } from "@/lib/city-leaderboard";
import { parseISODateLocal } from "@/lib/jalali";
import { filterItemsByOwnerLocation, type OwnerLocationFilter } from "@/lib/owner-location-filter";
import { getSafeUploadTimestamp } from "@/lib/safe-dates";
import type { CampaignKPIs, Ownable, PublicCampaignData } from "@/lib/types";

export interface ContentMixItem {
  label: string;
  count: number;
}

export interface CampaignProgressSummary {
  percent: number;
  daysElapsed: number;
  daysRemaining: number;
  totalDays: number;
  phase: "not_started" | "in_progress" | "completed";
}

export interface RecentActivityItem {
  id: string;
  typeLabel: string;
  ownerName: string;
  timestamp: string;
}

const DAY_MS = 86_400_000;

function toLocalMidnight(dateStr: string): number {
  const { y, m, d } = parseISODateLocal(dateStr);
  return new Date(y, m - 1, d).getTime();
}

export function computeCampaignProgress(
  startDate: string,
  endDate: string
): CampaignProgressSummary {
  const startMs = toLocalMidnight(startDate);
  const endMs = toLocalMidnight(endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();

  const totalDays = Math.max(1, Math.round((endMs - startMs) / DAY_MS) + 1);

  if (todayMs < startMs) {
    return {
      percent: 0,
      daysElapsed: 0,
      daysRemaining: totalDays,
      totalDays,
      phase: "not_started",
    };
  }

  if (todayMs > endMs) {
    return {
      percent: 100,
      daysElapsed: totalDays,
      daysRemaining: 0,
      totalDays,
      phase: "completed",
    };
  }

  const daysElapsed = Math.round((todayMs - startMs) / DAY_MS) + 1;
  const daysRemaining = Math.max(0, totalDays - daysElapsed);
  const percent = Math.min(100, Math.round((daysElapsed / totalDays) * 100));

  return {
    percent,
    daysElapsed,
    daysRemaining,
    totalDays,
    phase: "in_progress",
  };
}

export function buildContentMixStats(
  data: PublicCampaignData,
  kpis: CampaignKPIs
): ContentMixItem[] {
  const { sections } = data;

  return [
    { label: "بیلبورد", count: kpis.totalBillboards, show: Boolean(sections.billboards) },
    { label: "پوستر", count: kpis.totalPosters, show: Boolean(sections.posters) },
    { label: "ویدیو", count: kpis.totalVideos, show: Boolean(sections.videos) },
    { label: "پست اجتماعی", count: kpis.totalSocialPosts, show: Boolean(sections.socialPosts) },
    { label: "انتشار سایت", count: kpis.totalSitePublications, show: Boolean(sections.sitePublications) },
    { label: "اقدام", count: kpis.totalActivities, show: Boolean(sections.activities) },
    { label: "فایل", count: kpis.totalFiles, show: Boolean(sections.files) },
  ]
    .filter((item) => item.show && item.count > 0)
    .map(({ label, count }) => ({ label, count }));
}

function filterCampaignData(
  data: PublicCampaignData,
  filter: OwnerLocationFilter
): PublicCampaignData {
  return {
    ...data,
    billboards: filterItemsByOwnerLocation(data.billboards, filter),
    posters: filterItemsByOwnerLocation(data.posters, filter),
    videos: filterItemsByOwnerLocation(data.videos, filter),
    socialPosts: filterItemsByOwnerLocation(data.socialPosts, filter),
    sitePublications: filterItemsByOwnerLocation(data.sitePublications, filter),
    activities: filterItemsByOwnerLocation(data.activities, filter),
    pressPublications: filterItemsByOwnerLocation(data.pressPublications, filter),
    broadcastReports: filterItemsByOwnerLocation(data.broadcastReports, filter),
    meetings: filterItemsByOwnerLocation(data.meetings, filter, (item) => item.meetingDate),
    files: filterItemsByOwnerLocation(data.files, filter),
  };
}

export function buildFilteredProvinceChartData(
  data: PublicCampaignData,
  filter: OwnerLocationFilter,
  limit = 10
): { label: string; value: number }[] {
  const filtered = filterCampaignData(data, filter);

  return buildProvinceLeaderboard(filtered)
    .slice(0, limit)
    .map((entry) => ({
      label: entry.province,
      value: entry.score,
    }));
}

function pushActivity<T extends Ownable>(
  entries: RecentActivityItem[],
  items: T[],
  typeLabel: string,
  getTimestamp: (item: T) => string
) {
  for (const item of items) {
    const timestamp = getTimestamp(item);
    if (!timestamp) continue;

    entries.push({
      id: `${typeLabel}-${timestamp}-${item.ownerUserId ?? item.ownerEmail ?? entries.length}`,
      typeLabel,
      ownerName: item.ownerName?.trim() || "کاربر",
      timestamp,
    });
  }
}

export function buildRecentActivityFeed(
  data: PublicCampaignData,
  filter: OwnerLocationFilter,
  limit = 12
): RecentActivityItem[] {
  const filtered = filterCampaignData(data, filter);
  const { sections } = data;
  const entries: RecentActivityItem[] = [];

  if (sections.billboards) {
    pushActivity(entries, filtered.billboards, "بیلبورد", getSafeUploadTimestamp);
  }
  if (sections.posters) {
    pushActivity(entries, filtered.posters, "پوستر", getSafeUploadTimestamp);
  }
  if (sections.videos) {
    pushActivity(entries, filtered.videos, "ویدیو", getSafeUploadTimestamp);
  }
  if (sections.socialPosts) {
    pushActivity(entries, filtered.socialPosts, "پست اجتماعی", getSafeUploadTimestamp);
  }
  if (sections.sitePublications) {
    pushActivity(entries, filtered.sitePublications, "انتشار سایت", getSafeUploadTimestamp);
  }
  if (sections.activities) {
    pushActivity(entries, filtered.activities, "اقدام", getSafeUploadTimestamp);
    pushActivity(entries, filtered.pressPublications, "رسانه چاپی", getSafeUploadTimestamp);
  }
  if (sections.broadcastReports) {
    pushActivity(entries, filtered.broadcastReports, "پخش", getSafeUploadTimestamp);
  }
  if (sections.meetings) {
    pushActivity(entries, filtered.meetings, "جلسه", (item) => item.meetingDate);
  }
  if (sections.files) {
    pushActivity(entries, filtered.files, "فایل", getSafeUploadTimestamp);
  }

  return entries
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, limit);
}
