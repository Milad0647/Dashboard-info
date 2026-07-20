"use client";

import { Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AdminCreatedAtText } from "@/components/admin/admin-created-at";
import { AdminItemActions } from "@/components/admin/admin-item-actions";
import { AdminOwnerBadge } from "@/components/admin/admin-owner-badge";
import { AdminPlanLabelsBadges } from "@/components/admin/admin-plan-labels-badges";
import { ContentScoreControl } from "@/components/admin/content-score-control";
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
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  canScore?: boolean;
  onScoreSaved?: (score: number | null) => void;
}

export function AdminActivityCompactCard({
  activity,
  onClick,
  onView,
  onEdit,
  onDelete,
  canScore = false,
  onScoreSaved,
}: AdminActivityCompactCardProps) {
  const coverUrl = resolveActivityCover(activity);

  return (
    <div className="apple-lift group relative w-full overflow-hidden rounded-xl border bg-card text-right hover:border-primary/50">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "w-full text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
      >
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
          {coverUrl ? (
            <MediaThumbnail src={coverUrl} alt={activity.title} kind="poster" sizes="200px" objectFit="cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">بدون تصویر</div>
          )}
          <div className="absolute top-1.5 right-1.5 flex flex-col items-end gap-1">
            {activity.isCreative && (
              <Badge
                variant="overlay"
                className="gap-0.5 border-amber-400/60 bg-amber-500/95 px-1.5 py-0 text-[10px] text-white"
              >
                <Star className="h-2.5 w-2.5 fill-current" />
                خلاقانه
              </Badge>
            )}
            <Badge variant="overlay" className="px-1.5 py-0 text-[10px]">
              {getActivityTypeLabel(activity.activityType)}
            </Badge>
          </div>
        </div>
        <div className="space-y-1 p-2">
          <p className="truncate text-xs font-medium">{activity.title}</p>
          <AdminPlanLabelsBadges planLabels={activity.planLabels} planLabel={activity.planLabel} />
          <p className="truncate text-[10px] text-muted-foreground">
            {formatPersianDate(activity.activityDate)}
            {activity.location ? ` — ${activity.location}` : ""}
          </p>
          <AdminCreatedAtText createdAt={activity.createdAt} />
          <AdminOwnerBadge ownerUserId={activity.ownerUserId} ownerName={activity.ownerName} />
        </div>
      </button>

      {(canScore || activity.score != null) && (
        <div className="px-2 pb-2">
          <ContentScoreControl
            campaignId={activity.campaignId}
            contentType="activity"
            contentId={activity.id}
            score={activity.score}
            autoScore={activity.autoScore}
            manualScore={activity.manualScore}
            canScore={canScore}
            compact
            onScoreSaved={onScoreSaved}
          />
        </div>
      )}

      {(onView || onEdit || onDelete) && (
        <div className="absolute bottom-2 left-2 z-10">
          <AdminItemActions compact onView={onView} onEdit={onEdit} onDelete={onDelete} />
        </div>
      )}
    </div>
  );
}
