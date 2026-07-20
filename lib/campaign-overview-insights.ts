import { parseISODateLocal } from "@/lib/jalali";
import { getBillboardUploadActivityDate, isLiveApiBillboard } from "@/lib/billboards";
import { filterItemsByOwnerLocation, type OwnerLocationFilter } from "@/lib/owner-location-filter";
import { getSafeUploadTimestamp } from "@/lib/safe-dates";
import type { Billboard, CampaignKPIs, Ownable, PublicCampaignData } from "@/lib/types";

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
  title?: string;
  ownerName: string;
  timestamp: string;
  contentType?: string;
  contentId?: string;
  href?: string;
}

const SECTION_HREF_BY_LABEL: Record<string, string> = {
  بیلبورد: "#billboards",
  "تبلیغات محیطی": "#billboards",
  پوستر: "#posters",
  ویدیو: "#videos",
  "پست اجتماعی": "#social-posts",
  "انتشار سایت": "#site-publications",
  اقدام: "#activities",
  "رسانه چاپی": "#press-publications",
  "مجله و روزنامه": "#press-publications",
  پخش: "#broadcast-reports",
  جلسه: "#meetings",
  فایل: "#files",
};

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
    { label: "تبلیغات محیطی", count: kpis.totalBillboards, show: Boolean(sections.billboards) },
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

function pushActivity<T extends Ownable & { id: string }>(
  entries: RecentActivityItem[],
  items: T[],
  typeLabel: string,
  getTimestamp: (item: T) => string,
  contentType?: string,
  getTitle?: (item: T) => string | null | undefined
) {
  for (const item of items) {
    const timestamp = getTimestamp(item);
    if (!timestamp) continue;

    const title = getTitle?.(item)?.trim();

    entries.push({
      id: `${typeLabel}-${item.id}-${timestamp}`,
      typeLabel,
      title: title || undefined,
      ownerName: item.ownerName?.trim() || "کاربر",
      timestamp,
      contentType,
      contentId: item.id,
      href: SECTION_HREF_BY_LABEL[typeLabel],
    });
  }
}

function getItemTitle(item: { title?: string | null }): string | null | undefined {
  return item.title;
}

export function buildRecentActivityFeed(
  data: PublicCampaignData,
  filter: OwnerLocationFilter,
  limit = 10
): RecentActivityItem[] {
  const filtered = filterCampaignData(data, filter);
  const { sections } = data;
  const entries: RecentActivityItem[] = [];

  if (sections.billboards) {
    pushActivity(
      entries,
      filtered.billboards.filter((billboard) => !isLiveApiBillboard(billboard)),
      "تبلیغات محیطی",
      (billboard) => getBillboardUploadActivityDate(billboard as Billboard),
      "billboard",
      getItemTitle
    );
  }
  if (sections.posters) {
    pushActivity(entries, filtered.posters, "پوستر", getSafeUploadTimestamp, "poster", getItemTitle);
  }
  if (sections.videos) {
    pushActivity(entries, filtered.videos, "ویدیو", getSafeUploadTimestamp, "video", getItemTitle);
  }
  if (sections.socialPosts) {
    pushActivity(
      entries,
      filtered.socialPosts,
      "پست اجتماعی",
      getSafeUploadTimestamp,
      "social_post",
      getItemTitle
    );
  }
  if (sections.sitePublications) {
    pushActivity(
      entries,
      filtered.sitePublications,
      "انتشار سایت",
      getSafeUploadTimestamp,
      "site_publication",
      getItemTitle
    );
  }
  if (sections.activities) {
    pushActivity(entries, filtered.activities, "اقدام", getSafeUploadTimestamp, "activity", getItemTitle);
  }
  if (sections.pressPublications) {
    pushActivity(
      entries,
      filtered.pressPublications,
      "رسانه چاپی",
      getSafeUploadTimestamp,
      "press_publication",
      getItemTitle
    );
  }
  if (sections.broadcastReports) {
    pushActivity(entries, filtered.broadcastReports, "پخش", getSafeUploadTimestamp, "broadcast", getItemTitle);
  }
  if (sections.meetings) {
    pushActivity(entries, filtered.meetings, "جلسه", (item) => item.meetingDate, "meeting", getItemTitle);
  }
  if (sections.files) {
    pushActivity(entries, filtered.files, "فایل", getSafeUploadTimestamp, "file", getItemTitle);
  }

  return entries
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, limit);
}
