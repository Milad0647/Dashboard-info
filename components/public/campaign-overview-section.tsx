"use client";

import { useMemo } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Eye,
  FileText,
  Globe,
  ImageIcon,
  LayoutGrid,
  Megaphone,
  Share2,
  Users,
  Video,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { KPICard } from "@/components/public/kpi-card";
import { UploadActivityChart } from "@/components/charts/upload-activity-chart";
import { OwnerLocationFilterBar } from "@/components/public/owner-location-filter-bar";
import { SectionHeader } from "@/components/public/section-header";
import { useOwnerLocationFilter } from "@/lib/context/owner-location-filter-context";
import {
  computeFilteredCampaignKpis,
  getOwnerFilterLabel,
} from "@/lib/filtered-campaign-kpis";
import { isCampaignContentFilterActive } from "@/lib/campaign-content-filter";
import { buildUploadActivityStats } from "@/lib/upload-activity-stats";
import type { PublicCampaignData } from "@/lib/types";
import { formatPersianDate } from "@/lib/utils";

interface CampaignOverviewSectionProps {
  data: PublicCampaignData;
}

export function CampaignOverviewSection({ data }: CampaignOverviewSectionProps) {
  const { settings } = data;
  const { filter, users: ownerUsers } = useOwnerLocationFilter();
  const filterActive = isCampaignContentFilterActive(filter);
  const filterLabel = getOwnerFilterLabel(filter, ownerUsers);

  const kpis = useMemo(
    () => computeFilteredCampaignKpis(data, filter),
    [data, filter]
  );

  const uploadStats = useMemo(() => buildUploadActivityStats(data), [data]);

  const kpiVisibility = {
    billboards: settings.features.billboards,
    posters: settings.features.posters,
    videos: settings.features.videos,
    analytics: settings.features.analytics && !filterActive,
    socialAnalytics: settings.features.socialAnalytics,
    socialPosts: settings.features.socialPosts ?? true,
    sitePublications: settings.features.sitePublications ?? true,
    activities: settings.features.activities ?? true,
    submissions: settings.features.submissions && !filterActive,
    files: settings.features.files,
  };

  const kpiItems: { show: boolean; title: string; value: number; icon: LucideIcon }[] = [
    { show: kpiVisibility.billboards, title: "بیلبوردها", value: kpis.totalBillboards, icon: LayoutGrid },
    { show: kpiVisibility.posters, title: "پوسترها", value: kpis.totalPosters, icon: ImageIcon },
    { show: kpiVisibility.videos, title: "ویدیوها", value: kpis.totalVideos, icon: Video },
    { show: kpiVisibility.socialAnalytics, title: "فالوور اجتماعی", value: kpis.totalSocialFollowers, icon: Share2 },
    { show: kpiVisibility.socialPosts, title: "بازدید پست‌های اجتماعی", value: kpis.totalSocialPostViews, icon: Eye },
    { show: kpiVisibility.socialPosts, title: "پست‌های اجتماعی", value: kpis.totalSocialPosts, icon: Share2 },
    { show: kpiVisibility.sitePublications, title: "انتشار در سایت", value: kpis.totalSitePublications, icon: Globe },
    { show: kpiVisibility.activities, title: "اقدامات", value: kpis.totalActivities, icon: Megaphone },
    { show: kpiVisibility.submissions, title: "شرکت‌کنندگان", value: kpis.totalParticipants, icon: Users },
    { show: kpiVisibility.files, title: "فایل‌ها", value: kpis.totalFiles, icon: FileText },
  ].filter((item) => item.show);

  return (
    <section id="overview" data-export-section data-export-label="خلاصه کمپین">
      <SectionHeader
        title="خلاصه کمپین"
        description={
          filterLabel
            ? `آمار محتوای کاربران: ${filterLabel}`
            : settings.description
        }
      >
        <Badge status={settings.status}>
          {settings.status === "live" ? "زنده" : settings.status === "completed" ? "پایان‌یافته" : "پیش‌نویس"}
        </Badge>
      </SectionHeader>

      <p className="mb-4 text-sm text-muted-foreground">
        {formatPersianDate(settings.startDate)} — {formatPersianDate(settings.endDate)}
      </p>

      <div className="mb-6">
        <OwnerLocationFilterBar />
      </div>

      {kpiItems.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {kpiItems.map((kpi) => (
            <KPICard key={kpi.title} title={kpi.title} value={kpi.value} icon={kpi.icon} />
          ))}
        </div>
      )}

      <div className="mt-6">
        <UploadActivityChart stats={uploadStats} />
      </div>
    </section>
  );
}
