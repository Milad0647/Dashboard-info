"use client";

import { Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MediaThumbnail } from "@/components/ui/media-thumbnail";
import type { Video, VideoVersion } from "@/lib/types";
import { cn, formatPersianNumber } from "@/lib/utils";

interface AdminVideoCompactCardProps {
  video: Video;
  versions: VideoVersion[];
  onClick: () => void;
}

export function AdminVideoCompactCard({ video, versions, onClick }: AdminVideoCompactCardProps) {
  const latestVersion = [...versions].sort((a, b) => b.versionNumber - a.versionNumber)[0];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group w-full overflow-hidden rounded-xl border bg-card text-right transition-all",
        "hover:border-primary hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      )}
    >
      <div className="relative aspect-video w-full overflow-hidden bg-muted">
        <MediaThumbnail
          src={latestVersion?.thumbnailUrl}
          alt={video.title}
          kind="video"
          sizes="160px"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover:bg-black/30">
          <Play className="h-8 w-8 text-white" />
        </div>
        {latestVersion && (
          <div className="absolute top-1.5 right-1.5">
            <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
              v{formatPersianNumber(latestVersion.versionNumber)}
            </Badge>
          </div>
        )}
        {!video.published && (
          <div className="absolute top-1.5 left-1.5">
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">پیش‌نویس</Badge>
          </div>
        )}
      </div>
      <div className="space-y-1 p-2">
        <p className="truncate text-xs font-medium">{video.title}</p>
        {!latestVersion && (
          <p className="text-[10px] text-muted-foreground">بدون ویدیو</p>
        )}
      </div>
    </button>
  );
}

interface AdminVideoAddCardProps {
  onClick: () => void;
  disabled?: boolean;
}

export function AdminVideoAddCard({ onClick, disabled }: AdminVideoAddCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed bg-muted/30 text-muted-foreground transition-colors",
        "hover:border-primary hover:bg-primary/5 hover:text-primary",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:pointer-events-none disabled:opacity-50"
      )}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-current text-2xl leading-none">
        +
      </span>
      <span className="text-xs font-medium">ویدیو جدید</span>
    </button>
  );
}
