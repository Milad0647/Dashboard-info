import type { DataOwnerGroup, Ownable } from "@/lib/types";
import { filterOwnerGroups } from "@/lib/owner-groups";
import { normalizeStoredUserEmail } from "@/lib/auth/user-login";
import { matchesDateFilter } from "@/lib/campaign-content-filter";
import { matchesPlanLabelFilter } from "@/lib/content-topics";

import type { UserCompanyType } from "@/lib/user-company-types";

export const OWNER_LOCATION_ALL = "all";
export const OWNER_USER_ALL = "all";
export const OWNER_DATE_ALL = "all";
export const OWNER_PLAN_ALL = "all";
export const OWNER_COMPANY_TYPE_ALL = "all";
export const OWNER_TOP_SCORED = "top_scored";

export type CampaignDatePreset = "all" | "today" | "this_week" | "this_month" | "custom";
export type CampaignContentSort = "default" | "newest" | "oldest" | "top_scored";
export type OwnerCompanyTypeFilter = "all" | UserCompanyType;

export interface CampaignDateFilter {
  datePreset: CampaignDatePreset;
  dateFrom: string;
  dateTo: string;
}

export interface OwnerLocationFilter extends CampaignDateFilter {
  province: string;
  city: string;
  userKey: string;
  /** Empty array means all plan labels. */
  planLabels: string[];
  /** Filter by owner company type. */
  companyType: OwnerCompanyTypeFilter;
  /** Free-text search across content title / description / location fields. */
  searchQuery: string;
  sortOrder: CampaignContentSort;
}

export const DEFAULT_OWNER_LOCATION_FILTER: OwnerLocationFilter = {
  province: OWNER_LOCATION_ALL,
  city: OWNER_LOCATION_ALL,
  userKey: OWNER_USER_ALL,
  planLabels: [],
  companyType: OWNER_COMPANY_TYPE_ALL,
  searchQuery: "",
  datePreset: OWNER_DATE_ALL,
  dateFrom: "",
  dateTo: "",
  sortOrder: "default",
};

export function isOwnerLocationFilterActive(filter: OwnerLocationFilter): boolean {
  return filter.province !== OWNER_LOCATION_ALL;
}

export function isOwnerUserFilterActive(filter: OwnerLocationFilter): boolean {
  return filter.userKey !== OWNER_USER_ALL;
}

export function isOwnerPlanFilterActive(filter: OwnerLocationFilter): boolean {
  return filter.planLabels.length > 0;
}

export function isOwnerCompanyTypeFilterActive(filter: OwnerLocationFilter): boolean {
  return filter.companyType !== OWNER_COMPANY_TYPE_ALL;
}

export function isOwnerFilterActive(filter: OwnerLocationFilter): boolean {
  return (
    isOwnerLocationFilterActive(filter) ||
    isOwnerUserFilterActive(filter) ||
    isOwnerPlanFilterActive(filter) ||
    isOwnerCompanyTypeFilterActive(filter)
  );
}

export function isSearchFilterActive(filter: OwnerLocationFilter): boolean {
  return filter.searchQuery.trim().length > 0;
}

const SEARCHABLE_STRING_KEYS = [
  "title",
  "description",
  "city",
  "location",
  "province",
  "ownerName",
  "ownerCity",
  "ownerProvince",
  "fileName",
  "category",
  "notes",
  "code",
  "participantName",
  "discussionSummary",
  "summaryPreview",
  "messageBody",
  "platform",
] as const;

function collectSearchableText(item: Ownable): string {
  const record = item as Ownable & Record<string, unknown>;
  const parts: string[] = [];

  for (const key of SEARCHABLE_STRING_KEYS) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      parts.push(value);
    }
  }

  if (Array.isArray(record.tags)) {
    for (const tag of record.tags) {
      if (typeof tag === "string" && tag.trim()) parts.push(tag);
    }
  }

  if (Array.isArray(record.attendees)) {
    for (const attendee of record.attendees) {
      if (typeof attendee === "string" && attendee.trim()) parts.push(attendee);
    }
  }

  if (Array.isArray(record.planLabels)) {
    for (const label of record.planLabels) {
      if (typeof label === "string" && label.trim()) parts.push(label);
    }
  } else if (typeof record.planLabel === "string" && record.planLabel.trim()) {
    parts.push(record.planLabel);
  }

  return parts.join(" ").toLowerCase();
}

export function matchesContentSearch(item: Ownable, filter: OwnerLocationFilter): boolean {
  const query = filter.searchQuery.trim().toLowerCase();
  if (!query) return true;
  return collectSearchableText(item).includes(query);
}

function matchesPlanLabel(item: Ownable, filter: OwnerLocationFilter): boolean {
  if (filter.planLabels.length === 0) return true;
  return filter.planLabels.some((label) =>
    matchesPlanLabelFilter(item.planLabels, item.planLabel, label)
  );
}

function matchesOwnerUser(item: Ownable, filter: OwnerLocationFilter): boolean {
  if (filter.userKey === OWNER_USER_ALL) return true;
  if (!item.ownerUserId && !item.ownerEmail) return false;

  if (item.ownerUserId && item.ownerUserId === filter.userKey) return true;

  const itemEmail = item.ownerEmail?.trim().toLowerCase();
  const filterKey = filter.userKey.trim().toLowerCase();
  if (itemEmail && itemEmail === filterKey) return true;
  if (itemEmail && normalizeStoredUserEmail(itemEmail) === filterKey) return true;

  return false;
}

function matchesOwnerCompanyType(item: Ownable, filter: OwnerLocationFilter): boolean {
  if (filter.companyType === OWNER_COMPANY_TYPE_ALL) return true;
  return item.ownerCompanyType === filter.companyType;
}

function resolveItemProvince(item: Ownable): string | null {
  const ownerProvince = item.ownerProvince?.trim();
  if (ownerProvince) return ownerProvince;
  const geoProvince =
    "province" in item && typeof (item as { province?: unknown }).province === "string"
      ? (item as { province?: string | null }).province?.trim()
      : undefined;
  return geoProvince || null;
}

function resolveItemCity(item: Ownable): string | null {
  const ownerCity = item.ownerCity?.trim();
  if (ownerCity) return ownerCity;
  const geoCity =
    "city" in item && typeof (item as { city?: unknown }).city === "string"
      ? (item as { city?: string | null }).city?.trim()
      : undefined;
  return geoCity || null;
}

export function matchesOwnerLocation(
  item: Ownable,
  filter: OwnerLocationFilter,
  getItemDate?: (item: Ownable) => string | undefined
): boolean {
  if (!matchesContentSearch(item, filter)) return false;
  if (!matchesPlanLabel(item, filter)) return false;
  if (!matchesOwnerUser(item, filter)) return false;
  if (!matchesOwnerCompanyType(item, filter)) return false;

  if (filter.province === OWNER_LOCATION_ALL) {
    return matchesDateFilter(item, filter, getItemDate);
  }

  const itemProvince = resolveItemProvince(item);
  if (!itemProvince || itemProvince !== filter.province) return false;
  if (filter.city === OWNER_LOCATION_ALL) {
    return matchesDateFilter(item, filter, getItemDate);
  }

  const itemCity = resolveItemCity(item);
  if (!itemCity || itemCity !== filter.city) return false;

  return matchesDateFilter(item, filter, getItemDate);
}

export function filterOwnerGroupsByLocation<T extends Ownable>(
  groups: DataOwnerGroup<T>[],
  filter: OwnerLocationFilter,
  getItemDate?: (item: T) => string | undefined
): DataOwnerGroup<T>[] {
  return filterOwnerGroups(groups, (item) =>
    matchesOwnerLocation(item, filter, getItemDate as (item: Ownable) => string | undefined)
  );
}

export function filterItemsByOwnerLocation<T extends Ownable>(
  items: T[],
  filter: OwnerLocationFilter,
  getItemDate?: (item: T) => string | undefined
): T[] {
  return items.filter((item) =>
    matchesOwnerLocation(item, filter, getItemDate as (item: Ownable) => string | undefined)
  );
}

export function collectOwnerLocations(groups: DataOwnerGroup<Ownable>[]): {
  provinces: string[];
  citiesByProvince: Record<string, string[]>;
} {
  const provinceSet = new Set<string>();
  const citiesByProvince = new Map<string, Set<string>>();

  const addLocation = (provinceRaw?: string | null, cityRaw?: string | null) => {
    const province = provinceRaw?.trim();
    const city = cityRaw?.trim();
    if (!province) return;
    provinceSet.add(province);
    if (!citiesByProvince.has(province)) {
      citiesByProvince.set(province, new Set());
    }
    if (city) {
      citiesByProvince.get(province)?.add(city);
    }
  };

  for (const group of groups) {
    addLocation(group.ownerProvince, group.ownerCity);
    for (const item of group.items) {
      addLocation(resolveItemProvince(item), resolveItemCity(item));
    }
  }

  const provinces = [...provinceSet].sort((a, b) => a.localeCompare(b, "fa"));
  const citiesRecord: Record<string, string[]> = {};

  for (const province of provinces) {
    citiesRecord[province] = [...(citiesByProvince.get(province) ?? [])].sort((a, b) =>
      a.localeCompare(b, "fa")
    );
  }

  return { provinces, citiesByProvince: citiesRecord };
}
