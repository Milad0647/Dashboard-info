"use client";

import { Badge } from "@/components/ui/badge";
import { AdminItemActions } from "@/components/admin/admin-item-actions";
import { AdminOwnerBadge } from "@/components/admin/admin-owner-badge";
import { AdminPlanLabelsBadges } from "@/components/admin/admin-plan-labels-badges";
import { ContentScoreControl } from "@/components/admin/content-score-control";
import { MediaThumbnail } from "@/components/ui/media-thumbnail";
import { resolveBillboardCategoryDisplay } from "@/lib/billboard-categories";
import { formatBillboardCityLine } from "@/lib/billboard-location";
import { getBillboardCardImage, hasBillboardDisplayImage } from "@/lib/billboard-media";
import type { Billboard } from "@/lib/types";
import { cn } from "@/lib/utils";

interface AdminBillboardCompactCardProps {
  billboard: Billboard;
  onClick: () => void;
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: (billboard: Billboard) => void;
  canScore?: boolean;
  onScoreSaved?: (billboard: Billboard, score: number | null) => void;
}

export function AdminBillboardCompactCard({
  billboard,
  onClick,
  onView,
  onEdit,
  onDelete,
  canScore = false,
  onScoreSaved,
}: AdminBillboardCompactCardProps) {
  const categoryLabel = resolveBillboardCategoryDisplay(billboard);
  const city = billboard.city?.trim() || "";
  const cityLine = formatBillboardCityLine(billboard);

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
          <MediaThumbnail
            src={hasBillboardDisplayImage(billboard) ? getBillboardCardImage(billboard) : null}
            alt={billboard.title}
            kind="billboard"
            sizes="200px"
            objectFit="cover"
          />
          <div className="absolute top-1.5 right-1.5 flex max-w-[calc(100%-0.75rem)] flex-wrap gap-1 justify-end">
            {categoryLabel && (
              <Badge variant="overlay" className="text-[10px] px-1.5 py-0">
                {categoryLabel}
              </Badge>
            )}
            {city && (
              <Badge variant="overlay" className="text-[10px] px-1.5 py-0">
                {city}
              </Badge>
            )}
          </div>
        </div>
        <div className="space-y-1 p-2">
          <p className="truncate text-xs font-medium">{billboard.title}</p>
          <AdminPlanLabelsBadges planLabels={billboard.planLabels} planLabel={billboard.planLabel} />
          <p className="truncate text-[10px] text-muted-foreground">{cityLine}</p>
          <AdminOwnerBadge ownerUserId={billboard.ownerUserId} ownerName={billboard.ownerName} />
        </div>
      </button>

      {(canScore || billboard.score != null) && (
        <div className="px-2 pb-2">
          <ContentScoreControl
            campaignId={billboard.campaignId}
            contentType="billboard"
            contentId={billboard.id}
            score={billboard.score}
            canScore={canScore}
            compact
            onScoreSaved={(score) => onScoreSaved?.(billboard, score)}
          />
        </div>
      )}

      <div className="absolute bottom-2 left-2 z-10">
        <AdminItemActions
          compact
          onView={onView}
          onEdit={onEdit}
          onDelete={onDelete ? () => onDelete(billboard) : undefined}
        />
      </div>
    </div>
  );
}

interface AdminBillboardAddCardProps {
  onClick: () => void;
  disabled?: boolean;
}

export function AdminBillboardAddCard({ onClick, disabled }: AdminBillboardAddCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group w-full overflow-hidden rounded-xl border-2 border-dashed bg-muted/30 text-muted-foreground transition-all",
        "hover:border-primary hover:bg-primary/5 hover:text-primary",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:pointer-events-none disabled:opacity-50"
      )}
    >
      <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 p-4">
        <span className="text-3xl leading-none">+</span>
        <span className="text-xs font-medium">ثبت جدید</span>
      </div>
    </button>
  );
}
