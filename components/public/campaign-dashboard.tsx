"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, RefreshCw, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  CampaignHeaderAuth,
  type CampaignHeaderUser,
} from "@/components/public/campaign-header-auth";
import { CampaignOverviewSection } from "@/components/public/campaign-overview-section";
import { BillboardSection } from "@/components/public/billboard-section";
import { PostersSection } from "@/components/public/posters-section";
import { VideosSection } from "@/components/public/videos-section";
import { AnalyticsSection } from "@/components/public/analytics-section";
import { SocialAnalyticsSection } from "@/components/public/social-analytics-section";
import { SubmissionsSection } from "@/components/public/submissions-section";
import { CampaignFilesSection } from "@/components/public/campaign-files-section";
import { RawMediaSection } from "@/components/public/raw-media-section";
import { SitePublicationsSection } from "@/components/public/site-publications-section";
import { ActivitiesSection } from "@/components/public/activities-section";
import { PressPublicationsSection } from "@/components/public/press-publications-section";
import { SocialPostsSection } from "@/components/public/social-posts-section";
import { BroadcastSection } from "@/components/public/broadcast-section";
import { MeetingsSection } from "@/components/public/meetings-section";
import { DeferredSection } from "@/components/public/deferred-section";
import { CampaignScreenshotExporter } from "@/components/public/campaign-screenshot-exporter";
import { ScrollToTopButton } from "@/components/ui/scroll-to-top-button";
import { CampaignExportProvider } from "@/lib/context/campaign-export-context";
import { CampaignScrollProvider, useCampaignScroll } from "@/lib/context/campaign-scroll-context";
import { ContentScoreProvider } from "@/lib/context/content-score-context";
import {
  collectCampaignOwnerLocations,
  OwnerLocationFilterProvider,
  useOwnerLocationFilter,
} from "@/lib/context/owner-location-filter-context";
import { isCampaignContentFilterActive } from "@/lib/campaign-content-filter";
import { collectOwnerFilterOptions } from "@/lib/owner-users";
import type { DataOwnerGroup, Ownable, PublicCampaignData } from "@/lib/types";
import { formatPersianDateTime } from "@/lib/utils";

interface CampaignDashboardProps {
  initialData: PublicCampaignData;
  slug: string;
  exportMode?: boolean;
  canScore?: boolean;
  headerUser?: CampaignHeaderUser | null;
}

function collectAllOwnerGroups(data: PublicCampaignData): DataOwnerGroup<Ownable>[] {
  return [
    ...data.billboardGroups,
    ...data.posterGroups,
    ...data.videoGroups,
    ...data.socialPostGroups,
    ...data.sitePublicationGroups,
    ...data.activityGroups,
    ...data.broadcastReportGroups,
    ...data.meetingGroups,
    ...data.fileGroups,
    ...data.rawMediaGroups,
    ...data.submissionGroups,
  ];
}

function CampaignDashboardBody({
  data,
  slug,
  exportMode,
  lastRefresh,
  isRefreshing,
  onRefresh,
  headerUser,
}: {
  data: PublicCampaignData;
  slug: string;
  exportMode: boolean;
  lastRefresh: Date;
  isRefreshing: boolean;
  onRefresh: () => void;
  headerUser: CampaignHeaderUser | null;
}) {
  const { settings, sections } = data;
  const { filter } = useOwnerLocationFilter();
  const { forceSectionsMounted } = useCampaignScroll();
  const contentFilterActive = isCampaignContentFilterActive(filter);
  const forceRender = exportMode || forceSectionsMounted;

  return (
    <div className="min-h-screen" data-campaign-export-root>
      {exportMode && <CampaignScreenshotExporter slug={slug} title={settings.title} />}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div>
            <Link
              href="/"
              className="group text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-1 transition-colors duration-[var(--duration-apple-fast)] ease-[var(--ease-apple-soft)]"
              data-export-hide
            >
              <ArrowRight className="h-3 w-3 transition-transform duration-[var(--duration-apple)] ease-[var(--ease-apple)] group-hover:translate-x-0.5" />
              همه کمپین‌ها
            </Link>
            <h1 className="text-lg font-bold">{settings.title}</h1>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-xs text-muted-foreground hidden sm:block">
              آخرین بروزرسانی: {formatPersianDateTime(lastRefresh.toISOString())}
            </p>
            <span data-export-hide>
              <ThemeToggle />
            </span>
            <CampaignHeaderAuth user={headerUser} returnPath={`/campaign/${slug}`} />
            <Button variant="outline" size="sm" asChild data-export-hide>
              <Link href={`/campaign/${slug}/cities`}>
                <Trophy className="h-4 w-4" />
                رتبه‌بندی استان‌ها
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={onRefresh} disabled={isRefreshing} data-export-hide>
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              بروزرسانی
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-[1280px] space-y-8 overflow-x-hidden px-4 py-8">
        <CampaignOverviewSection data={data} />

        {sections.analytics && !contentFilterActive && (
          <DeferredSection minHeight={320} forceRender={forceRender}>
            <section data-export-section data-export-label="آمار سایت کمپین">
              <AnalyticsSection analytics={data.analytics} />
            </section>
          </DeferredSection>
        )}

        {sections.billboards && (
          <DeferredSection minHeight={360} forceRender={forceRender}>
            <section data-export-section data-export-label="تبلیغات محیطی">
              <BillboardSection
                billboards={data.billboards}
                adminOwnerLabel={settings.adminOwnerLabel}
              />
            </section>
          </DeferredSection>
        )}

        {sections.posters && (
          <DeferredSection minHeight={400} forceRender={forceRender}>
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
          <DeferredSection minHeight={400} forceRender={forceRender}>
            <section data-export-section data-export-label="ویدیوها">
              <VideosSection
                categories={data.videoCategories}
                videos={data.videos}
                groups={data.videoGroups}
              />
            </section>
          </DeferredSection>
        )}

        {sections.sitePublications && (
          <DeferredSection minHeight={240} forceRender={forceRender}>
            <section data-export-section data-export-label="انتشار در سایت">
              <SitePublicationsSection
                publications={data.sitePublications}
                groups={data.sitePublicationGroups}
              />
            </section>
          </DeferredSection>
        )}

        {sections.socialAnalytics && (
          <DeferredSection minHeight={280} forceRender={forceRender}>
            <section data-export-section data-export-label="آمار شبکه‌های اجتماعی">
              <SocialAnalyticsSection
                analytics={data.socialAnalytics}
                adminOwnerLabel={settings.adminOwnerLabel}
              />
            </section>
          </DeferredSection>
        )}

        {sections.socialPosts && (
          <DeferredSection minHeight={280} forceRender={forceRender}>
            <section data-export-section data-export-label="پست‌های شبکه اجتماعی">
              <SocialPostsSection posts={data.socialPosts} groups={data.socialPostGroups} />
            </section>
          </DeferredSection>
        )}

        {sections.pressPublications && (
          <DeferredSection minHeight={320} forceRender={forceRender}>
            <section data-export-section data-export-label="مجله و روزنامه">
              <PressPublicationsSection
                publications={data.pressPublications}
                groups={data.pressPublicationGroups}
              />
            </section>
          </DeferredSection>
        )}

        {sections.activities && (
          <DeferredSection minHeight={320} forceRender={forceRender}>
            <section data-export-section data-export-label="اقدامات">
              <ActivitiesSection
                activities={data.activities}
                groups={data.activityGroups}
                sectionId="activities"
              />
            </section>
          </DeferredSection>
        )}

        {sections.broadcastReports && (
          <DeferredSection minHeight={240} forceRender={forceRender}>
            <section data-export-section data-export-label="پخش صدا و سیما">
              <BroadcastSection reports={data.broadcastReports} groups={data.broadcastReportGroups} />
            </section>
          </DeferredSection>
        )}

        {sections.meetings && (
          <DeferredSection minHeight={280} forceRender={forceRender}>
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
          <DeferredSection minHeight={200} forceRender={forceRender}>
            <section data-export-section data-export-label="فایل‌ها">
              <CampaignFilesSection files={data.files} groups={data.fileGroups} />
            </section>
          </DeferredSection>
        )}

        {sections.rawMedia && (
          <DeferredSection minHeight={240} forceRender={forceRender}>
            <section data-export-section data-export-label="راش تصویر">
              <RawMediaSection
                items={data.rawMedia}
                groups={data.rawMediaGroups}
                storage={data.rawMediaStorage}
                campaignId={data.settings.id}
              />
            </section>
          </DeferredSection>
        )}

        {sections.submissions && !contentFilterActive && (
          <DeferredSection minHeight={280} forceRender={forceRender}>
            <section data-export-section data-export-label="مشارکت‌ها">
              <SubmissionsSection
                submissions={data.submissions}
                groups={data.submissionGroups}
                summary={data.submissionSummary}
              />
            </section>
          </DeferredSection>
        )}
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        <p>گزارش زنده کمپین — {settings.title}</p>
      </footer>

      {!exportMode && <ScrollToTopButton />}
    </div>
  );
}

export function CampaignDashboard({
  initialData,
  slug,
  exportMode = false,
  canScore = false,
  headerUser = null,
}: CampaignDashboardProps) {
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

  const ownerUsers = useMemo(() => collectOwnerFilterOptions(data), [data]);
  const ownerLocations = useMemo(
    () => collectCampaignOwnerLocations(collectAllOwnerGroups(data)),
    [data]
  );

  return (
    <CampaignExportProvider exportMode={exportMode}>
      <CampaignScrollProvider>
        <ContentScoreProvider canScore={canScore} campaignId={data.settings.id}>
          <OwnerLocationFilterProvider
            users={ownerUsers}
            locations={ownerLocations}
            plans={data.settings.contentPlans ?? []}
          >
            <CampaignDashboardBody
              data={data}
              slug={slug}
              exportMode={exportMode}
              lastRefresh={lastRefresh}
              isRefreshing={isRefreshing}
              onRefresh={refreshData}
              headerUser={headerUser}
            />
          </OwnerLocationFilterProvider>
        </ContentScoreProvider>
      </CampaignScrollProvider>
    </CampaignExportProvider>
  );
}
