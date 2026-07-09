import { isoFromGregorian } from "@/lib/jalali";
import type { Ownable, PublicCampaignData } from "@/lib/types";

export interface CityLeaderboardMetrics {
  billboards: number;
  posters: number;
  videos: number;
  socialPosts: number;
  sitePublications: number;
  activities: number;
  files: number;
  todayUploads: number;
  totalUploads: number;
  score: number;
}

export interface CityLeaderboardEntry extends CityLeaderboardMetrics {
  rank: number;
  province: string;
  city: string;
  cityKey: string;
}

export interface CityContributorEntry {
  rank: number;
  userName: string;
  province: string;
  city: string;
  cityKey: string;
  totalUploads: number;
  score: number;
}

const SCORE_WEIGHTS = {
  billboards: 5,
  posters: 3,
  videos: 4,
  socialPosts: 2,
  sitePublications: 2,
  activities: 3,
  files: 1,
} as const;

type MetricField = keyof typeof SCORE_WEIGHTS;

function todayIso(): string {
  const date = new Date();
  return isoFromGregorian(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

function resolveLocation(item: Ownable & { city?: string | null; province?: string | null }): {
  province: string;
  city: string;
  cityKey: string;
} {
  const province = item.ownerProvince?.trim() || item.province?.trim() || "نامشخص";
  const city = item.ownerCity?.trim() || item.city?.trim() || "نامشخص";
  return {
    province,
    city,
    cityKey: `${province}::${city}`,
  };
}

function emptyMetrics(): CityLeaderboardMetrics {
  return {
    billboards: 0,
    posters: 0,
    videos: 0,
    socialPosts: 0,
    sitePublications: 0,
    activities: 0,
    files: 0,
    todayUploads: 0,
    totalUploads: 0,
    score: 0,
  };
}

function addItem<T extends Ownable & { createdAt: string; city?: string | null; province?: string | null }>(
  map: Map<string, CityLeaderboardMetrics & { province: string; city: string }>,
  item: T,
  field: MetricField
) {
  const location = resolveLocation(item);
  const current = map.get(location.cityKey) ?? {
    ...emptyMetrics(),
    province: location.province,
    city: location.city,
  };

  current[field]++;
  current.totalUploads++;
  current.score += SCORE_WEIGHTS[field];

  if (item.createdAt.slice(0, 10) === todayIso()) {
    current.todayUploads++;
  }

  map.set(location.cityKey, current);
}

function addContributor<T extends Ownable & { createdAt: string; city?: string | null; province?: string | null }>(
  map: Map<string, CityContributorEntry>,
  item: T,
  field: MetricField
) {
  const location = resolveLocation(item);
  const userName = item.ownerName?.trim() || "کاربر";
  const contributorKey = `${location.cityKey}::${item.ownerUserId ?? item.ownerEmail ?? userName}`;

  const current = map.get(contributorKey) ?? {
    rank: 0,
    userName,
    province: location.province,
    city: location.city,
    cityKey: location.cityKey,
    totalUploads: 0,
    score: 0,
  };

  current.totalUploads++;
  current.score += SCORE_WEIGHTS[field];
  map.set(contributorKey, current);
}

export function buildCityLeaderboard(data: PublicCampaignData): CityLeaderboardEntry[] {
  const map = new Map<string, CityLeaderboardMetrics & { province: string; city: string }>();

  if (data.sections.billboards) {
    for (const item of data.billboards) addItem(map, item, "billboards");
  }
  if (data.sections.posters) {
    for (const item of data.posters) addItem(map, item, "posters");
  }
  if (data.sections.videos) {
    for (const item of data.videos) addItem(map, item, "videos");
  }
  if (data.sections.socialPosts) {
    for (const item of data.socialPosts) addItem(map, item, "socialPosts");
  }
  if (data.sections.sitePublications) {
    for (const item of data.sitePublications) addItem(map, item, "sitePublications");
  }
  if (data.sections.activities) {
    for (const item of data.activities) addItem(map, item, "activities");
    for (const item of data.pressPublications) addItem(map, item, "activities");
  }
  if (data.sections.files) {
    for (const item of data.files) addItem(map, item, "files");
  }

  return [...map.entries()]
    .map(([cityKey, metrics]) => ({
      cityKey,
      province: metrics.province,
      city: metrics.city,
      billboards: metrics.billboards,
      posters: metrics.posters,
      videos: metrics.videos,
      socialPosts: metrics.socialPosts,
      sitePublications: metrics.sitePublications,
      activities: metrics.activities,
      files: metrics.files,
      todayUploads: metrics.todayUploads,
      totalUploads: metrics.totalUploads,
      score: metrics.score,
      rank: 0,
    }))
    .sort((a, b) => b.score - a.score || b.totalUploads - a.totalUploads)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export function buildCityContributorLeaderboard(data: PublicCampaignData): CityContributorEntry[] {
  const map = new Map<string, CityContributorEntry>();

  const addAll = <T extends Ownable & { createdAt: string; city?: string | null; province?: string | null }>(
    items: T[],
    field: MetricField
  ) => {
    for (const item of items) addContributor(map, item, field);
  };

  if (data.sections.billboards) addAll(data.billboards, "billboards");
  if (data.sections.posters) addAll(data.posters, "posters");
  if (data.sections.videos) addAll(data.videos, "videos");
  if (data.sections.socialPosts) addAll(data.socialPosts, "socialPosts");
  if (data.sections.sitePublications) addAll(data.sitePublications, "sitePublications");
  if (data.sections.activities) {
    addAll(data.activities, "activities");
    addAll(data.pressPublications, "activities");
  }
  if (data.sections.files) addAll(data.files, "files");

  return [...map.values()]
    .sort((a, b) => b.score - a.score || b.totalUploads - a.totalUploads)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export function getCityRankBadge(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${rank}`;
}
