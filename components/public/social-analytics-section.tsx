"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, FileText, Users } from "lucide-react";
import { KPICard } from "@/components/public/kpi-card";
import { CollapsibleSection } from "@/components/public/collapsible-section";
import { OwnerGroupedSection } from "@/components/public/owner-grouped-section";
import { ShowMoreButton } from "@/components/public/show-more-button";
import {
  SocialPlatformIcon,
  getSocialPlatformLabel,
} from "@/components/public/social-platform-icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useCampaignExportMode } from "@/lib/context/campaign-export-context";
import { useOwnerLocationFilter } from "@/lib/context/owner-location-filter-context";
import { useCampaignSectionVisibility } from "@/lib/hooks/use-campaign-section-visibility";
import { getOwnableUploadDate, sortCampaignContent } from "@/lib/campaign-content-filter";
import { filterItemsByOwnerLocation } from "@/lib/owner-location-filter";
import { groupByOwner, shouldRenderChronologically } from "@/lib/owner-groups";
import { SOCIAL_ANALYTICS_PAGE_SIZE } from "@/lib/public-media-section";
import type { SocialAnalyticsSummary, SocialPlatformStat } from "@/lib/types";
import { formatPersianNumber } from "@/lib/utils";
import { PublicOwnerTag } from "@/components/public/public-owner-tag";

interface SocialAnalyticsSectionProps {
  analytics: SocialAnalyticsSummary;
  adminOwnerLabel?: string | null;
}

function PlatformStatCard({ platform }: { platform: SocialPlatformStat }) {
  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <SocialPlatformIcon platform={platform.platform} size="lg" />
            <div>
              <div className="flex flex-wrap items-center gap-1.5">
                <h3 className="font-semibold">{getSocialPlatformLabel(platform.platform)}</h3>
                <PublicOwnerTag ownerUserId={platform.ownerUserId} ownerName={platform.ownerName} />
              </div>
              {platform.title?.trim() && (
                <p className="text-sm text-muted-foreground">{platform.title}</p>
              )}
              {platform.profileUrl && (
                <p className="text-xs text-muted-foreground truncate max-w-[180px]" dir="ltr">
                  {platform.profileUrl}
                </p>
              )}
            </div>
          </div>
          {platform.profileUrl && (
            <Button variant="ghost" size="icon" className="shrink-0" asChild>
              <a href={platform.profileUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <p className="text-xs text-muted-foreground">فالوور</p>
            <p className="text-xl font-bold">{formatPersianNumber(platform.followers)}</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <p className="text-xs text-muted-foreground">پست</p>
            <p className="text-xl font-bold">{formatPersianNumber(platform.posts)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PlatformStatGrid({ platforms }: { platforms: SocialPlatformStat[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {platforms.map((platform) => (
        <PlatformStatCard key={platform.id} platform={platform} />
      ))}
    </div>
  );
}

export function SocialAnalyticsSection({
  analytics,
  adminOwnerLabel,
}: SocialAnalyticsSectionProps) {
  const exportMode = useCampaignExportMode();
  const { filter } = useOwnerLocationFilter();
  const [visibleCount, setVisibleCount] = useState(SOCIAL_ANALYTICS_PAGE_SIZE);

  const platforms = useMemo(() => {
    const filtered = filterItemsByOwnerLocation(analytics.platforms, filter).filter((platform) =>
      Boolean(platform.profileUrl?.trim())
    );
    if (filter.sortOrder === "default") return filtered;
    return sortCampaignContent(
      filtered,
      filter.sortOrder,
      (item) => getOwnableUploadDate(item as SocialPlatformStat & Record<string, unknown>)
    );
  }, [analytics.platforms, filter]);

  const chronological = shouldRenderChronologically(filter.sortOrder);
  const filterKey = `${filter.province}:${filter.city}:${filter.userKey}:${filter.sortOrder}`;

  useEffect(() => {
    setVisibleCount(SOCIAL_ANALYTICS_PAGE_SIZE);
  }, [filterKey]);

  const totalFollowers = platforms.reduce((sum, platform) => sum + platform.followers, 0);
  const totalPosts = platforms.reduce((sum, platform) => sum + platform.posts, 0);

  const effectiveVisibleCount = exportMode ? platforms.length : visibleCount;
  const visiblePlatforms = platforms.slice(0, effectiveVisibleCount);
  const visibleGroups = useMemo(
    () => groupByOwner(visiblePlatforms, adminOwnerLabel ?? undefined),
    [visiblePlatforms, adminOwnerLabel]
  );

  const hasMore = !exportMode && visibleCount < platforms.length;
  const sectionVisible = useCampaignSectionVisibility(analytics.platforms.length, platforms.length);

  if (!analytics.hasData || !sectionVisible) return null;

  return (
    <CollapsibleSection
      id="social-analytics"
      title="آمار صفحات شبکه‌های اجتماعی"
      description="فالوور و تعداد پست هر پلتفرم"
    >
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <KPICard title="کل فالوورها" value={totalFollowers} icon={Users} />
        <KPICard title="کل پست‌ها" value={totalPosts} icon={FileText} />
      </div>

      <div className="space-y-4">
        <OwnerGroupedSection
          groups={visibleGroups}
          flatItems={chronological ? visiblePlatforms : null}
        >
          {(groupPlatforms) => <PlatformStatGrid platforms={groupPlatforms} />}
        </OwnerGroupedSection>

        {hasMore && (
          <ShowMoreButton
            remaining={platforms.length - visibleCount}
            onClick={() => setVisibleCount((count) => count + SOCIAL_ANALYTICS_PAGE_SIZE)}
          />
        )}
      </div>
    </CollapsibleSection>
  );
}
