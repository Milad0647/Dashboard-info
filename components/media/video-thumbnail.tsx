"use client";

import { MediaPlaceholder } from "@/components/ui/media-placeholder";
import { cn } from "@/lib/utils";

interface VideoThumbnailProps {
  videoUrl: string;
  thumbnailUrl?: string | null;
  alt: string;
  className?: string;
}

export function VideoThumbnail({ videoUrl, thumbnailUrl, alt, className = "object-cover" }: VideoThumbnailProps) {
  const hasCover = Boolean(thumbnailUrl && thumbnailUrl !== videoUrl);

  if (hasCover) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={thumbnailUrl!} alt={alt} className={cn("h-full w-full", className)} />
    );
  }

  if (!videoUrl) {
    return <MediaPlaceholder kind="video" className={cn("h-full w-full", className)} />;
  }

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
