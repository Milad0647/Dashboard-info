"use client";

import { Clock, TrendingUp } from "lucide-react";
import { BarChartCard } from "@/components/charts/bar-chart-card";
import { ContentMixChart } from "@/components/charts/content-mix-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  CampaignProgressSummary,
  ContentMixItem,
  RecentActivityItem,
} from "@/lib/campaign-overview-insights";
import { formatPersianDateTime, formatPersianNumber } from "@/lib/utils";

interface CampaignProgressWidgetProps {
  progress: CampaignProgressSummary;
}

function getProgressLabel(progress: CampaignProgressSummary): string {
  if (progress.phase === "not_started") return "کمپین هنوز شروع نشده";
  if (progress.phase === "completed") return "کمپین به پایان رسیده";
  return `${formatPersianNumber(progress.daysRemaining)} روز تا پایان`;
}

export function CampaignProgressWidget({ progress }: CampaignProgressWidgetProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4 text-primary" />
          پیشرفت کمپین
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{getProgressLabel(progress)}</span>
          <span className="font-semibold">{formatPersianNumber(progress.percent)}٪</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span>روز سپری‌شده: {formatPersianNumber(progress.daysElapsed)}</span>
          <span>کل روزها: {formatPersianNumber(progress.totalDays)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

interface CampaignOverviewChartsProps {
  contentMix: ContentMixItem[];
  provinceChartData: { label: string; value: number }[];
}

export function CampaignOverviewCharts({
  contentMix,
  provinceChartData,
}: CampaignOverviewChartsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <ContentMixChart data={contentMix} />
      <BarChartCard
        data={provinceChartData}
        title="امتیاز استان‌ها (۱۰ استان برتر)"
        color="#2563eb"
      />
    </div>
  );
}

interface RecentActivityFeedProps {
  items: RecentActivityItem[];
}

export function RecentActivityFeed({ items }: RecentActivityFeedProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4 text-primary" />
          فعالیت اخیر
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            هنوز فعالیتی ثبت نشده است.
          </p>
        ) : (
          <ul className="divide-y">
            {items.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-medium">
                    {item.ownerName}
                    <span className="font-normal text-muted-foreground"> — {item.typeLabel}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatPersianDateTime(item.timestamp)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
