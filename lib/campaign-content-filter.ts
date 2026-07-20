import type { Ownable } from "@/lib/types";
import {
  isOwnerFilterActive,
  OWNER_DATE_ALL,
  type CampaignDateFilter,
  type CampaignContentSort,
  type OwnerLocationFilter,
} from "@/lib/owner-location-filter";
import { getTehranOffsetDateIso } from "@/lib/safe-dates";

export function isDateFilterActive(filter: OwnerLocationFilter): boolean {
  return filter.datePreset !== OWNER_DATE_ALL;
}

export function isCampaignContentFilterActive(filter: OwnerLocationFilter): boolean {
  return isOwnerFilterActive(filter) || isDateFilterActive(filter);
}

function rollingDayRange(dayCountInclusive: number): { from: string; to: string } {
  return {
    from: getTehranOffsetDateIso(-(dayCountInclusive - 1)),
    to: getTehranOffsetDateIso(0),
  };
}

export function resolveDateFilterRange(filter: CampaignDateFilter): { from: string; to: string } | null {
  if (filter.datePreset === OWNER_DATE_ALL) return null;

  // today / this_week / this_month map to rolling last 1 / 7 / 30 days (inclusive).
  if (filter.datePreset === "today") {
    return rollingDayRange(1);
  }

  if (filter.datePreset === "this_week") {
    return rollingDayRange(7);
  }

  if (filter.datePreset === "this_month") {
    return rollingDayRange(30);
  }

  if (filter.datePreset === "custom") {
    const from = filter.dateFrom.trim();
    const to = filter.dateTo.trim();
    if (!from && !to) return null;
    return { from: from || to, to: to || from };
  }

  return null;
}

export function getOwnableUploadDate(item: Ownable & Record<string, unknown>): string {
  const createdAt = typeof item.createdAt === "string" ? item.createdAt.trim() : "";
  const updatedAt = typeof item.updatedAt === "string" ? item.updatedAt.trim() : "";

  if (createdAt && updatedAt) {
    return updatedAt > createdAt ? updatedAt : createdAt;
  }

  return createdAt || updatedAt;
}

export function getOwnableContentDate(item: Ownable & Record<string, unknown>): string {
  const candidates = [
    item.publishedDate,
    item.activityDate,
    item.reportDate,
    item.meetingDate,
    item.date,
    item.createdAt,
    item.updatedAt,
  ];

  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) {
      return value.trim().slice(0, 10);
    }
  }

  return "";
}

export function matchesDateFilter(
  item: Ownable,
  filter: OwnerLocationFilter,
  getItemDate?: (item: Ownable) => string | undefined
): boolean {
  const range = resolveDateFilterRange(filter);
  if (!range) return true;

  const itemDate = (
    getItemDate?.(item) ?? getOwnableContentDate(item as Ownable & Record<string, unknown>)
  ).slice(0, 10);
  if (!itemDate) return false;

  return itemDate >= range.from && itemDate <= range.to;
}

export function sortCampaignContent<T>(
  items: T[],
  sort: CampaignContentSort,
  getItemDate: (item: T) => string,
  getSortOrder?: (item: T) => number
): T[] {
  const copy = [...items];

  if (sort === "newest") {
    return copy.sort((a, b) => getItemDate(b).localeCompare(getItemDate(a)));
  }

  if (sort === "oldest") {
    return copy.sort((a, b) => getItemDate(a).localeCompare(getItemDate(b)));
  }

  if (sort === "top_scored") {
    return copy
      .sort((a, b) => {
        const scoreA =
          typeof (a as { score?: number | null }).score === "number"
            ? ((a as { score?: number | null }).score ?? -1)
            : -1;
        const scoreB =
          typeof (b as { score?: number | null }).score === "number"
            ? ((b as { score?: number | null }).score ?? -1)
            : -1;
        return scoreB - scoreA;
      })
      .slice(0, 5);
  }

  if (getSortOrder) {
    return copy.sort((a, b) => getSortOrder(a) - getSortOrder(b));
  }

  return copy;
}
