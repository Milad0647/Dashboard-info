import type { CampaignKPIs, PublicCampaignData } from "@/lib/types";
import { getBillboardUploadActivityDate } from "@/lib/billboards";
import { resolveDateFilterRange, isCampaignContentFilterActive } from "@/lib/campaign-content-filter";
import {
  filterItemsByOwnerLocation,
  OWNER_DATE_ALL,
  OWNER_LOCATION_ALL,
  OWNER_USER_ALL,
  type OwnerLocationFilter,
} from "@/lib/owner-location-filter";
import type { OwnerFilterOption } from "@/lib/owner-users";
import { formatPersianDate } from "@/lib/utils";
import { formatPlanLabelDisplay } from "@/lib/content-topics";

const DATE_PRESET_LABELS: Record<string, string> = {
  today: "امروز",
  this_week: "۷ روز اخیر",
  this_month: "۳۰ روز اخیر",
  custom: "بازه دستی",
};

export function getOwnerFilterLabel(
  filter: OwnerLocationFilter,
  users: OwnerFilterOption[] = []
): string | null {
  const parts: string[] = [];

  if (filter.userKey !== OWNER_USER_ALL) {
    parts.push(users.find((user) => user.key === filter.userKey)?.label ?? "شرکت");
  }

  if (filter.province !== OWNER_LOCATION_ALL) {
    parts.push(
      filter.city === OWNER_LOCATION_ALL ? filter.province : `${filter.province} — ${filter.city}`
    );
  }

  if (filter.datePreset !== OWNER_DATE_ALL) {
    if (filter.datePreset === "custom") {
      const range = resolveDateFilterRange(filter);
      if (range) {
        parts.push(`${formatPersianDate(range.from)} تا ${formatPersianDate(range.to)}`);
      } else {
        parts.push(DATE_PRESET_LABELS.custom);
      }
    } else {
      parts.push(DATE_PRESET_LABELS[filter.datePreset] ?? filter.datePreset);
    }
  }

  if (filter.planLabels.length > 0) {
    parts.push(`موضوع: ${filter.planLabels.map((label) => formatPlanLabelDisplay(label)).join("، ")}`);
  }

  if (filter.sortOrder === "newest") parts.push("جدیدترین آپلود");
  if (filter.sortOrder === "oldest") parts.push("قدیمی‌ترین آپلود");
  if (filter.sortOrder === "top_scored") parts.push("۵ برتر (امتیاز)");

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
  if (!isCampaignContentFilterActive(filter)) {
    return data.kpis;
  }

  const { sections } = data;
  const billboards = filterItemsByOwnerLocation(
    data.billboards,
    filter,
    (billboard) => getBillboardUploadActivityDate(billboard)
  );
  const posters = filterItemsByOwnerLocation(data.posters, filter);
  const videos = filterItemsByOwnerLocation(data.videos, filter);
  const socialPosts = filterItemsByOwnerLocation(data.socialPosts, filter);
  const sitePublications = filterItemsByOwnerLocation(data.sitePublications, filter);
  const broadcastReports = filterItemsByOwnerLocation(data.broadcastReports, filter);
  const meetings = filterItemsByOwnerLocation(data.meetings, filter);
  const activities = filterItemsByOwnerLocation(data.activities, filter);
  const pressPublications = filterItemsByOwnerLocation(data.pressPublications, filter);
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
    totalSocialPostViews: sections.socialPosts
      ? socialPosts.reduce((sum, post) => sum + post.views, 0)
      : 0,
    totalSitePublications: sections.sitePublications ? sitePublications.length : 0,
    totalBroadcastReports: sections.broadcastReports ? broadcastReports.length : 0,
    totalMeetings: sections.meetings ? meetings.length : 0,
    totalActivities: sections.activities ? activities.length : 0,
    totalPressPublications: sections.pressPublications ? pressPublications.length : 0,
    totalParticipants: 0,
    totalFiles: sections.files ? files.length : 0,
  };
}
