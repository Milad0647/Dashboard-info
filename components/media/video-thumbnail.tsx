"use client";

import { useRef } from "react";
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

function withFirstFrameFragment(url: string): string {
  const trimmed = url.trim();
  if (!trimmed || trimmed.includes("#")) return trimmed;
  return `${trimmed}#t=0.001`;
}

export function VideoThumbnail({ videoUrl, thumbnailUrl, alt, className = "object-cover" }: VideoThumbnailProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
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
        ref={videoRef}
        src={withFirstFrameFragment(videoUrl)}
        className={cn("h-full w-full", className)}
        muted
        playsInline
        preload="auto"
        onLoadedData={(event) => {
          event.currentTarget.currentTime = 0;
        }}
        aria-label={alt}
      />
    );
  }

  return <MediaPlaceholder kind="video" className={cn("h-full w-full", className)} />;
}
