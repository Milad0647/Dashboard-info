import { Heart, Share2, Users } from "lucide-react";
import { KPICard } from "@/components/public/kpi-card";
import { SectionHeader } from "@/components/public/section-header";
import { VisitsLineChart } from "@/components/charts/visits-line-chart";
import { TrafficSourcesChart } from "@/components/charts/traffic-sources-chart";
import { BarChartCard } from "@/components/charts/bar-chart-card";
import type { AnalyticsSummary } from "@/lib/types";
import { formatDuration } from "@/lib/utils";

interface SocialAnalyticsSectionProps {
  analytics: AnalyticsSummary;
}

export function SocialAnalyticsSection({ analytics }: SocialAnalyticsSectionProps) {
  return (
    <section id="social-analytics">
      <SectionHeader
        title="آمار شبکه‌های اجتماعی"
        description="آمار بازدید، تعامل و دسترسی در پلتفرم‌های اجتماعی کمپین"
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard title="کل بازدید/دسترسی" value={analytics.totalVisitors} icon={Users} />
        <KPICard title="کاربران یکتا" value={analytics.uniqueVisitors} icon={Share2} />
        <KPICard title="تعامل / بازدید محتوا" value={analytics.pageViews} icon={Heart} />
        <KPICard
          title="میانگین مدت مشاهده"
          value={formatDuration(analytics.avgSessionDuration)}
          icon={Heart}
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <VisitsLineChart data={analytics.visitsOverTime} />
        <TrafficSourcesChart data={analytics.trafficSources} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <BarChartCard
          title="پلتفرم‌ها"
          data={analytics.deviceSplit.map((d) => ({ label: d.device, value: d.count }))}
          color="#db2777"
        />
        <BarChartCard
          title="محتوای پربازدید"
          data={analytics.topPages.map((p) => ({ label: p.page, value: p.views }))}
          color="#9333ea"
        />
        {analytics.visitorLocations.length > 0 && (
          <BarChartCard
            title="موقعیت مخاطبان"
            data={analytics.visitorLocations.map((l) => ({ label: l.city, value: l.count }))}
            color="#ea580c"
          />
        )}
      </div>
    </section>
  );
}
