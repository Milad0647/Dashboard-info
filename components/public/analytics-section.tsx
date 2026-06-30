"use client";

import { Clock, Eye, MousePointerClick, Users } from "lucide-react";
import { KPICard } from "@/components/public/kpi-card";
import { CollapsibleSection } from "@/components/public/collapsible-section";
import { MetabaseDashboardEmbed } from "@/components/public/metabase-dashboard-embed";
import { VisitsLineChart } from "@/components/charts/visits-line-chart";
import { TrafficSourcesChart } from "@/components/charts/traffic-sources-chart";
import { BarChartCard } from "@/components/charts/bar-chart-card";
import { useOwnerLocationFilter } from "@/lib/context/owner-location-filter-context";
import { isOwnerFilterActive } from "@/lib/owner-location-filter";
import type { AnalyticsSummary } from "@/lib/types";
import { formatDuration } from "@/lib/utils";

interface AnalyticsSectionProps {
  analytics: AnalyticsSummary;
}

export function AnalyticsSection({ analytics }: AnalyticsSectionProps) {
  const { filter } = useOwnerLocationFilter();
  const filterActive = isOwnerFilterActive(filter);
  const hasMetabaseDashboard = Boolean(analytics.metabaseEmbedUrl);
  const hasManualCharts =
    analytics.totalVisitors > 0 ||
    analytics.visitsOverTime.length > 0 ||
    analytics.trafficSources.length > 0;

  return (
    <CollapsibleSection
      id="analytics"
      title="آمار بازدید سایت"
      description={
        hasMetabaseDashboard
          ? "داشبورد زنده آمار بازدید سایت از Metabase"
          : "آمار ترافیک و بازدیدکنندگان سایت کمپین"
      }
      lazyMount
    >
      {filterActive ? (
        <div className="rounded-xl border bg-card py-12 text-center text-muted-foreground">
          آمار بازدید سایت با فیلتر کاربر یا موقعیت در دسترس نیست.
        </div>
      ) : (
        <>
          {hasMetabaseDashboard && analytics.metabaseEmbedUrl && (
            <MetabaseDashboardEmbed
              embedUrl={analytics.metabaseEmbedUrl}
              title="آمار بازدید سایت"
            />
          )}

          {!hasMetabaseDashboard && hasManualCharts && (
            <>
              <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <KPICard title="کل بازدیدکنندگان" value={analytics.totalVisitors} icon={Users} />
                <KPICard title="بازدیدکنندگان یکتا" value={analytics.uniqueVisitors} icon={Eye} />
                <KPICard title="بازدید صفحات" value={analytics.pageViews} icon={MousePointerClick} />
                <KPICard
                  title="میانگین مدت نشست"
                  value={formatDuration(analytics.avgSessionDuration)}
                  icon={Clock}
                />
              </div>

              <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
                <VisitsLineChart data={analytics.visitsOverTime} />
                <TrafficSourcesChart data={analytics.trafficSources} />
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <BarChartCard
                  title="دستگاه‌ها"
                  data={analytics.deviceSplit.map((d) => ({ label: d.device, value: d.count }))}
                  color="#16a34a"
                />
                <BarChartCard
                  title="صفحات پربازدید"
                  data={analytics.topPages.map((p) => ({ label: p.page, value: p.views }))}
                  color="#2563eb"
                />
                {analytics.visitorLocations.length > 0 && (
                  <BarChartCard
                    title="موقعیت بازدیدکنندگان"
                    data={analytics.visitorLocations.map((l) => ({ label: l.city, value: l.count }))}
                    color="#7c3aed"
                  />
                )}
              </div>
            </>
          )}
        </>
      )}
    </CollapsibleSection>
  );
}
