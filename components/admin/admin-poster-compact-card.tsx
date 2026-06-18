"use client";

import { Badge } from "@/components/ui/badge";
import { MediaThumbnail } from "@/components/ui/media-thumbnail";
import { resolveDisplayVersion } from "@/lib/media-utils";
import type { Poster, PosterVersion } from "@/lib/types";
import { cn, formatPersianNumber } from "@/lib/utils";

interface AdminPosterCompactCardProps {
  poster: Poster;
  versions: PosterVersion[];
  onClick: () => void;
}

export function AdminPosterCompactCard({ poster, versions, onClick }: AdminPosterCompactCardProps) {
  const displayVersion = resolveDisplayVersion(versions);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group w-full overflow-hidden rounded-xl border bg-card text-right transition-all",
        "hover:border-primary hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
        {displayVersion && (
          <div className="absolute top-1.5 right-1.5 flex flex-wrap gap-1 justify-end">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              v{formatPersianNumber(displayVersion.versionNumber)}
            </Badge>
            {displayVersion.isFinal ? (
              <Badge status="final" className="text-[10px] px-1.5 py-0">نهایی</Badge>
            ) : (
              <Badge status="draft" className="text-[10px] px-1.5 py-0">پیش‌نویس</Badge>
            )}
          </div>
        )}
        {!poster.published && (
          <div className="absolute top-1.5 left-1.5">
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">پیش‌نویس</Badge>
          </div>
        )}
      </div>
      <div className="space-y-1 p-2">
        <p className="truncate text-xs font-medium">{poster.title}</p>
        {!displayVersion && (
          <p className="text-[10px] text-muted-foreground">بدون تصویر</p>
        )}
      </div>
    </button>
  );
}

interface AdminPosterAddCardProps {
  onClick: () => void;
  disabled?: boolean;
}

export function AdminPosterAddCard({ onClick, disabled }: AdminPosterAddCardProps) {
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
      <div className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-current text-2xl leading-none">
          +
        </span>
      </div>
      <div className="p-2">
        <p className="truncate text-center text-xs font-medium">پوستر جدید</p>
      </div>
    </button>
  );
}
