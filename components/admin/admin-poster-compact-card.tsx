"use client";

import { AdminCompactAddCard } from "@/components/admin/admin-compact-add-card";
import { AdminCreatedAtText } from "@/components/admin/admin-created-at";
import { AdminItemActions } from "@/components/admin/admin-item-actions";
import { AdminOwnerBadge } from "@/components/admin/admin-owner-badge";
import { AdminPlanLabelsBadges } from "@/components/admin/admin-plan-labels-badges";
import { ContentScoreControl } from "@/components/admin/content-score-control";
import { MediaThumbnail } from "@/components/ui/media-thumbnail";
import { resolveCardCoverUrl } from "@/lib/card-image";
import { resolveDisplayVersion } from "@/lib/media-utils";
import type { Poster, PosterVersion } from "@/lib/types";
import { cn } from "@/lib/utils";

interface AdminPosterCompactCardProps {
  poster: Poster;
  versions: PosterVersion[];
  onClick: () => void;
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  canScore?: boolean;
  onScoreSaved?: (score: number | null) => void;
}

export function AdminPosterCompactCard({
  poster,
  versions,
  onClick,
  onView,
  onEdit,
  onDelete,
  canScore = false,
  onScoreSaved,
}: AdminPosterCompactCardProps) {
  const displayVersion = resolveDisplayVersion(versions);
  const coverSrc = displayVersion
    ? resolveCardCoverUrl(displayVersion.imageUrl, displayVersion.thumbnailUrl)
    : null;

  return (
    <div className="apple-lift group relative w-full overflow-hidden rounded-xl border bg-card text-right hover:border-primary/50">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "w-full text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
      >
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted">
          <MediaThumbnail
            src={coverSrc}
            alt={poster.title}
            kind="poster"
            sizes="160px"
            objectFit="contain"
          />
          <div className="apple-overlay absolute inset-0 bg-black/0 group-hover:bg-black/10" />
        </div>
        <div className="space-y-1 p-2">
          <p className="truncate text-xs font-medium">{poster.title}</p>
          <AdminPlanLabelsBadges planLabels={poster.planLabels} planLabel={poster.planLabel} />
          <AdminCreatedAtText createdAt={poster.createdAt} />
          <AdminOwnerBadge ownerUserId={poster.ownerUserId} ownerName={poster.ownerName} />
          {!displayVersion && (
            <p className="text-[10px] text-muted-foreground">بدون تصویر</p>
          )}
        </div>
      </button>

      {(canScore || poster.score != null || onView || onEdit || onDelete) && (
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
          {(canScore || poster.score != null) && (
            <div className="min-w-0 flex-1">
              <ContentScoreControl
                campaignId={poster.campaignId}
                contentType="poster"
                contentId={poster.id}
                score={poster.score}
                autoScore={poster.autoScore}
                manualScore={poster.manualScore}
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

interface AdminPosterAddCardProps {
  onClick: () => void;
  disabled?: boolean;
  compact?: boolean;
}

export function AdminPosterAddCard({
  onClick,
  disabled,
  compact = false,
}: AdminPosterAddCardProps) {
  return (
    <div className={cn(compact && "w-full max-w-[10rem]")}>
      <AdminCompactAddCard
        onClick={onClick}
        disabled={disabled}
        label="پوستر جدید"
        aspectClass={compact ? "min-h-28 aspect-auto" : "aspect-[3/4]"}
      />
    </div>
  );
}
