"use client";

import { Badge } from "@/components/ui/badge";
import { AdminOwnerBadge } from "@/components/admin/admin-owner-badge";
import { MediaThumbnail } from "@/components/ui/media-thumbnail";
import { getActivityTypeLabel } from "@/lib/activity-types";
import type { CampaignActivity } from "@/lib/types";
import { cn, formatPersianDate } from "@/lib/utils";

function resolveActivityCover(activity: CampaignActivity): string | null {
  const fromMedia = activity.mediaItems?.find((item) => item.type === "image" && item.url.trim())?.url;
  return fromMedia ?? activity.imageUrl ?? null;
}

interface AdminActivityCompactCardProps {
  activity: CampaignActivity;
  onClick: () => void;
}

export function AdminActivityCompactCard({ activity, onClick }: AdminActivityCompactCardProps) {
  const coverUrl = resolveActivityCover(activity);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group w-full overflow-hidden rounded-xl border bg-card text-right transition-all",
        "hover:border-primary hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      )}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
        {coverUrl ? (
          <MediaThumbnail src={coverUrl} alt={activity.title} kind="poster" sizes="200px" objectFit="cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">بدون تصویر</div>
        )}
        <div className="absolute top-1.5 right-1.5">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {getActivityTypeLabel(activity.activityType)}
          </Badge>
        </div>
        {!activity.published && (
          <div className="absolute top-1.5 left-1.5">
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              پیش‌نویس
            </Badge>
          </div>
        )}
      </div>
      <div className="space-y-1 p-2">
        <p className="truncate text-xs font-medium">{activity.title}</p>
        <p className="truncate text-[10px] text-muted-foreground">
          {formatPersianDate(activity.activityDate)}
          {activity.location ? ` — ${activity.location}` : ""}
        </p>
        <AdminOwnerBadge ownerUserId={activity.ownerUserId} ownerName={activity.ownerName} />
      </div>
    </button>
  );
}
