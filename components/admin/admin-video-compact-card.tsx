"use client";

import { Play } from "lucide-react";
import { AdminCompactAddCard } from "@/components/admin/admin-compact-add-card";
import { AdminCreatedAtText } from "@/components/admin/admin-created-at";
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
    <div className="apple-lift group relative w-full overflow-hidden rounded-xl border bg-card text-right hover:border-primary/50">
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
          <div className="apple-overlay absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/35">
            <Play className="h-8 w-8 text-white" />
          </div>
        </div>
        <div className="space-y-1 p-2">
          <p className="truncate text-xs font-medium">{video.title}</p>
          <AdminPlanLabelsBadges planLabels={video.planLabels} planLabel={video.planLabel} />
          <AdminCreatedAtText createdAt={video.createdAt} />
          <AdminOwnerBadge ownerUserId={video.ownerUserId} ownerName={video.ownerName} />
          {!displayVersion && (
            <p className="text-[10px] text-muted-foreground">بدون ویدیو</p>
          )}
        </div>
      </button>

      {(canScore || video.score != null || onView || onEdit || onDelete) && (
        <div className="flex items-end gap-2 px-2 pb-2">
          {(onView || onEdit || onDelete) && (
            <AdminItemActions
              compact
              className="shrink-0"
              onView={onView}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          )}
          {(canScore || video.score != null) && (
            <div className="min-w-0 flex-1">
              <ContentScoreControl
                campaignId={video.campaignId}
                contentType="video"
                contentId={video.id}
                score={video.score}
                autoScore={video.autoScore}
                manualScore={video.manualScore}
                canScore={canScore}
                compact
                onScoreSaved={onScoreSaved}
              />
            </div>
          )}
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
    <div className={cn(compact && "w-full max-w-[10rem]")}>
      <AdminCompactAddCard
        onClick={onClick}
        disabled={disabled}
        label="ویدیو جدید"
        aspectClass={compact ? "min-h-28 aspect-auto" : "aspect-video"}
      />
    </div>
  );
}
