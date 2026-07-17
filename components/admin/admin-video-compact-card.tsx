"use client";

import { Play } from "lucide-react";
import { AdminItemActions } from "@/components/admin/admin-item-actions";
import { AdminOwnerBadge } from "@/components/admin/admin-owner-badge";
import { AdminPlanLabelsBadges } from "@/components/admin/admin-plan-labels-badges";
import { ContentScoreControl } from "@/components/admin/content-score-control";
import { VideoThumbnail } from "@/components/media/video-thumbnail";
import { resolveDisplayVersion } from "@/lib/media-utils";
import type { Video, VideoVersion } from "@/lib/types";
import { cn } from "@/lib/utils";

interface AdminVideoCompactCardProps {
  video: Video;
  versions: VideoVersion[];
  onClick: () => void;
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  canScore?: boolean;
  onScoreSaved?: (score: number | null) => void;
}

export function AdminVideoCompactCard({
  video,
  versions,
  onClick,
  onView,
  onEdit,
  onDelete,
  canScore = false,
  onScoreSaved,
}: AdminVideoCompactCardProps) {
  const displayVersion = resolveDisplayVersion(versions);

  return (
    <div className="group relative w-full overflow-hidden rounded-xl border bg-card text-right transition-all hover:border-primary hover:shadow-md">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "w-full text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
      >
        <div className="relative aspect-video w-full overflow-hidden bg-muted">
          {displayVersion ? (
            <VideoThumbnail
              videoUrl={displayVersion.videoUrl}
              thumbnailUrl={displayVersion.thumbnailUrl}
              alt={video.title}
              className="object-contain"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground">بدون ویدیو</div>
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover:bg-black/30">
            <Play className="h-8 w-8 text-white" />
          </div>
        </div>
        <div className="space-y-1 p-2">
          <p className="truncate text-xs font-medium">{video.title}</p>
          <AdminPlanLabelsBadges planLabels={video.planLabels} planLabel={video.planLabel} />
          <AdminOwnerBadge ownerUserId={video.ownerUserId} ownerName={video.ownerName} />
          {!displayVersion && (
            <p className="text-[10px] text-muted-foreground">بدون ویدیو</p>
          )}
        </div>
      </button>

      {(canScore || video.score != null) && (
        <div className="px-2 pb-2">
          <ContentScoreControl
            campaignId={video.campaignId}
            contentType="video"
            contentId={video.id}
            score={video.score}
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

interface AdminVideoAddCardProps {
  onClick: () => void;
  disabled?: boolean;
  compact?: boolean;
}

export function AdminVideoAddCard({
  onClick,
  disabled,
  compact = false,
}: AdminVideoAddCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed bg-muted/30 text-muted-foreground transition-colors",
        "hover:border-primary hover:bg-primary/5 hover:text-primary",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:pointer-events-none disabled:opacity-50",
        compact ? "h-24 w-28" : "aspect-video w-full"
      )}
    >
      <span
        className={cn(
          "flex items-center justify-center rounded-full border-2 border-current leading-none",
          compact ? "h-7 w-7 text-lg" : "h-10 w-10 text-2xl"
        )}
      >
        +
      </span>
      <span className="text-xs font-medium">ویدیو جدید</span>
    </button>
  );
}
