import { matchesDateFilter } from "@/lib/campaign-content-filter";
import type { LeaderboardSourceData } from "@/lib/city-leaderboard";
import { matchesAnyPlanLabelFilter } from "@/lib/content-topics";
import { normalizeImportedProvince } from "@/lib/iran-locations";
import {
  OWNER_COMPANY_TYPE_ALL,
  OWNER_DATE_ALL,
  OWNER_LOCATION_ALL,
  type CampaignDatePreset,
  type OwnerCompanyTypeFilter,
} from "@/lib/owner-location-filter";
import { getSafeCreatedTimestamp } from "@/lib/safe-dates";
import type { Ownable } from "@/lib/types";
import { isUserCompanyType } from "@/lib/user-company-types";
import { isUserRegion, type UserRegion } from "@/lib/user-regions";

export const PERFORMANCE_FILTER_ALL = "all";

export type PerformanceContentCategory =
  | "all"
  | "billboard"
  | "poster"
  | "video"
  | "social_post"
  | "site_publication"
  | "activity"
  | "file";

export type PerformanceRegionFilter = "all" | UserRegion;

export interface PerformanceLeaderboardFilter {
  province: string;
  city: string;
  planLabels: string[];
  datePreset: CampaignDatePreset;
  dateFrom: string;
  dateTo: string;
  contentCategory: PerformanceContentCategory;
  companyType: OwnerCompanyTypeFilter;
  region: PerformanceRegionFilter;
}

export const DEFAULT_PERFORMANCE_LEADERBOARD_FILTER: PerformanceLeaderboardFilter = {
  province: OWNER_LOCATION_ALL,
  city: OWNER_LOCATION_ALL,
  planLabels: [],
  datePreset: OWNER_DATE_ALL,
  dateFrom: "",
  dateTo: "",
  contentCategory: "all",
  companyType: OWNER_COMPANY_TYPE_ALL,
  region: PERFORMANCE_FILTER_ALL,
};

export const PERFORMANCE_CONTENT_CATEGORY_OPTIONS: {
  value: PerformanceContentCategory;
  label: string;
}[] = [
  { value: "all", label: "همه دسته‌ها" },
  { value: "billboard", label: "تبلیغات محیطی" },
  { value: "poster", label: "پوستر" },
  { value: "video", label: "ویدیو" },
  { value: "social_post", label: "شبکه اجتماعی" },
  { value: "site_publication", label: "انتشار سایت" },
  { value: "activity", label: "اقدام" },
  { value: "file", label: "فایل" },
];

export function isPerformanceLeaderboardFilterActive(
  filter: PerformanceLeaderboardFilter
): boolean {
  return (
    filter.province !== OWNER_LOCATION_ALL ||
    filter.city !== OWNER_LOCATION_ALL ||
    filter.planLabels.length > 0 ||
    filter.datePreset !== OWNER_DATE_ALL ||
    filter.contentCategory !== "all" ||
    filter.companyType !== OWNER_COMPANY_TYPE_ALL ||
    filter.region !== PERFORMANCE_FILTER_ALL
  );
}

function resolveItemProvince(item: Ownable & { province?: string | null }): string | null {
  const raw = item.ownerProvince?.trim() || item.province?.trim() || "";
  const normalized = normalizeImportedProvince(raw) ?? raw;
  return normalized || null;
}

function resolveItemCity(item: Ownable & { city?: string | null }): string | null {
  const raw = item.ownerCity?.trim() || item.city?.trim() || "";
  return raw || null;
}

function itemUploadDate(item: Ownable): string | undefined {
  return (
    getSafeCreatedTimestamp(
      item as Ownable & { createdAt?: string | null; updatedAt?: string | null }
    ) || undefined
  );
}

function matchesContentCategory(
  field: keyof LeaderboardSourceData["sections"],
  category: PerformanceContentCategory
): boolean {
  if (category === "all") return true;
  switch (category) {
    case "billboard":
      return field === "billboards";
    case "poster":
      return field === "posters";
    case "video":
      return field === "videos";
    case "social_post":
      return field === "socialPosts";
    case "site_publication":
      return field === "sitePublications";
    case "activity":
      return field === "activities";
    case "file":
      return field === "files";
    default:
      return true;
  }
}

function matchesItem(
  item: Ownable & { province?: string | null; city?: string | null },
  filter: PerformanceLeaderboardFilter
): boolean {
  if (filter.companyType !== OWNER_COMPANY_TYPE_ALL) {
    if (item.ownerCompanyType !== filter.companyType) return false;
  }

  if (filter.region !== PERFORMANCE_FILTER_ALL) {
    if (item.ownerRegion !== filter.region) return false;
  }

  if (
    !matchesAnyPlanLabelFilter(item.planLabels, item.planLabel, filter.planLabels)
  ) {
    return false;
  }

  if (filter.province !== OWNER_LOCATION_ALL) {
    const province = resolveItemProvince(item);
    if (!province || province !== filter.province) return false;
    if (filter.city !== OWNER_LOCATION_ALL) {
      const city = resolveItemCity(item);
      if (!city || city !== filter.city) return false;
    }
  }

  return matchesDateFilter(item, filter, itemUploadDate);
}

function filterList<T extends Ownable & { province?: string | null; city?: string | null }>(
  items: T[],
  filter: PerformanceLeaderboardFilter
): T[] {
  if (!isPerformanceLeaderboardFilterActive(filter)) return items;
  return items.filter((item) => matchesItem(item, filter));
}

export function filterLeaderboardSourceForPerformance(
  data: LeaderboardSourceData,
  filter: PerformanceLeaderboardFilter
): LeaderboardSourceData {
  const sections = {
    billboards: matchesContentCategory("billboards", filter.contentCategory),
    posters: matchesContentCategory("posters", filter.contentCategory),
    videos: matchesContentCategory("videos", filter.contentCategory),
    socialPosts: matchesContentCategory("socialPosts", filter.contentCategory),
    sitePublications: matchesContentCategory("sitePublications", filter.contentCategory),
    activities: matchesContentCategory("activities", filter.contentCategory),
    files: matchesContentCategory("files", filter.contentCategory),
  };

  return {
    sections,
    billboards: sections.billboards ? filterList(data.billboards, filter) : [],
    posters: sections.posters ? filterList(data.posters, filter) : [],
    videos: sections.videos ? filterList(data.videos, filter) : [],
    socialPosts: sections.socialPosts ? filterList(data.socialPosts, filter) : [],
    sitePublications: sections.sitePublications
      ? filterList(data.sitePublications, filter)
      : [],
    activities: sections.activities ? filterList(data.activities, filter) : [],
    pressPublications: sections.activities
      ? filterList(data.pressPublications, filter)
      : [],
    files: sections.files ? filterList(data.files, filter) : [],
  };
}

export function collectPerformanceFilterOptions(data: LeaderboardSourceData): {
  provinces: string[];
  citiesByProvince: Record<string, string[]>;
  planLabels: string[];
} {
  const provinceSet = new Set<string>();
  const citiesByProvince = new Map<string, Set<string>>();
  const planSet = new Set<string>();

  const visit = (item: Ownable & { province?: string | null; city?: string | null }) => {
    const province = resolveItemProvince(item);
    const city = resolveItemCity(item);
    if (province) {
      provinceSet.add(province);
      if (!citiesByProvince.has(province)) {
        citiesByProvince.set(province, new Set());
      }
      if (city) citiesByProvince.get(province)?.add(city);
    }
    for (const label of item.planLabels ?? []) {
      const trimmed = label.trim();
      if (trimmed) planSet.add(trimmed);
    }
    if (item.planLabel?.trim()) planSet.add(item.planLabel.trim());
  };

  for (const item of data.billboards) visit(item);
  for (const item of data.posters) visit(item);
  for (const item of data.videos) visit(item);
  for (const item of data.socialPosts) visit(item);
  for (const item of data.sitePublications) visit(item);
  for (const item of data.activities) visit(item);
  for (const item of data.pressPublications) visit(item);
  for (const item of data.files) visit(item);

  const provinces = [...provinceSet].sort((a, b) => a.localeCompare(b, "fa"));
  const citiesRecord: Record<string, string[]> = {};
  for (const province of provinces) {
    citiesRecord[province] = [...(citiesByProvince.get(province) ?? [])].sort((a, b) =>
      a.localeCompare(b, "fa")
    );
  }

  return {
    provinces,
    citiesByProvince: citiesRecord,
    planLabels: [...planSet].sort((a, b) => a.localeCompare(b, "fa")),
  };
}

export { OWNER_LOCATION_ALL, OWNER_DATE_ALL, OWNER_COMPANY_TYPE_ALL };

const DATE_PRESETS: CampaignDatePreset[] = [
  "all",
  "today",
  "this_week",
  "this_month",
  "custom",
];

const CONTENT_CATEGORIES: PerformanceContentCategory[] = [
  "all",
  "billboard",
  "poster",
  "video",
  "social_post",
  "site_publication",
  "activity",
  "file",
];

export function getPerformancePeriodLabel(
  filter: PerformanceLeaderboardFilter
): string | null {
  switch (filter.datePreset) {
    case "today":
      return "امروز";
    case "this_week":
      return "۷ روز اخیر";
    case "this_month":
      return "۳۰ روز اخیر";
    case "custom":
      return "بازه انتخاب‌شده";
    default:
      return null;
  }
}

export function appendPerformanceFilterParams(
  params: URLSearchParams,
  filter: PerformanceLeaderboardFilter
) {
  if (filter.datePreset !== OWNER_DATE_ALL) params.set("date", filter.datePreset);
  if (filter.datePreset === "custom") {
    if (filter.dateFrom.trim()) params.set("from", filter.dateFrom.trim());
    if (filter.dateTo.trim()) params.set("to", filter.dateTo.trim());
  }
  if (filter.contentCategory !== "all") params.set("category", filter.contentCategory);
  if (filter.province !== OWNER_LOCATION_ALL) params.set("province", filter.province);
  if (filter.city !== OWNER_LOCATION_ALL) params.set("city", filter.city);
  if (filter.companyType !== OWNER_COMPANY_TYPE_ALL) {
    params.set("companyType", filter.companyType);
  }
  if (filter.region !== PERFORMANCE_FILTER_ALL) params.set("region", filter.region);
  if (filter.planLabels.length > 0) params.set("topics", filter.planLabels.join(","));
}

export function performanceFilterFromQuery(query: {
  date?: string;
  from?: string;
  to?: string;
  category?: string;
  province?: string;
  city?: string;
  companyType?: string;
  region?: string;
  topics?: string;
}): PerformanceLeaderboardFilter {
  const filter: PerformanceLeaderboardFilter = {
    ...DEFAULT_PERFORMANCE_LEADERBOARD_FILTER,
  };
  if (query.date && DATE_PRESETS.includes(query.date as CampaignDatePreset)) {
    filter.datePreset = query.date as CampaignDatePreset;
  }
  if (query.from?.trim()) filter.dateFrom = query.from.trim();
  if (query.to?.trim()) filter.dateTo = query.to.trim();
  if (
    query.category &&
    CONTENT_CATEGORIES.includes(query.category as PerformanceContentCategory)
  ) {
    filter.contentCategory = query.category as PerformanceContentCategory;
  }
  if (query.province?.trim()) filter.province = query.province.trim();
  if (query.city?.trim()) filter.city = query.city.trim();
  if (query.companyType && isUserCompanyType(query.companyType)) {
    filter.companyType = query.companyType;
  }
  if (query.region && isUserRegion(query.region)) {
    filter.region = query.region;
  }
  if (query.topics?.trim()) {
    filter.planLabels = query.topics
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return filter;
}
