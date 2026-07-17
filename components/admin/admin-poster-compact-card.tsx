"use client";

import { AdminItemActions } from "@/components/admin/admin-item-actions";
import { AdminOwnerBadge } from "@/components/admin/admin-owner-badge";
import { AdminPlanLabelsBadges } from "@/components/admin/admin-plan-labels-badges";
import { ContentScoreControl } from "@/components/admin/content-score-control";
import { MediaThumbnail } from "@/components/ui/media-thumbnail";
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

  return (
    <div className="group relative w-full overflow-hidden rounded-xl border bg-card text-right transition-all hover:border-primary hover:shadow-md">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "w-full text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
      >
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted">
          <MediaThumbnail
            src={displayVersion?.imageUrl}
            alt={poster.title}
            kind="poster"
            sizes="160px"
            objectFit="contain"
          />
          <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
        </div>
        <div className="space-y-1 p-2">
          <p className="truncate text-xs font-medium">{poster.title}</p>
          <AdminPlanLabelsBadges planLabels={poster.planLabels} planLabel={poster.planLabel} />
          <AdminOwnerBadge ownerUserId={poster.ownerUserId} ownerName={poster.ownerName} />
          {!displayVersion && (
            <p className="text-[10px] text-muted-foreground">بدون تصویر</p>
          )}
        </div>
      </button>

      {(canScore || poster.score != null) && (
        <div className="px-2 pb-2">
          <ContentScoreControl
            campaignId={poster.campaignId}
            contentType="poster"
            contentId={poster.id}
            score={poster.score}
            canScore={canScore}
            compact
            onScoreSaved={onScoreSaved}
          />
        </div>
      )}

      {(onView || onEdit || onDelete) && (
        <div className="absolute bottom-2 left-2 z-10">
          <AdminItemActions
            compact
            onView={onView}
            onEdit={onEdit}
            onDelete={onDelete}
          />
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
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group overflow-hidden rounded-xl border-2 border-dashed bg-muted/30 text-muted-foreground transition-all",
        "hover:border-primary hover:bg-primary/5 hover:text-primary",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:pointer-events-none disabled:opacity-50",
        compact ? "h-28 w-24" : "w-full"
      )}
    >
      <div
        className={cn(
          "flex w-full flex-col items-center justify-center gap-2",
          compact ? "h-full p-2" : "aspect-[3/4]"
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
        <p className="truncate text-center text-xs font-medium">پوستر جدید</p>
      </div>
    </button>
  );
}
