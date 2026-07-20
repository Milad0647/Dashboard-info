"use client";

import { FileText, Play } from "lucide-react";
import { AdminCompactAddCard } from "@/components/admin/admin-compact-add-card";
import { AdminItemActions } from "@/components/admin/admin-item-actions";
import { AdminOwnerBadge } from "@/components/admin/admin-owner-badge";
import { VideoThumbnail } from "@/components/media/video-thumbnail";
import { resolveBroadcastMediaType } from "@/lib/broadcast-media";
import type { BroadcastReport } from "@/lib/types";
import { cn, formatPersianDate } from "@/lib/utils";

interface AdminBroadcastCompactCardProps {
  report: BroadcastReport;
  onClick: () => void;
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function AdminBroadcastCompactCard({
  report,
  onClick,
  onView,
  onEdit,
  onDelete,
}: AdminBroadcastCompactCardProps) {
  const mediaType = resolveBroadcastMediaType(report);
  const isVideo = mediaType === "video";

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
          {isVideo ? (
            <>
              <VideoThumbnail
                videoUrl={report.pdfUrl}
                thumbnailUrl={report.summaryData.coverImageUrl}
                alt={report.title}
                className="object-contain"
              />
              <div className="apple-overlay absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/35">
                <Play className="h-8 w-8 text-white drop-shadow-lg" />
              </div>
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
              <FileText className="h-10 w-10 text-primary" />
              <span className="text-[10px]">PDF</span>
            </div>
          )}
        </div>
        <div className="space-y-1 p-2">
          <p className="truncate text-xs font-medium">{report.title}</p>
          <p className="truncate text-[10px] text-muted-foreground">
            {formatPersianDate(report.reportDate)}
            {report.fileName ? ` · ${report.fileName}` : ""}
          </p>
          <AdminOwnerBadge ownerUserId={report.ownerUserId} ownerName={report.ownerName} />
        </div>
      </button>

      {(onView || onEdit || onDelete) && (
        <div className="absolute bottom-2 left-2 z-10">
          <AdminItemActions compact onView={onView} onEdit={onEdit} onDelete={onDelete} />
        </div>
      )}
    </div>
  );
}

interface AdminBroadcastAddCardProps {
  onClick: () => void;
  disabled?: boolean;
  compact?: boolean;
}

export function AdminBroadcastAddCard({
  onClick,
  disabled,
  compact = false,
}: AdminBroadcastAddCardProps) {
  return (
    <div className={cn(compact && "w-full max-w-[10rem]")}>
      <AdminCompactAddCard
        onClick={onClick}
        disabled={disabled}
        label="گزارش جدید"
        aspectClass={compact ? "min-h-28 aspect-auto" : "aspect-video"}
      />
    </div>
  );
}
