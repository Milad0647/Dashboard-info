"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AdminContentFilterBar,
  collectAdminFilterLocations,
  collectAdminFilterUsers,
  DEFAULT_ADMIN_CONTENT_FILTER,
  matchesAdminContentFilter,
  type AdminContentFilterState,
  type AdminFilterLocations,
  type AdminFilterUserOption,
} from "@/components/admin/admin-content-filter-bar";
import { DashboardCompletenessCards } from "@/components/admin/dashboard-completeness-cards";
import { BillboardCategoryChart } from "@/components/charts/billboard-category-chart";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  DASHBOARD_STAT_DEFINITIONS,
  type AdminDashboardData,
} from "@/lib/admin-dashboard-stats";
import { buildBillboardCategoryStats } from "@/lib/billboard-categories";
import {
  buildCategoryCompleteness,
  type EditSuggestionContentType,
} from "@/lib/edit-suggestions";
import { adminHref, formatPersianNumber } from "@/lib/utils";
import type {
  AdminUser,
  AnalyticsMetric,
  Billboard,
  BroadcastReport,
  CampaignActivity,
  CampaignFile,
  CampaignMeeting,
  CampaignSubmission,
  Ownable,
  Poster,
  PosterVersion,
  RawMediaUpload,
  SmsSendReport,
  SocialMediaPost,
  SocialPlatformStat,
  Video,
  VideoVersion,
} from "@/lib/types";

interface AdminDashboardFilteredStatsProps {
  campaignId: string;
  contentPlans?: string[];
  users?: AdminUser[];
  showUserFilter?: boolean;
  showOwnerHint?: boolean;
  completenessOwnerUserId?: string;
  billboards: Billboard[];
  posters: Poster[];
  posterVersions: PosterVersion[];
  videos: Video[];
  videoVersions: VideoVersion[];
  files: CampaignFile[];
  rawMedia: RawMediaUpload[];
  submissions: CampaignSubmission[];
  analytics: AnalyticsMetric[];
  socialPosts: SocialMediaPost[];
  socialPlatformStats: SocialPlatformStat[];
  broadcastReports: BroadcastReport[];
  meetings: CampaignMeeting[];
  activities: CampaignActivity[];
  smsReports: SmsSendReport[];
  /** Which dashboard cards are visible for this user (by href). */
  visibleHrefs: string[];
  showBillboardCategoryChart: boolean;
  showSubmissionsAlert: boolean;
}

function filterOwnables<T extends Ownable>(
  items: T[],
  filter: AdminContentFilterState
): T[] {
  return items.filter((item) => matchesAdminContentFilter(item, filter));
}

function locationsFromUsers(users: AdminUser[]): AdminFilterLocations {
  const provinceSet = new Set<string>();
  const citiesByProvince = new Map<string, Set<string>>();

  for (const user of users) {
    const province = user.province?.trim();
    if (!province) continue;
    provinceSet.add(province);
    if (!citiesByProvince.has(province)) {
      citiesByProvince.set(province, new Set());
    }
    const city = user.city?.trim();
    if (city) citiesByProvince.get(province)?.add(city);
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

function mergeLocations(
  a: AdminFilterLocations,
  b: AdminFilterLocations
): AdminFilterLocations {
  const provinceSet = new Set([...a.provinces, ...b.provinces]);
  const citiesByProvince: Record<string, string[]> = {};
  for (const province of provinceSet) {
    const merged = new Set([
      ...(a.citiesByProvince[province] ?? []),
      ...(b.citiesByProvince[province] ?? []),
    ]);
    citiesByProvince[province] = [...merged].sort((x, y) => x.localeCompare(y, "fa"));
  }
  return {
    provinces: [...provinceSet].sort((x, y) => x.localeCompare(y, "fa")),
    citiesByProvince,
  };
}

function usersFromAdminUsers(users: AdminUser[]): AdminFilterUserOption[] {
  return users
    .map((user) => ({
      key: user.id,
      label: user.name?.trim() || user.email,
      province: user.province,
      city: user.city,
      companyType: user.companyType ?? null,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "fa"));
}

export function AdminDashboardFilteredStats({
  campaignId,
  contentPlans = [],
  users = [],
  showUserFilter = false,
  showOwnerHint = false,
  completenessOwnerUserId,
  billboards,
  posters,
  posterVersions,
  videos,
  videoVersions,
  files,
  rawMedia,
  submissions,
  analytics,
  socialPosts,
  socialPlatformStats,
  broadcastReports,
  meetings,
  activities,
  smsReports,
  visibleHrefs,
  showBillboardCategoryChart,
  showSubmissionsAlert,
}: AdminDashboardFilteredStatsProps) {
  const [contentFilter, setContentFilter] = useState<AdminContentFilterState>(
    DEFAULT_ADMIN_CONTENT_FILTER
  );

  const allOwnables = useMemo(
    () =>
      [
        ...billboards,
        ...posters,
        ...videos,
        ...files,
        ...rawMedia,
        ...submissions,
        ...socialPosts,
        ...socialPlatformStats,
        ...broadcastReports,
        ...meetings,
        ...activities,
        ...smsReports,
      ] as Ownable[],
    [
      billboards,
      posters,
      videos,
      files,
      rawMedia,
      submissions,
      socialPosts,
      socialPlatformStats,
      broadcastReports,
      meetings,
      activities,
      smsReports,
    ]
  );

  const filterUsers = useMemo(() => {
    if (!showUserFilter) return [];
    const fromUsers = usersFromAdminUsers(users);
    if (fromUsers.length > 0) return fromUsers;
    return collectAdminFilterUsers(allOwnables);
  }, [showUserFilter, users, allOwnables]);

  const filterLocations = useMemo(
    () => mergeLocations(collectAdminFilterLocations(allOwnables), locationsFromUsers(users)),
    [allOwnables, users]
  );

  const filtered = useMemo(() => {
    return {
      billboards: filterOwnables(billboards, contentFilter),
      posters: filterOwnables(posters, contentFilter),
      videos: filterOwnables(videos, contentFilter),
      files: filterOwnables(files, contentFilter),
      rawMedia: filterOwnables(rawMedia, contentFilter),
      submissions: filterOwnables(submissions, contentFilter),
      socialPosts: filterOwnables(socialPosts, contentFilter),
      socialPlatformStats: filterOwnables(socialPlatformStats, contentFilter),
      broadcastReports: filterOwnables(broadcastReports, contentFilter),
      meetings: filterOwnables(meetings, contentFilter),
      activities: filterOwnables(activities, contentFilter),
      smsReports: filterOwnables(smsReports, contentFilter),
      analytics: filterOwnables(analytics, contentFilter),
    };
  }, [
    billboards,
    posters,
    videos,
    files,
    rawMedia,
    submissions,
    socialPosts,
    socialPlatformStats,
    broadcastReports,
    meetings,
    activities,
    smsReports,
    analytics,
    contentFilter,
  ]);

  const dashboardData = useMemo<AdminDashboardData>(
    () => ({
      posters: filtered.posters,
      videos: filtered.videos,
      files: filtered.files,
      rawMedia: filtered.rawMedia,
      submissions: filtered.submissions,
      analytics: filtered.analytics,
      socialPosts: filtered.socialPosts,
      socialPlatformStats: filtered.socialPlatformStats,
      broadcastReports: filtered.broadcastReports,
      meetings: filtered.meetings,
      activities: filtered.activities,
      smsReports: filtered.smsReports,
    }),
    [filtered]
  );

  const completenessByType = useMemo(() => {
    const map = new Map<EditSuggestionContentType, ReturnType<typeof buildCategoryCompleteness>[number]>();
    for (const summary of buildCategoryCompleteness({
      campaignId,
      ownerUserId: completenessOwnerUserId,
      posters: filtered.posters,
      posterVersions,
      videos: filtered.videos,
      videoVersions,
      socialPosts: filtered.socialPosts,
      billboards: filtered.billboards,
      files: filtered.files,
      rawMedia: filtered.rawMedia,
      broadcastReports: filtered.broadcastReports,
      meetings: filtered.meetings,
      activities: filtered.activities,
    })) {
      map.set(summary.contentType, summary);
    }
    return map;
  }, [
    campaignId,
    completenessOwnerUserId,
    filtered,
    posterVersions,
    videoVersions,
  ]);

  const visibleHrefSet = useMemo(() => new Set(visibleHrefs), [visibleHrefs]);

  const cards = useMemo(
    () =>
      DASHBOARD_STAT_DEFINITIONS.filter((definition) =>
        visibleHrefSet.has(definition.href)
      ).map((definition) => {
        const contentType = definition.completenessContentType;
        return {
          label: definition.label,
          value: definition.getCount(dashboardData, filtered.billboards),
          href: adminHref(definition.href, campaignId),
          icon: definition.icon,
          completeness: contentType ? completenessByType.get(contentType) : undefined,
          showOwnerHint,
        };
      }),
    [
      visibleHrefSet,
      campaignId,
      dashboardData,
      filtered.billboards,
      completenessByType,
      showOwnerHint,
    ]
  );

  const billboardCategoryStats = useMemo(
    () =>
      showBillboardCategoryChart ? buildBillboardCategoryStats(filtered.billboards) : [],
    [showBillboardCategoryChart, filtered.billboards]
  );

  const pendingSubmissions = useMemo(
    () => filtered.submissions.filter((item) => item.status === "pending").length,
    [filtered.submissions]
  );

  return (
    <div className="space-y-6">
      <AdminContentFilterBar
        filter={contentFilter}
        onChange={setContentFilter}
        users={filterUsers}
        plans={contentPlans}
        locations={filterLocations}
      />

      {cards.length > 0 ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-emerald-700">کامل = سبز</span>
            <span className="rounded-full bg-amber-400/20 px-2 py-1 text-amber-800">ناقص جزئی = زرد</span>
            <span className="rounded-full bg-red-500/15 px-2 py-1 text-red-700">ناقص کامل = قرمز</span>
          </div>
          <DashboardCompletenessCards cards={cards} />
        </div>
      ) : (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            هیچ بخشی برای نمایش نیست.
          </CardContent>
        </Card>
      )}

      {billboardCategoryStats.length > 0 && (
        <BillboardCategoryChart data={billboardCategoryStats} />
      )}

      {showSubmissionsAlert && pendingSubmissions > 0 && (
        <Card className="border-warning/30 bg-warning/10">
          <CardContent className="flex items-center justify-between p-4">
            <p className="text-sm">
              {formatPersianNumber(pendingSubmissions)} ارسال در انتظار بررسی
            </p>
            <Link href={adminHref("/admin/submissions", campaignId)}>
              <Badge variant="warning" className="cursor-pointer">
                مشاهده
              </Badge>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
