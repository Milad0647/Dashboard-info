import type { CampaignKPIs, PublicCampaignData } from "@/lib/types";
import {
  filterItemsByOwnerLocation,
  isOwnerFilterActive,
  OWNER_LOCATION_ALL,
  OWNER_USER_ALL,
  type OwnerLocationFilter,
} from "@/lib/owner-location-filter";
import type { OwnerFilterOption } from "@/lib/owner-users";

export function getOwnerFilterLabel(
  filter: OwnerLocationFilter,
  users: OwnerFilterOption[] = []
): string | null {
  const parts: string[] = [];

  if (filter.userKey !== OWNER_USER_ALL) {
    parts.push(users.find((user) => user.key === filter.userKey)?.label ?? "کاربر");
  }

  if (filter.province !== OWNER_LOCATION_ALL) {
    parts.push(
      filter.city === OWNER_LOCATION_ALL ? filter.province : `${filter.province} — ${filter.city}`
    );
  }

  return parts.length > 0 ? parts.join(" · ") : null;
}

/** @deprecated Use getOwnerFilterLabel */
export function getOwnerLocationFilterLabel(
  filter: OwnerLocationFilter,
  users: OwnerFilterOption[] = []
): string | null {
  return getOwnerFilterLabel(filter, users);
}

export function computeFilteredCampaignKpis(
  data: PublicCampaignData,
  filter: OwnerLocationFilter
): CampaignKPIs {
  if (!isOwnerFilterActive(filter)) {
    return data.kpis;
  }

  const { sections } = data;
  const billboards = filterItemsByOwnerLocation(data.billboards, filter);
  const posters = filterItemsByOwnerLocation(data.posters, filter);
  const videos = filterItemsByOwnerLocation(data.videos, filter);
  const socialPosts = filterItemsByOwnerLocation(data.socialPosts, filter);
  const sitePublications = filterItemsByOwnerLocation(data.sitePublications, filter);
  const broadcastReports = filterItemsByOwnerLocation(data.broadcastReports, filter);
  const meetings = filterItemsByOwnerLocation(data.meetings, filter);
  const activities = filterItemsByOwnerLocation(data.activities, filter);
  const submissions = filterItemsByOwnerLocation(data.submissions, filter);
  const files = filterItemsByOwnerLocation(data.files, filter);
  const socialPlatforms = filterItemsByOwnerLocation(data.socialAnalytics.platforms, filter);

  return {
    totalBillboards: sections.billboards ? billboards.length : 0,
    totalPosters: sections.posters ? posters.length : 0,
    totalVideos: sections.videos ? videos.length : 0,
    totalSiteVisitors: 0,
    totalSocialFollowers: sections.socialAnalytics
      ? socialPlatforms.reduce((sum, platform) => sum + platform.followers, 0)
      : 0,
    totalSocialPosts: sections.socialPosts ? socialPosts.length : 0,
    totalSitePublications: sections.sitePublications ? sitePublications.length : 0,
    totalBroadcastReports: sections.broadcastReports ? broadcastReports.length : 0,
    totalMeetings: sections.meetings ? meetings.length : 0,
    totalActivities: sections.activities ? activities.length : 0,
    totalParticipants: sections.submissions
      ? new Set(submissions.map((submission) => submission.participantName)).size
      : 0,
    totalFiles: sections.files ? files.length : 0,
  };
}
