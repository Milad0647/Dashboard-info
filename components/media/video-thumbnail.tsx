"use client";

import { MediaPlaceholder } from "@/components/ui/media-placeholder";
import {
  isDirectVideoUrl,
  resolveVideoThumbnail,
} from "@/lib/media-utils";
import { cn } from "@/lib/utils";

interface VideoThumbnailProps {
  videoUrl: string;
  thumbnailUrl?: string | null;
  alt: string;
  className?: string;
}

export function VideoThumbnail({ videoUrl, thumbnailUrl, alt, className = "object-cover" }: VideoThumbnailProps) {
  const coverUrl = resolveVideoThumbnail(videoUrl, thumbnailUrl);

  if (coverUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={coverUrl} alt={alt} className={cn("h-full w-full", className)} />
    );
  }

  if (!videoUrl) {
    return <MediaPlaceholder kind="video" className={cn("h-full w-full", className)} />;
  }

  if (isDirectVideoUrl(videoUrl)) {
    return (
      <video
        src={videoUrl}
        className={cn("h-full w-full", className)}
        muted
        playsInline
        preload="metadata"
        aria-label={alt}
      />
    );
  }

  return <MediaPlaceholder kind="video" className={cn("h-full w-full", className)} />;
}
