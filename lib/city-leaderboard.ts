import { normalizeImportedProvince } from "@/lib/iran-locations";
import { countsAsTodayBillboardUpload } from "@/lib/billboards";
import {
  getSafeCreatedTimestamp,
  getTehranCalendarDateIso,
  isSameDay,
} from "@/lib/safe-dates";
import { resolveDisplayVersion, resolveVideoThumbnail } from "@/lib/media-utils";
import type {
  Billboard,
  CampaignActivity,
  CampaignFile,
  Ownable,
  PosterWithVersions,
  PublicCampaignData,
  SocialMediaPost,
  VideoWithVersions,
} from "@/lib/types";

export interface ProvinceLeaderboardMetrics {
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
  /** Sum of Ownable.score values across content items. */
  ratingScore: number;
  /** Sum of billboard areaSqm values. */
  totalAreaSqm: number;
}

export interface ProvinceLeaderboardEntry extends ProvinceLeaderboardMetrics {
  rank: number;
  province: string;
  provinceKey: string;
}

export interface ProvinceContributorEntry {
  rank: number;
  userName: string;
  province: string;
  provinceKey: string;
  totalUploads: number;
  score: number;
  ratingScore?: number;
}

export interface UserLeaderboardEntry extends ProvinceLeaderboardMetrics {
  rank: number;
  userName: string;
  userKey: string;
  province: string;
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
  return getTehranCalendarDateIso();
}

function resolveProvince(item: Ownable & { province?: string | null }): string {
  const raw = item.ownerProvince?.trim() || item.province?.trim() || "";
  return (normalizeImportedProvince(raw) ?? raw) || "نامشخص";
}

function resolveUserKey(item: Ownable): { userKey: string; userName: string } {
  const userName = item.ownerName?.trim() || "کاربر";
  const userKey = item.ownerUserId ?? item.ownerEmail ?? userName;
  return { userKey, userName };
}

function resolvePrimaryProvince(counts: Map<string, number>): string {
  let province = "نامشخص";
  let maxCount = 0;

  for (const [name, count] of counts) {
    if (count > maxCount) {
      province = name;
      maxCount = count;
    }
  }

  return province;
}

function emptyMetrics(): ProvinceLeaderboardMetrics {
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
    ratingScore: 0,
    totalAreaSqm: 0,
  };
}

function countsAsTodayUpload<T extends Ownable & { createdAt?: string | null }>(
  item: T,
  field: MetricField
): boolean {
  if (field === "billboards" && "id" in item) {
    return countsAsTodayBillboardUpload(item as unknown as Billboard);
  }
  return isSameDay(getSafeCreatedTimestamp(item), todayIso());
}

function addItem<T extends Ownable & { createdAt?: string | null; province?: string | null }>(
  map: Map<string, ProvinceLeaderboardMetrics & { province: string }>,
  item: T,
  field: MetricField
) {
  const province = resolveProvince(item);
  const current = map.get(province) ?? {
    ...emptyMetrics(),
    province,
  };

  current[field]++;
  current.totalUploads++;
  current.score += SCORE_WEIGHTS[field];
  if (typeof item.score === "number" && Number.isFinite(item.score)) {
    current.ratingScore += item.score;
  }

  if (field === "billboards") {
    const area = Number((item as { areaSqm?: number | null }).areaSqm || 0);
    if (Number.isFinite(area) && area > 0) {
      current.totalAreaSqm += area;
    }
  }

  if (countsAsTodayUpload(item, field)) {
    current.todayUploads++;
  }

  map.set(province, current);
}

function addContributor<T extends Ownable & { createdAt?: string | null; province?: string | null }>(
  map: Map<string, ProvinceContributorEntry>,
  item: T,
  field: MetricField
) {
  const province = resolveProvince(item);
  const userName = item.ownerName?.trim() || "کاربر";
  const contributorKey = `${province}::${item.ownerUserId ?? item.ownerEmail ?? userName}`;

  const current = map.get(contributorKey) ?? {
    rank: 0,
    userName,
    province,
    provinceKey: province,
    totalUploads: 0,
    score: 0,
    ratingScore: 0,
  };

  current.totalUploads++;
  current.score += SCORE_WEIGHTS[field];
  if (typeof item.score === "number" && Number.isFinite(item.score)) {
    current.ratingScore = (current.ratingScore ?? 0) + item.score;
  }
  map.set(contributorKey, current);
}

type UserAccumulator = ProvinceLeaderboardMetrics & {
  userName: string;
  provinceCounts: Map<string, number>;
};

function addUserItem<T extends Ownable & { createdAt?: string | null; province?: string | null }>(
  map: Map<string, UserAccumulator>,
  item: T,
  field: MetricField
) {
  const { userKey, userName } = resolveUserKey(item);
  const province = resolveProvince(item);
  const current = map.get(userKey) ?? {
    ...emptyMetrics(),
    userName,
    provinceCounts: new Map<string, number>(),
  };

  current[field]++;
  current.totalUploads++;
  current.score += SCORE_WEIGHTS[field];
  if (typeof item.score === "number" && Number.isFinite(item.score)) {
    current.ratingScore += item.score;
  }

  if (field === "billboards") {
    const area = Number((item as { areaSqm?: number | null }).areaSqm || 0);
    if (Number.isFinite(area) && area > 0) {
      current.totalAreaSqm += area;
    }
  }

  if (countsAsTodayUpload(item, field)) {
    current.todayUploads++;
  }

  current.provinceCounts.set(province, (current.provinceCounts.get(province) ?? 0) + 1);
  map.set(userKey, current);
}

function collectLeaderboardItems(
  data: PublicCampaignData,
  add: <T extends Ownable & { createdAt?: string | null; province?: string | null }>(
    items: T[],
    field: MetricField
  ) => void
) {
  if (data.sections.billboards) add(data.billboards, "billboards");
  if (data.sections.posters) add(data.posters, "posters");
  if (data.sections.videos) add(data.videos, "videos");
  if (data.sections.socialPosts) add(data.socialPosts, "socialPosts");
  if (data.sections.sitePublications) add(data.sitePublications, "sitePublications");
  if (data.sections.activities) {
    add(data.activities, "activities");
    add(data.pressPublications, "activities");
  }
  if (data.sections.files) add(data.files, "files");
}

export function buildProvinceLeaderboard(data: PublicCampaignData): ProvinceLeaderboardEntry[] {
  const map = new Map<string, ProvinceLeaderboardMetrics & { province: string }>();

  collectLeaderboardItems(data, (items, field) => {
    for (const item of items) addItem(map, item, field);
  });

  return [...map.entries()]
    .map(([provinceKey, metrics]) => ({
      provinceKey,
      province: metrics.province,
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
      ratingScore: metrics.ratingScore,
      totalAreaSqm: metrics.totalAreaSqm,
      rank: 0,
    }))
    .sort((a, b) => b.score - a.score || b.totalUploads - a.totalUploads)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export function buildUserLeaderboard(data: PublicCampaignData): UserLeaderboardEntry[] {
  const map = new Map<string, UserAccumulator>();

  collectLeaderboardItems(data, (items, field) => {
    for (const item of items) addUserItem(map, item, field);
  });

  return [...map.entries()]
    .map(([userKey, metrics]) => ({
      userKey,
      userName: metrics.userName,
      province: resolvePrimaryProvince(metrics.provinceCounts),
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
      ratingScore: metrics.ratingScore,
      totalAreaSqm: metrics.totalAreaSqm,
      rank: 0,
    }))
    .sort((a, b) => b.score - a.score || b.totalUploads - a.totalUploads)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export function buildUserRatingLeaderboard(data: PublicCampaignData): UserLeaderboardEntry[] {
  return buildUserLeaderboard(data)
    .slice()
    .sort((a, b) => b.ratingScore - a.ratingScore || b.totalUploads - a.totalUploads)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export interface UserContentScoreItem {
  id: string;
  title: string;
  typeLabel: string;
  contentType: string;
  thumbnailUrl?: string | null;
  score: number | null;
  createdAt?: string | null;
}

function resolveUserKeyMatch(item: Ownable, userKey: string): boolean {
  if (item.ownerUserId && item.ownerUserId === userKey) return true;
  if (item.ownerEmail && item.ownerEmail === userKey) return true;
  if ((item.ownerName?.trim() || "کاربر") === userKey) return true;
  return false;
}

export function collectUserContentItems(
  data: PublicCampaignData,
  userKey: string
): UserContentScoreItem[] {
  const items: UserContentScoreItem[] = [];

  const push = <T extends Ownable & { id: string; title: string; createdAt?: string | null }>(
    list: T[],
    typeLabel: string,
    contentType: string,
    getThumb?: (item: T) => string | null | undefined
  ) => {
    for (const item of list) {
      if (!resolveUserKeyMatch(item, userKey)) continue;
      items.push({
        id: item.id,
        title: item.title,
        typeLabel,
        contentType,
        thumbnailUrl: getThumb?.(item) ?? null,
        score: typeof item.score === "number" ? item.score : null,
        createdAt: item.createdAt ?? null,
      });
    }
  };

  if (data.sections.billboards) {
    push(data.billboards, "تبلیغات محیطی", "billboard", (item) => item.thumbnailUrl);
  }
  if (data.sections.posters) {
    push(data.posters, "پوستر", "poster");
  }
  if (data.sections.videos) {
    push(data.videos, "ویدیو", "video");
  }
  if (data.sections.socialPosts) {
    push(data.socialPosts, "پست اجتماعی", "social_post", (item) => item.coverImageUrl);
  }
  if (data.sections.sitePublications) {
    push(data.sitePublications, "انتشار سایت", "site_publication", (item) => item.coverImageUrl);
  }
  if (data.sections.activities) {
    push(data.activities, "اقدام", "activity", (item) => item.imageUrl);
    push(data.pressPublications, "رسانه چاپی", "activity", (item) => item.imageUrl);
  }
  if (data.sections.files) {
    push(data.files, "فایل", "file");
  }

  return items.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
}

export interface LeaderboardContentScope {
  provinceKey?: string;
  userKey?: string;
}

export type LeaderboardMetricLabel =
  | "پوستر"
  | "ویدیو"
  | "شبکه اجتماعی"
  | "انتشار سایت"
  | "اقدام"
  | "فایل";

export type LeaderboardContentListItem =
  | { kind: "poster"; item: PosterWithVersions }
  | { kind: "video"; item: VideoWithVersions }
  | { kind: "social_post"; item: SocialMediaPost }
  | { kind: "site_publication"; item: SocialMediaPost }
  | { kind: "activity"; item: CampaignActivity }
  | { kind: "file"; item: CampaignFile };

function matchesLeaderboardScope(
  item: Ownable & { province?: string | null },
  filter: LeaderboardContentScope
): boolean {
  if (filter.provinceKey && resolveProvince(item) !== filter.provinceKey) return false;
  if (filter.userKey && !resolveUserKeyMatch(item, filter.userKey)) return false;
  return true;
}

export function collectLeaderboardBillboards(
  data: PublicCampaignData,
  filter: LeaderboardContentScope
): Billboard[] {
  if (!data.sections.billboards) return [];

  return data.billboards.filter((item) => matchesLeaderboardScope(item, filter));
}

export function collectLeaderboardContentByMetric(
  data: PublicCampaignData,
  metricLabel: LeaderboardMetricLabel,
  filter: LeaderboardContentScope
): LeaderboardContentListItem[] {
  const items: LeaderboardContentListItem[] = [];

  const pushScoped = <T extends Ownable & { province?: string | null }>(
    list: T[],
    mapper: (item: T) => LeaderboardContentListItem
  ) => {
    for (const item of list) {
      if (!matchesLeaderboardScope(item, filter)) continue;
      items.push(mapper(item));
    }
  };

  switch (metricLabel) {
    case "پوستر":
      if (data.sections.posters) {
        pushScoped(data.posters, (item) => ({ kind: "poster", item }));
      }
      break;
    case "ویدیو":
      if (data.sections.videos) {
        pushScoped(data.videos, (item) => ({ kind: "video", item }));
      }
      break;
    case "شبکه اجتماعی":
      if (data.sections.socialPosts) {
        pushScoped(data.socialPosts, (item) => ({ kind: "social_post", item }));
      }
      break;
    case "انتشار سایت":
      if (data.sections.sitePublications) {
        pushScoped(data.sitePublications, (item) => ({ kind: "site_publication", item }));
      }
      break;
    case "اقدام":
      if (data.sections.activities) {
        pushScoped(data.activities, (item) => ({ kind: "activity", item }));
        pushScoped(data.pressPublications, (item) => ({ kind: "activity", item }));
      }
      break;
    case "فایل":
      if (data.sections.files) {
        pushScoped(data.files, (item) => ({ kind: "file", item }));
      }
      break;
  }

  return items;
}

export function getLeaderboardContentThumbnail(item: LeaderboardContentListItem): string | null {
  switch (item.kind) {
    case "poster": {
      const version = resolveDisplayVersion(item.item.versions);
      return version?.thumbnailUrl?.trim() || version?.imageUrl?.trim() || null;
    }
    case "video": {
      const version = resolveDisplayVersion(item.item.versions);
      if (!version) return null;
      return resolveVideoThumbnail(version.videoUrl, version.thumbnailUrl);
    }
    case "social_post":
    case "site_publication":
      return item.item.coverImageUrl?.trim() || item.item.mediaUrl?.trim() || null;
    case "activity":
      return item.item.imageUrl?.trim() || item.item.mediaItems[0]?.url?.trim() || null;
    case "file":
      return null;
  }
}

export function getLeaderboardContentTitle(item: LeaderboardContentListItem): string {
  return item.item.title;
}

export function buildProvinceContributorLeaderboard(
  data: PublicCampaignData
): ProvinceContributorEntry[] {
  const map = new Map<string, ProvinceContributorEntry>();

  const addAll = <T extends Ownable & { createdAt?: string | null; province?: string | null }>(
    items: T[],
    field: MetricField
  ) => {
    for (const item of items) addContributor(map, item, field);
  };

  collectLeaderboardItems(data, addAll);

  return [...map.values()]
    .sort((a, b) => b.score - a.score || b.totalUploads - a.totalUploads)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export function getProvinceRankBadge(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${rank}`;
}

// Backward-compatible aliases
export const buildCityLeaderboard = buildProvinceLeaderboard;
export const buildCityContributorLeaderboard = buildProvinceContributorLeaderboard;
export const getCityRankBadge = getProvinceRankBadge;
export type CityLeaderboardEntry = ProvinceLeaderboardEntry;
export type CityContributorEntry = ProvinceContributorEntry;
