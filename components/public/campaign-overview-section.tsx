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
  Newspaper,
  Share2,
  Users,
  Video,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { KPICard } from "@/components/public/kpi-card";
import { UploadActivityChart } from "@/components/charts/upload-activity-chart";
import { OwnerLocationFilterBar } from "@/components/public/owner-location-filter-bar";
import {
  CampaignProgressWidget,
  ContentMixAndActivitySection,
} from "@/components/public/campaign-overview-widgets";
import { SectionHeader } from "@/components/public/section-header";
import { useCampaignScroll } from "@/lib/context/campaign-scroll-context";
import { useOwnerLocationFilter } from "@/lib/context/owner-location-filter-context";
import {
  buildContentMixStats,
  buildRecentActivityFeed,
  computeCampaignProgress,
} from "@/lib/campaign-overview-insights";
import {
  computeFilteredCampaignKpis,
  getOwnerFilterLabel,
} from "@/lib/filtered-campaign-kpis";
import { isCampaignContentFilterActive } from "@/lib/campaign-content-filter";
import { computeKpiTodayDeltas } from "@/lib/kpi-today-deltas";
import { buildUploadActivityStats } from "@/lib/upload-activity-stats";
import type { PublicCampaignData } from "@/lib/types";
import { formatPersianDate } from "@/lib/utils";

interface CampaignOverviewSectionProps {
  data: PublicCampaignData;
}

export function CampaignOverviewSection({ data }: CampaignOverviewSectionProps) {
  const { settings } = data;
  const { filter, users: ownerUsers } = useOwnerLocationFilter();
  const { scrollToSection } = useCampaignScroll();
  const filterActive = isCampaignContentFilterActive(filter);
  const filterLabel = getOwnerFilterLabel(filter, ownerUsers);

  const kpis = useMemo(
    () => computeFilteredCampaignKpis(data, filter),
    [data, filter]
  );

  const uploadStats = useMemo(() => buildUploadActivityStats(data), [data]);
  const todayDeltas = useMemo(() => computeKpiTodayDeltas(data, filter), [data, filter]);
  const campaignProgress = useMemo(
    () => computeCampaignProgress(settings.startDate, settings.endDate),
    [settings.startDate, settings.endDate]
  );
  const contentMix = useMemo(() => buildContentMixStats(data, kpis), [data, kpis]);
  const recentActivity = useMemo(
    () => buildRecentActivityFeed(data, filter, 10),
    [data, filter]
  );

  const kpiVisibility = {
    billboards: settings.features.billboards,
    posters: settings.features.posters,
    videos: settings.features.videos,
    analytics: settings.features.analytics && !filterActive,
    socialAnalytics: settings.features.socialAnalytics,
    socialPosts: settings.features.socialPosts ?? true,
    sitePublications: settings.features.sitePublications ?? true,
    pressPublications: settings.features.pressPublications ?? true,
    activities: settings.features.activities ?? true,
    submissions: settings.features.submissions && !filterActive,
    files: settings.features.files,
  };

  const kpiItems: {
    show: boolean;
    title: string;
    value: number;
    icon: LucideIcon;
    sectionId?: string;
    todayDelta?: number;
    compactValue?: boolean;
  }[] = [
    { show: kpiVisibility.billboards, title: "تبلیغات محیطی", value: kpis.totalBillboards, icon: LayoutGrid, sectionId: "billboards", todayDelta: todayDeltas.billboards },
    { show: kpiVisibility.posters, title: "پوسترها", value: kpis.totalPosters, icon: ImageIcon, sectionId: "posters", todayDelta: todayDeltas.posters },
    { show: kpiVisibility.videos, title: "ویدیوها", value: kpis.totalVideos, icon: Video, sectionId: "videos", todayDelta: todayDeltas.videos },
    { show: kpiVisibility.socialAnalytics, title: "فالوور اجتماعی", value: kpis.totalSocialFollowers, icon: Share2, sectionId: "social-analytics", todayDelta: todayDeltas.socialFollowers },
    { show: kpiVisibility.socialPosts, title: "بازدید پست‌های اجتماعی", value: kpis.totalSocialPostViews, icon: Eye, sectionId: "social-posts", compactValue: true, todayDelta: todayDeltas.socialPostViews },
    { show: kpiVisibility.socialPosts, title: "پست‌های اجتماعی", value: kpis.totalSocialPosts, icon: Share2, sectionId: "social-posts", todayDelta: todayDeltas.socialPosts },
    { show: kpiVisibility.sitePublications, title: "انتشار در سایت", value: kpis.totalSitePublications, icon: Globe, sectionId: "site-publications", todayDelta: todayDeltas.sitePublications },
    { show: kpiVisibility.pressPublications, title: "مجله و روزنامه", value: kpis.totalPressPublications, icon: Newspaper, sectionId: "press-publications", todayDelta: todayDeltas.pressPublications },
    { show: kpiVisibility.activities, title: "اقدامات", value: kpis.totalActivities, icon: Megaphone, sectionId: "activities", todayDelta: todayDeltas.activities },
    { show: kpiVisibility.submissions, title: "شرکت‌کنندگان", value: kpis.totalParticipants, icon: Users, sectionId: "submissions", todayDelta: todayDeltas.submissions },
    { show: kpiVisibility.files, title: "فایل‌ها", value: kpis.totalFiles, icon: FileText, sectionId: "files", todayDelta: todayDeltas.files },
  ].filter((item) => item.show);

  return (
    <section id="overview" data-export-section data-export-label="خلاصه کمپین">
      <SectionHeader
        title="خلاصه کمپین"
        description={
          filterLabel
            ? `آمار محتوای شرکت‌ها: ${filterLabel}`
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
            <KPICard
              key={kpi.title}
              title={kpi.title}
              value={kpi.value}
              icon={kpi.icon}
              todayDelta={kpi.todayDelta}
              compactValue={kpi.compactValue}
              onClick={kpi.sectionId ? () => scrollToSection(kpi.sectionId!) : undefined}
            />
          ))}
        </div>
      )}

      <div className="mt-6 space-y-4">
        <CampaignProgressWidget progress={campaignProgress} />
        <ContentMixAndActivitySection contentMix={contentMix} items={recentActivity} />
      </div>

      <div className="mt-6">
        <UploadActivityChart stats={uploadStats} />
      </div>
    </section>
  );
}
