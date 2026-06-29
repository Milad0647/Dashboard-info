"use client";

import { useMemo } from "react";
import Image from "next/image";
import { MapPin } from "lucide-react";
import { isDirectVideoUrl } from "@/lib/media-utils";
import { getActivityTypeLabel } from "@/lib/activity-types";
import { useFilteredOwnerGroups } from "@/lib/hooks/use-filtered-owner-groups";
import { ShowMoreButton } from "@/components/public/show-more-button";
import { useSectionPagination } from "@/lib/hooks/use-section-pagination";
import type { CampaignActivity, DataOwnerGroup } from "@/lib/types";
import { formatPersianDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CollapsibleSection } from "@/components/public/collapsible-section";
import { OwnerGroupedSection } from "@/components/public/owner-grouped-section";

const ACTIVITIES_ITEMS_PER_ROW = 3;

interface ActivitiesSectionProps {
  activities: CampaignActivity[];
  groups: DataOwnerGroup<CampaignActivity>[];
}

function ActivityCards({ activities }: { activities: CampaignActivity[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {activities.map((activity) => (
        <Card key={activity.id} className="overflow-hidden h-full flex flex-col">
          <div className="relative aspect-[4/3] bg-muted">
            {activity.videoUrl && isDirectVideoUrl(activity.videoUrl) ? (
              <video
                src={activity.videoUrl}
                className="h-full w-full object-cover"
                controls
                playsInline
                preload="metadata"
              />
            ) : activity.imageUrl ? (
              <Image
                src={activity.imageUrl}
                alt={activity.title}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 50vw, 33vw"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground px-4 text-center">
                {getActivityTypeLabel(activity.activityType)}
              </div>
            )}
          </div>
          <CardContent className="p-4 space-y-2 flex-1 flex flex-col">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{getActivityTypeLabel(activity.activityType)}</Badge>
              <span className="text-xs text-muted-foreground">{formatPersianDate(activity.activityDate)}</span>
            </div>
            <h3 className="font-semibold text-sm line-clamp-2">{activity.title}</h3>
            {activity.location && (
              <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                {activity.location}
              </p>
            )}
            {activity.description && (
              <p className="text-sm text-muted-foreground line-clamp-4 flex-1">{activity.description}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ActivitiesSection({ activities, groups }: ActivitiesSectionProps) {
  const filteredGroups = useFilteredOwnerGroups(groups);
  const filteredActivities = useMemo(
    () => filteredGroups.flatMap((group) => group.items),
    [filteredGroups]
  );

  const { effectiveCount, hasMore, loadMore } = useSectionPagination(
    filteredActivities.length,
    ACTIVITIES_ITEMS_PER_ROW,
    3,
    `activities:${filteredActivities.length}`
  );

  const visibleGroups = useMemo(() => {
    const visibleIds = new Set(
      filteredActivities.slice(0, effectiveCount).map((activity) => activity.id)
    );
    return filteredGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((activity) => visibleIds.has(activity.id)),
      }))
      .filter((group) => group.items.length > 0);
  }, [filteredGroups, filteredActivities, effectiveCount]);

  if (activities.length === 0) return null;

  return (
    <CollapsibleSection
      id="activities"
      title="اقدامات"
      description="فعالیت‌های میدانی و تبلیغاتی: مجله، روزنامه، تراکت، غرفه، برنامه فرهنگی و ..."
    >
      {filteredActivities.length === 0 ? (
        <div className="rounded-xl border bg-card py-12 text-center text-muted-foreground">
          فعالیتی با فیلتر انتخاب‌شده یافت نشد.
        </div>
      ) : (
        <>
          <OwnerGroupedSection groups={visibleGroups}>
            {(groupActivities) => <ActivityCards activities={groupActivities} />}
          </OwnerGroupedSection>

          {hasMore && (
            <div className="mt-4">
              <ShowMoreButton
                remaining={filteredActivities.length - effectiveCount}
                onClick={loadMore}
              />
            </div>
          )}
        </>
      )}
    </CollapsibleSection>
  );
}
