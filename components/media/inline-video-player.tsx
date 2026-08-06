"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Play } from "lucide-react";
import { VideoThumbnail } from "@/components/media/video-thumbnail";
import {
  isDirectVideoUrl,
  isEmbeddableVideoUrl,
  resolveAbsoluteMediaUrl,
  resolveVideoEmbedUrl,
} from "@/lib/media-utils";
import { cn } from "@/lib/utils";

interface InlineVideoPlayerProps {
  videoUrl: string;
  thumbnailUrl?: string | null;
  alt: string;
  className?: string;
  /** Applied to the thumbnail / video element fit. Default contain. */
  objectFit?: "cover" | "contain";
  sizes?: string;
  /** Show the play overlay icon before playback. Default true. */
  showPlayOverlay?: boolean;
}

/**
 * Card-friendly video: cover + play until clicked, then inline playback.
 * Does not load the video file until the user presses play.
 */
export function InlineVideoPlayer({
  videoUrl,
  thumbnailUrl,
  alt,
  className,
  objectFit = "contain",
  sizes,
  showPlayOverlay = true,
}: InlineVideoPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const canPlay = isEmbeddableVideoUrl(videoUrl);
  const embedUrl = canPlay ? resolveVideoEmbedUrl(videoUrl) : "";
  const videoSrc = resolveAbsoluteMediaUrl(embedUrl);
  const playAsFile = isDirectVideoUrl(videoUrl) || isDirectVideoUrl(videoSrc);
  const fitClass = objectFit === "cover" ? "object-cover" : "object-contain";

  useEffect(() => {
    setPlaying(false);
  }, [videoUrl]);

  useEffect(() => {
    if (!playing || !playAsFile) return;
    const el = videoRef.current;
    if (!el) return;
    void el.play().catch(() => {
      /* autoplay may be blocked; controls remain available */
    });
  }, [playing, playAsFile, videoSrc]);

  const stop = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handlePlay = (event: MouseEvent) => {
    stop(event);
    if (!canPlay) return;
    setPlaying(true);
  };

  if (playing && canPlay) {
    if (playAsFile) {
      return (
        <video
          ref={videoRef}
          src={videoSrc}
          controls
          playsInline
          preload="metadata"
          className={cn("absolute inset-0 h-full w-full bg-black", fitClass, className)}
          onClick={stop}
          onPointerDown={stop}
        />
      );
    }

    return (
      <iframe
        src={videoSrc}
        title={alt}
        className={cn("absolute inset-0 h-full w-full bg-black", className)}
        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        onClick={stop}
        onPointerDown={stop}
      />
    );
  }

  return (
    <div className="absolute inset-0">
      <VideoThumbnail
        videoUrl={videoUrl}
        thumbnailUrl={thumbnailUrl}
        alt={alt}
        sizes={sizes}
        className={cn(fitClass, className)}
      />
      <button
        type="button"
        onClick={handlePlay}
        onPointerDown={stop}
        disabled={!canPlay}
        aria-label={`پخش ${alt}`}
        className={cn(
          "absolute inset-0 z-10 flex items-center justify-center",
          "bg-black/20 transition-colors hover:bg-black/35",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          !canPlay && "cursor-not-allowed opacity-60"
        )}
      >
        {showPlayOverlay ? (
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white shadow-md">
            <Play className="h-5 w-5 fill-current ps-0.5" />
          </span>
        ) : null}
      </button>
    </div>
  );
}
