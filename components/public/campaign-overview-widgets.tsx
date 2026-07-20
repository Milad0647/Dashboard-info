"use client";

import { useState } from "react";
import { ChevronLeft, Clock, TrendingUp } from "lucide-react";
import { ContentMixChart } from "@/components/charts/content-mix-chart";
import { ShowMoreButton } from "@/components/public/show-more-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  CampaignProgressSummary,
  ContentMixItem,
  RecentActivityItem,
} from "@/lib/campaign-overview-insights";
import { useCampaignScroll } from "@/lib/context/campaign-scroll-context";
import { formatPersianDateTime, formatPersianNumber } from "@/lib/utils";

const RECENT_ACTIVITY_INITIAL_LIMIT = 5;
const RECENT_ACTIVITY_EXPANDED_LIMIT = 10;

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
  return (
    <div className="h-full">
      <ContentMixChart data={data} />
    </div>
  );
}

interface ContentMixAndActivitySectionProps {
  contentMix: ContentMixItem[];
  items: RecentActivityItem[];
}

export function ContentMixAndActivitySection({
  contentMix,
  items,
}: ContentMixAndActivitySectionProps) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <ContentMixOverviewChart data={contentMix} />
      <RecentActivityFeed items={items} />
    </div>
  );
}

interface RecentActivityFeedProps {
  items: RecentActivityItem[];
  initialLimit?: number;
  expandedLimit?: number;
}

function sectionIdFromHref(href?: string): string | null {
  if (!href?.startsWith("#")) return null;
  const id = href.slice(1).trim();
  return id || null;
}

export function RecentActivityFeed({
  items,
  initialLimit = RECENT_ACTIVITY_INITIAL_LIMIT,
  expandedLimit = RECENT_ACTIVITY_EXPANDED_LIMIT,
}: RecentActivityFeedProps) {
  const [expanded, setExpanded] = useState(false);
  const { scrollToSection } = useCampaignScroll();
  const visibleLimit = expanded ? expandedLimit : initialLimit;
  const visibleItems = items.slice(0, visibleLimit);
  const remaining = Math.max(0, Math.min(items.length, expandedLimit) - visibleItems.length);

  return (
    <Card className="flex h-full flex-col">
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
      <CardContent className="flex flex-1 flex-col">
        {visibleItems.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            هنوز فعالیتی ثبت نشده است.
          </p>
        ) : (
          <>
            <ul className="divide-y">
              {visibleItems.map((item) => {
                const sectionId = sectionIdFromHref(item.href);
                const isClickable = Boolean(sectionId);
                const content = (
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-sm font-semibold">{item.ownerName}</p>
                    {item.title ? (
                      <p className="line-clamp-2 text-sm text-foreground/90">{item.title}</p>
                    ) : null}
                    <p className="text-sm text-muted-foreground">{item.typeLabel}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatPersianDateTime(item.timestamp)}
                    </p>
                  </div>
                );

                return (
                  <li key={item.id} className="py-3 first:pt-0 last:pb-0">
                    {isClickable ? (
                      <button
                        type="button"
                        onClick={() =>
                          scrollToSection(sectionId!, item.contentId)
                        }
                        className="apple-press group flex w-full cursor-pointer items-start justify-between gap-3 rounded-lg px-2 py-1 text-right transition-colors hover:bg-muted/60"
                      >
                        {content}
                        <ChevronLeft className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-0.5 group-hover:text-primary" />
                      </button>
                    ) : (
                      <div className="flex items-start justify-between gap-3 px-2 py-1">{content}</div>
                    )}
                  </li>
                );
              })}
            </ul>
            {!expanded && remaining > 0 && (
              <div className="mt-4">
                <ShowMoreButton remaining={remaining} onClick={() => setExpanded(true)} />
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
