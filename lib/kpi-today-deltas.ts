import { isoFromGregorian } from "@/lib/jalali";
import { isCampaignContentFilterActive } from "@/lib/campaign-content-filter";
import { filterItemsByOwnerLocation, type OwnerLocationFilter } from "@/lib/owner-location-filter";
import type { Ownable, PublicCampaignData } from "@/lib/types";

export interface KpiTodayDeltas {
  billboards: number;
  posters: number;
  videos: number;
  socialPosts: number;
  sitePublications: number;
  activities: number;
  files: number;
}

function todayIso(): string {
  const date = new Date();
  return isoFromGregorian(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

function countCreatedToday<T extends Ownable & { createdAt: string }>(
  items: T[],
  filter: OwnerLocationFilter,
  getItemDate?: (item: T) => string | undefined
): number {
  const today = todayIso();
  const scoped = isCampaignContentFilterActive(filter)
    ? filterItemsByOwnerLocation(items, filter, getItemDate)
    : items;

  return scoped.filter((item) => {
    const date = (getItemDate?.(item) ?? item.createdAt).slice(0, 10);
    return date === today;
  }).length;
}

export function computeKpiTodayDeltas(
  data: PublicCampaignData,
  filter: OwnerLocationFilter
): KpiTodayDeltas {
  const { sections } = data;

  return {
    billboards: sections.billboards
      ? countCreatedToday(data.billboards, filter, (billboard) => billboard.date)
      : 0,
    posters: sections.posters ? countCreatedToday(data.posters, filter) : 0,
    videos: sections.videos ? countCreatedToday(data.videos, filter) : 0,
    socialPosts: sections.socialPosts ? countCreatedToday(data.socialPosts, filter) : 0,
    sitePublications: sections.sitePublications
      ? countCreatedToday(data.sitePublications, filter)
      : 0,
    activities: sections.activities ? countCreatedToday(data.activities, filter) : 0,
    files: sections.files ? countCreatedToday(data.files, filter) : 0,
  };
}
