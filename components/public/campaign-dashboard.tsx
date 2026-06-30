"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CampaignOverviewSection } from "@/components/public/campaign-overview-section";
import { BillboardSection } from "@/components/public/billboard-section";
import { PostersSection } from "@/components/public/posters-section";
import { VideosSection } from "@/components/public/videos-section";
import { AnalyticsSection } from "@/components/public/analytics-section";
import { SocialAnalyticsSection } from "@/components/public/social-analytics-section";
import { SubmissionsSection } from "@/components/public/submissions-section";
import { CampaignFilesSection } from "@/components/public/campaign-files-section";
import { SitePublicationsSection } from "@/components/public/site-publications-section";
import { ActivitiesSection } from "@/components/public/activities-section";
import { SocialPostsSection } from "@/components/public/social-posts-section";
import { BroadcastSection } from "@/components/public/broadcast-section";
import { MeetingsSection } from "@/components/public/meetings-section";
import { DeferredSection } from "@/components/public/deferred-section";
import { CampaignScreenshotExporter } from "@/components/public/campaign-screenshot-exporter";
import { CampaignExportProvider } from "@/lib/context/campaign-export-context";
import { OwnerLocationFilterProvider } from "@/lib/context/owner-location-filter-context";
import type { PublicCampaignData } from "@/lib/types";
import { formatPersianDateTime } from "@/lib/utils";

interface CampaignDashboardProps {
  initialData: PublicCampaignData;
  slug: string;
  exportMode?: boolean;
}

export function CampaignDashboard({ initialData, slug, exportMode = false }: CampaignDashboardProps) {
  const [data, setData] = useState(initialData);
  const [lastRefresh, setLastRefresh] = useState(() => new Date(initialData.lastUpdated));
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshData = useCallback(async () => {
    if (exportMode) return;
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/campaign?slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
      if (res.ok) {
        const newData: PublicCampaignData = await res.json();
        setData(newData);
        setLastRefresh(new Date());
      }
    } catch {
      // Keep existing data
    } finally {
      setIsRefreshing(false);
    }
  }, [slug, exportMode]);

  useEffect(() => {
    if (exportMode) return;
    const interval = setInterval(refreshData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refreshData, exportMode]);

  const { settings, sections } = data;

  return (
    <CampaignExportProvider exportMode={exportMode}>
    <OwnerLocationFilterProvider>
    <div className="min-h-screen" data-campaign-export-root>
      {exportMode && <CampaignScreenshotExporter slug={slug} title={settings.title} />}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div>
            <Link
              href="/"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-1 transition-colors"
              data-export-hide
            >
              <ArrowRight className="h-3 w-3" />
              همه کمپین‌ها
            </Link>
            <h1 className="text-lg font-bold">{settings.title}</h1>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-xs text-muted-foreground hidden sm:block">
              آخرین بروزرسانی: {formatPersianDateTime(lastRefresh.toISOString())}
            </p>
            <Button variant="outline" size="sm" onClick={refreshData} disabled={isRefreshing} data-export-hide>
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              بروزرسانی
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto space-y-8 px-4 py-8 max-w-[1280px]">
        <CampaignOverviewSection data={data} />

        {sections.analytics && (
          <DeferredSection minHeight={320} forceRender={exportMode}>
            <section data-export-section data-export-label="آمار سایت">
              <AnalyticsSection analytics={data.analytics} />
            </section>
          </DeferredSection>
        )}
        {sections.socialAnalytics && (
          <DeferredSection minHeight={280} forceRender={exportMode}>
            <section data-export-section data-export-label="آمار شبکه‌های اجتماعی">
              <SocialAnalyticsSection analytics={data.socialAnalytics} />
            </section>
          </DeferredSection>
        )}
        {sections.billboards && (
          <DeferredSection minHeight={360} forceRender={exportMode}>
            <section data-export-section data-export-label="بیلبوردها">
              <BillboardSection billboards={data.billboards} />
            </section>
          </DeferredSection>
        )}
        {sections.posters && (
          <DeferredSection minHeight={400} forceRender={exportMode}>
            <section data-export-section data-export-label="پوسترها">
              <PostersSection
                categories={data.posterCategories}
                posters={data.posters}
                groups={data.posterGroups}
              />
            </section>
          </DeferredSection>
        )}
        {sections.videos && (
          <DeferredSection minHeight={400} forceRender={exportMode}>
            <section data-export-section data-export-label="ویدیوها">
              <VideosSection
                categories={data.videoCategories}
                videos={data.videos}
                groups={data.videoGroups}
              />
            </section>
          </DeferredSection>
        )}
        {sections.submissions && (
          <DeferredSection minHeight={280} forceRender={exportMode}>
            <section data-export-section data-export-label="مشارکت‌ها">
              <SubmissionsSection
                submissions={data.submissions}
                groups={data.submissionGroups}
                summary={data.submissionSummary}
              />
            </section>
          </DeferredSection>
        )}
        {sections.sitePublications && (
          <DeferredSection minHeight={240} forceRender={exportMode}>
            <section data-export-section data-export-label="انتشار در سایت">
              <SitePublicationsSection
                publications={data.sitePublications}
                groups={data.sitePublicationGroups}
              />
            </section>
          </DeferredSection>
        )}
        {sections.socialPosts && (
          <DeferredSection minHeight={280} forceRender={exportMode}>
            <section data-export-section data-export-label="پست‌های شبکه اجتماعی">
              <SocialPostsSection posts={data.socialPosts} groups={data.socialPostGroups} />
            </section>
          </DeferredSection>
        )}
        {sections.activities && (
          <DeferredSection minHeight={320} forceRender={exportMode}>
            <section data-export-section data-export-label="اقدامات">
              <ActivitiesSection activities={data.activities} groups={data.activityGroups} />
            </section>
          </DeferredSection>
        )}
        {sections.broadcastReports && (
          <DeferredSection minHeight={240} forceRender={exportMode}>
            <section data-export-section data-export-label="پخش صدا و سیما">
              <BroadcastSection reports={data.broadcastReports} groups={data.broadcastReportGroups} />
            </section>
          </DeferredSection>
        )}
        {sections.meetings && (
          <DeferredSection minHeight={280} forceRender={exportMode}>
            <section data-export-section data-export-label="جلسات و مصوبات">
              <MeetingsSection
                meetings={data.meetings}
                groups={data.meetingGroups}
                campaignSlug={slug}
                meetingsHasPassword={data.meetingsHasPassword}
              />
            </section>
          </DeferredSection>
        )}
        {sections.files && (
          <DeferredSection minHeight={200} forceRender={exportMode}>
            <section data-export-section data-export-label="فایل‌ها">
              <CampaignFilesSection files={data.files} groups={data.fileGroups} />
            </section>
          </DeferredSection>
        )}
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        <p>گزارش زنده کمپین — {settings.title}</p>
      </footer>
    </div>
    </OwnerLocationFilterProvider>
    </CampaignExportProvider>
  );
}
