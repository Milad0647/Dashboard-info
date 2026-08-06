"use client";

import { AdminCompactAddCard } from "@/components/admin/admin-compact-add-card";
import { AdminCreatedAtText } from "@/components/admin/admin-created-at";
import { AdminItemActions } from "@/components/admin/admin-item-actions";
import { AdminOwnerBadge } from "@/components/admin/admin-owner-badge";
import { AdminPlanLabelsBadges } from "@/components/admin/admin-plan-labels-badges";
import { ContentScoreControl } from "@/components/admin/content-score-control";
import { InlineVideoPlayer } from "@/components/media/inline-video-player";
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
      <div className="relative aspect-video w-full overflow-hidden bg-muted">
        {displayVersion ? (
          <InlineVideoPlayer
            videoUrl={displayVersion.videoUrl}
            thumbnailUrl={displayVersion.thumbnailUrl}
            alt={video.title}
            objectFit="contain"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground">
            بدون ویدیو
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onClick}
        className={cn(
          "w-full space-y-1 p-2 text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
      >
        <p className="truncate text-xs font-medium">{video.title}</p>
        <AdminPlanLabelsBadges planLabels={video.planLabels} planLabel={video.planLabel} />
        <AdminCreatedAtText createdAt={video.createdAt} />
        <AdminOwnerBadge ownerUserId={video.ownerUserId} ownerName={video.ownerName} />
        {!displayVersion && <p className="text-[10px] text-muted-foreground">بدون ویدیو</p>}
      </button>

      {(canScore || onView || onEdit || onDelete) && (
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
          {canScore && (
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
