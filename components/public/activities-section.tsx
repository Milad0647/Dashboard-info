"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { MapPin, Play } from "lucide-react";
import { getActivityTypeLabel } from "@/lib/activity-types";
import { useFilteredOwnerGroups } from "@/lib/hooks/use-filtered-owner-groups";
import { ShowMoreButton } from "@/components/public/show-more-button";
import { usePublicMediaPagination } from "@/lib/hooks/use-public-media-pagination";
import type { CampaignActivity, DataOwnerGroup } from "@/lib/types";
import { formatPersianDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CollapsibleSection } from "@/components/public/collapsible-section";
import { OwnerGroupedSection } from "@/components/public/owner-grouped-section";
import { ActivityMediaDialog } from "@/components/public/activity-media-dialog";
import { PUBLIC_MEDIA_GRID_CLASS } from "@/lib/public-media-section";
import { VideoThumbnail } from "@/components/media/video-thumbnail";
import { cn } from "@/lib/utils";

interface ActivitiesSectionProps {
  activities: CampaignActivity[];
  groups: DataOwnerGroup<CampaignActivity>[];
}

function hasActivityMedia(activity: CampaignActivity): boolean {
  return Boolean(activity.imageUrl?.trim() || activity.videoUrl?.trim());
}

function ActivityCard({
  activity,
  onOpen,
}: {
  activity: CampaignActivity;
  onOpen: () => void;
}) {
  const hasMedia = hasActivityMedia(activity);
  const hasVideo = Boolean(activity.videoUrl?.trim());

  return (
    <Card className="h-full w-full overflow-hidden py-0 gap-0">
      <button
        type="button"
        onClick={hasMedia ? onOpen : undefined}
        disabled={!hasMedia}
        className={cn(
          "group relative block w-full aspect-video bg-muted text-right",
          hasMedia && "cursor-pointer"
        )}
        aria-label={hasMedia ? `مشاهده ${activity.title}` : undefined}
      >
        {hasVideo ? (
          <VideoThumbnail
            videoUrl={activity.videoUrl!}
            alt={activity.title}
            className="object-cover transition-transform group-hover:scale-105"
          />
        ) : activity.imageUrl ? (
          <Image
            src={activity.imageUrl}
            alt={activity.title}
            fill
            className="object-cover transition-transform group-hover:scale-105"
            sizes="(max-width: 1280px) 16vw, 200px"
          />
        ) : (
          <div className="flex h-full items-center justify-center px-2 text-center text-xs text-muted-foreground">
            {getActivityTypeLabel(activity.activityType)}
          </div>
        )}

        {hasVideo && hasMedia && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
            <Play className="h-10 w-10 text-white drop-shadow" />
          </div>
        )}

        <div className="absolute top-2 right-2">
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {getActivityTypeLabel(activity.activityType)}
          </Badge>
        </div>
      </button>

      <CardContent className="space-y-1 p-2.5">
        <h3 className="line-clamp-2 text-xs font-semibold leading-snug">{activity.title}</h3>
        <p className="text-[10px] text-muted-foreground">{formatPersianDate(activity.activityDate)}</p>
        {activity.location && (
          <p className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="line-clamp-1">{activity.location}</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ActivityCards({ activities }: { activities: CampaignActivity[] }) {
  const [selectedActivity, setSelectedActivity] = useState<CampaignActivity | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const openActivity = (activity: CampaignActivity) => {
    if (!hasActivityMedia(activity)) return;
    setSelectedActivity(activity);
    setDialogOpen(true);
  };

  return (
    <>
      <div className={PUBLIC_MEDIA_GRID_CLASS}>
        {activities.map((activity) => (
          <ActivityCard
            key={activity.id}
            activity={activity}
            onOpen={() => openActivity(activity)}
          />
        ))}
      </div>

      <ActivityMediaDialog
        activity={selectedActivity}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}

export function ActivitiesSection({ activities, groups }: ActivitiesSectionProps) {
  const filteredGroups = useFilteredOwnerGroups(groups);
  const filteredActivities = useMemo(
    () => filteredGroups.flatMap((group) => group.items),
    [filteredGroups]
  );

  const { visibleCount, hasMore, loadMore } = usePublicMediaPagination(
    filteredActivities.length,
    `activities:${filteredActivities.length}`
  );

  const visibleGroups = useMemo(() => {
    const visibleIds = new Set(
      filteredActivities.slice(0, visibleCount).map((activity) => activity.id)
    );
    return filteredGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((activity) => visibleIds.has(activity.id)),
      }))
      .filter((group) => group.items.length > 0);
  }, [filteredGroups, filteredActivities, visibleCount]);

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
                remaining={filteredActivities.length - visibleCount}
                onClick={loadMore}
              />
            </div>
          )}
        </>
      )}
    </CollapsibleSection>
  );
}
