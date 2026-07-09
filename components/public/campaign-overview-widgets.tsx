"use client";

import { Clock, TrendingUp } from "lucide-react";
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

export function ContentMixOverviewChart({ data }: { data: ContentMixItem[] }) {
  return <ContentMixChart data={data} />;
}

interface RecentActivityFeedProps {
  items: RecentActivityItem[];
  limit?: number;
}

export function RecentActivityFeed({ items, limit = 10 }: RecentActivityFeedProps) {
  const visibleItems = items.slice(0, limit);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            فعالیت اخیر
          </span>
          {visibleItems.length > 0 && (
            <span className="text-xs font-normal text-muted-foreground">
              {formatPersianNumber(visibleItems.length)} مورد اخیر
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {visibleItems.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            هنوز فعالیتی ثبت نشده است.
          </p>
        ) : (
          <ul className="divide-y">
            {visibleItems.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-semibold">{item.ownerName}</p>
                  <p className="text-sm text-muted-foreground">{item.typeLabel}</p>
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
