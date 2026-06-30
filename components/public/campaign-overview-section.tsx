"use client";

import { useMemo } from "react";
import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  FileText,
  Globe,
  ImageIcon,
  LayoutGrid,
  Megaphone,
  MonitorPlay,
  Radio,
  Share2,
  Users,
  Video,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { KPICard } from "@/components/public/kpi-card";
import { OwnerLocationFilterBar } from "@/components/public/owner-location-filter-bar";
import { SectionHeader } from "@/components/public/section-header";
import { useOwnerLocationFilter } from "@/lib/context/owner-location-filter-context";
import {
  computeFilteredCampaignKpis,
  getOwnerLocationFilterLabel,
} from "@/lib/filtered-campaign-kpis";
import { isOwnerLocationFilterActive } from "@/lib/owner-location-filter";
import type { CampaignSettings, PublicCampaignData } from "@/lib/types";
import { formatPersianDate } from "@/lib/utils";

interface CampaignOverviewSectionProps {
  data: PublicCampaignData;
}

export function CampaignOverviewSection({ data }: CampaignOverviewSectionProps) {
  const { settings } = data;
  const { filter } = useOwnerLocationFilter();
  const locationFilterActive = isOwnerLocationFilterActive(filter);
  const locationLabel = getOwnerLocationFilterLabel(filter);

  const kpis = useMemo(
    () => computeFilteredCampaignKpis(data, filter),
    [data, filter]
  );

  const kpiVisibility = {
    billboards: settings.features.billboards,
    posters: settings.features.posters,
    videos: settings.features.videos,
    analytics: settings.features.analytics && !locationFilterActive,
    socialAnalytics: settings.features.socialAnalytics,
    socialPosts: settings.features.socialPosts ?? true,
    sitePublications: settings.features.sitePublications ?? true,
    broadcastReports: settings.features.broadcastReports ?? true,
    meetings: settings.features.meetings ?? true,
    activities: settings.features.activities ?? true,
    submissions: settings.features.submissions,
    files: settings.features.files,
  };

  const kpiItems: { show: boolean; title: string; value: number; icon: LucideIcon }[] = [
    { show: kpiVisibility.billboards, title: "بیلبوردها", value: kpis.totalBillboards, icon: LayoutGrid },
    { show: kpiVisibility.posters, title: "پوسترها", value: kpis.totalPosters, icon: ImageIcon },
    { show: kpiVisibility.videos, title: "ویدیوها", value: kpis.totalVideos, icon: Video },
    { show: kpiVisibility.analytics, title: "بازدید سایت", value: kpis.totalSiteVisitors, icon: MonitorPlay },
    { show: kpiVisibility.socialAnalytics, title: "فالوور اجتماعی", value: kpis.totalSocialFollowers, icon: Share2 },
    { show: kpiVisibility.socialPosts, title: "پست‌های اجتماعی", value: kpis.totalSocialPosts, icon: Share2 },
    { show: kpiVisibility.sitePublications, title: "انتشار در سایت", value: kpis.totalSitePublications, icon: Globe },
    { show: kpiVisibility.broadcastReports, title: "گزارش پخش", value: kpis.totalBroadcastReports, icon: Radio },
    { show: kpiVisibility.meetings, title: "جلسات", value: kpis.totalMeetings, icon: CalendarDays },
    { show: kpiVisibility.activities, title: "اقدامات", value: kpis.totalActivities, icon: Megaphone },
    { show: kpiVisibility.submissions, title: "شرکت‌کنندگان", value: kpis.totalParticipants, icon: Users },
    { show: kpiVisibility.files, title: "فایل‌ها", value: kpis.totalFiles, icon: FileText },
  ].filter((item) => item.show);

  return (
    <section id="overview" data-export-section data-export-label="خلاصه کمپین">
      <SectionHeader
        title="خلاصه کمپین"
        description={
          locationLabel
            ? `آمار محتوای کاربران در ${locationLabel}`
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
    </section>
  );
}
