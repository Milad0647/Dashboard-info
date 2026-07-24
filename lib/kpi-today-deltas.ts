import { isCampaignContentFilterActive } from "@/lib/campaign-content-filter";
import { countsAsTodayBillboardUpload } from "@/lib/billboards";
import { filterItemsByOwnerLocation, type OwnerLocationFilter } from "@/lib/owner-location-filter";
import {
  getSafeCreatedTimestamp,
  getTehranCalendarDateIso,
  isSameDay,
} from "@/lib/safe-dates";
import type { Billboard, Ownable, PublicCampaignData, SocialPlatformStat } from "@/lib/types";

export interface KpiTodayDeltas {
  billboards: number;
  posters: number;
  videos: number;
  socialFollowers: number;
  socialPostViews: number;
  socialPosts: number;
  sitePublications: number;
  activities: number;
  pressPublications: number;
  broadcastReports: number;
  meetings: number;
  rawMedia: number;
  submissions: number;
  files: number;
}

function resolveItemCreatedAt<T extends Ownable & { createdAt?: string | null; updatedAt?: string | null }>(
  item: T,
  getItemDate?: (item: T) => string | undefined
): string {
  return getItemDate?.(item) ?? getSafeCreatedTimestamp(item);
}

function countCreatedToday<T extends Ownable & { createdAt?: string | null; updatedAt?: string | null }>(
  items: T[],
  filter: OwnerLocationFilter,
  getItemDate?: (item: T) => string | undefined
): number {
  const today = getTehranCalendarDateIso();
  const scoped = isCampaignContentFilterActive(filter)
    ? filterItemsByOwnerLocation(items, filter, getItemDate)
    : items;

  return scoped.filter((item) => isSameDay(resolveItemCreatedAt(item, getItemDate), today)).length;
}

function countUniqueParticipantsToday(
  submissions: PublicCampaignData["submissions"],
  filter: OwnerLocationFilter
): number {
  const today = getTehranCalendarDateIso();
  const scoped = isCampaignContentFilterActive(filter)
    ? filterItemsByOwnerLocation(submissions, filter)
    : submissions;

  const names = new Set<string>();
  for (const submission of scoped) {
    if (!isSameDay(getSafeCreatedTimestamp(submission), today)) continue;
    const name = submission.participantName.trim();
    if (name) names.add(name);
  }
  return names.size;
}

/**
 * Platforms added today contribute their follower count so the badge unit
 * matches the card (followers), not platform row count.
 */
function sumFollowersFromPlatformsCreatedToday(
  platforms: SocialPlatformStat[],
  filter: OwnerLocationFilter
): number {
  const today = getTehranCalendarDateIso();
  const scoped = isCampaignContentFilterActive(filter)
    ? filterItemsByOwnerLocation(platforms, filter)
    : platforms;

  return scoped
    .filter((platform) => isSameDay(getSafeCreatedTimestamp(platform), today))
    .reduce((sum, platform) => sum + platform.followers, 0);
}

function countBillboardsToday(billboards: Billboard[], filter: OwnerLocationFilter): number {
  const scoped = isCampaignContentFilterActive(filter)
    ? filterItemsByOwnerLocation(billboards, filter, (billboard) => getSafeCreatedTimestamp(billboard))
    : billboards;

  return scoped.filter((billboard) => countsAsTodayBillboardUpload(billboard)).length;
}

export function computeKpiTodayDeltas(
  data: PublicCampaignData,
  filter: OwnerLocationFilter
): KpiTodayDeltas {
  const { sections } = data;

  const activitiesToday = sections.activities
    ? countCreatedToday(data.activities, filter)
    : 0;
  const pressToday = sections.pressPublications
    ? countCreatedToday(data.pressPublications, filter)
    : 0;

  return {
    billboards: sections.billboards ? countBillboardsToday(data.billboards, filter) : 0,
    posters: sections.posters ? countCreatedToday(data.posters, filter) : 0,
    videos: sections.videos ? countCreatedToday(data.videos, filter) : 0,
    socialFollowers: sections.socialAnalytics
      ? sumFollowersFromPlatformsCreatedToday(data.socialAnalytics.platforms, filter)
      : 0,
    // Lifetime views on posts uploaded today are not "views gained today".
    // Without view snapshots we omit a misleading badge (card shows 0 → hidden).
    socialPostViews: 0,
    socialPosts: sections.socialPosts ? countCreatedToday(data.socialPosts, filter) : 0,
    sitePublications: sections.sitePublications
      ? countCreatedToday(data.sitePublications, filter)
      : 0,
    // Keep activities separate from press so KPI cards do not double-count.
    activities: activitiesToday,
    pressPublications: pressToday,
    broadcastReports: sections.broadcastReports
      ? countCreatedToday(data.broadcastReports, filter)
      : 0,
    meetings: sections.meetings
      ? countCreatedToday(data.meetings, filter, (meeting) => meeting.meetingDate)
      : 0,
    rawMedia: sections.rawMedia ? countCreatedToday(data.rawMedia, filter) : 0,
    submissions: sections.submissions ? countUniqueParticipantsToday(data.submissions, filter) : 0,
    files: sections.files ? countCreatedToday(data.files, filter) : 0,
  };
}
