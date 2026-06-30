"use client";

import { useMemo } from "react";
import { ExternalLink, FileText, Users } from "lucide-react";
import { KPICard } from "@/components/public/kpi-card";
import { CollapsibleSection } from "@/components/public/collapsible-section";
import {
  SocialPlatformIcon,
  getSocialPlatformLabel,
} from "@/components/public/social-platform-icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useOwnerLocationFilter } from "@/lib/context/owner-location-filter-context";
import { filterItemsByOwnerLocation } from "@/lib/owner-location-filter";
import type { SocialAnalyticsSummary } from "@/lib/types";
import { formatPersianNumber } from "@/lib/utils";

interface SocialAnalyticsSectionProps {
  analytics: SocialAnalyticsSummary;
}

export function SocialAnalyticsSection({ analytics }: SocialAnalyticsSectionProps) {
  const { filter } = useOwnerLocationFilter();
  const platforms = useMemo(
    () => filterItemsByOwnerLocation(analytics.platforms, filter),
    [analytics.platforms, filter]
  );

  const totalFollowers = platforms.reduce((sum, platform) => sum + platform.followers, 0);
  const totalPosts = platforms.reduce((sum, platform) => sum + platform.posts, 0);

  if (!analytics.hasData) return null;

  if (platforms.length === 0) {
    return (
      <CollapsibleSection
        id="social-analytics"
        title="آمار صفحات شبکه‌های اجتماعی"
        description="فالوور و تعداد پست هر پلتفرم"
      >
        <div className="rounded-xl border bg-card py-12 text-center text-muted-foreground">
          موردی با فیلتر انتخاب‌شده وجود ندارد.
        </div>
      </CollapsibleSection>
    );
  }

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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {platforms.map((platform) => (
          <Card key={platform.id} className="overflow-hidden hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <SocialPlatformIcon platform={platform.platform} size="lg" />
                  <div>
                    <h3 className="font-semibold">{getSocialPlatformLabel(platform.platform)}</h3>
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
        ))}
      </div>
    </CollapsibleSection>
  );
}
