"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  ImageIcon,
  LayoutGrid,
  MonitorPlay,
  RefreshCw,
  Share2,
  Users,
  Video,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KPICard } from "@/components/public/kpi-card";
import { SectionHeader } from "@/components/public/section-header";
import { BillboardSection } from "@/components/public/billboard-section";
import { PostersSection } from "@/components/public/posters-section";
import { VideosSection } from "@/components/public/videos-section";
import { AnalyticsSection } from "@/components/public/analytics-section";
import { SocialAnalyticsSection } from "@/components/public/social-analytics-section";
import { SubmissionsSection } from "@/components/public/submissions-section";
import type { PublicCampaignData } from "@/lib/types";
import { formatPersianDate, formatPersianDateTime } from "@/lib/utils";

interface CampaignDashboardProps {
  initialData: PublicCampaignData;
  slug: string;
}

export function CampaignDashboard({ initialData, slug }: CampaignDashboardProps) {
  const [data, setData] = useState(initialData);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshData = useCallback(async () => {
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
  }, [slug]);

  useEffect(() => {
    const interval = setInterval(refreshData, 30000);
    return () => clearInterval(interval);
  }, [refreshData]);

  const { settings, kpis, sections } = data;

  const kpiItems = [
    { show: sections.billboards, title: "کل بیلبوردها", value: kpis.totalBillboards, icon: LayoutGrid },
    { show: sections.posters, title: "کل پوسترها", value: kpis.totalPosters, icon: ImageIcon },
    { show: sections.videos, title: "کل ویدیوها", value: kpis.totalVideos, icon: Video },
    { show: sections.analytics, title: "بازدید سایت", value: kpis.totalSiteVisitors, icon: MonitorPlay },
    { show: sections.socialAnalytics, title: "دسترسی اجتماعی", value: kpis.totalSocialReach, icon: Share2 },
    { show: sections.submissions, title: "شرکت‌کنندگان", value: kpis.totalParticipants, icon: Users },
  ].filter((k) => k.show);

  return (
    <div className="min-h-screen">
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div>
            <Link
              href="/"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-1 transition-colors"
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
            <Button variant="outline" size="sm" onClick={refreshData} disabled={isRefreshing}>
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              بروزرسانی
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-16">
        <section id="overview">
          <SectionHeader title="خلاصه کمپین" description={settings.description}>
            <Badge status={settings.status}>
              {settings.status === "live" ? "زنده" : settings.status === "completed" ? "پایان‌یافته" : "پیش‌نویس"}
            </Badge>
          </SectionHeader>

          <p className="text-sm text-muted-foreground mb-6">
            {formatPersianDate(settings.startDate)} — {formatPersianDate(settings.endDate)}
          </p>

          {kpiItems.length > 0 && (
            <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${kpiItems.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
              {kpiItems.map((kpi) => (
                <KPICard key={kpi.title} title={kpi.title} value={kpi.value} icon={kpi.icon} />
              ))}
            </div>
          )}
        </section>

        {sections.analytics && <AnalyticsSection analytics={data.analytics} />}
        {sections.socialAnalytics && <SocialAnalyticsSection analytics={data.socialAnalytics} />}
        {sections.billboards && <BillboardSection billboards={data.billboards} />}
        {sections.posters && (
          <PostersSection categories={data.posterCategories} posters={data.posters} />
        )}
        {sections.videos && (
          <VideosSection categories={data.videoCategories} videos={data.videos} />
        )}
        {sections.submissions && (
          <SubmissionsSection submissions={data.submissions} summary={data.submissionSummary} />
        )}
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        <p>گزارش زنده کمپین — {settings.title}</p>
      </footer>
    </div>
  );
}
