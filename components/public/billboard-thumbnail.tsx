"use client";

import { useEffect, useState } from "react";
import { MediaPlaceholder } from "@/components/ui/media-placeholder";
import {
  BILLBOARD_PLACEHOLDER_IMAGE,
  getBillboardCardImage,
  getBillboardDisplayImage,
  hasBillboardDisplayImage,
} from "@/lib/billboard-media";
import type { Billboard } from "@/lib/types";
import { cn } from "@/lib/utils";

interface BillboardThumbnailProps {
  billboard: Billboard;
  alt: string;
  sizes: string;
  className?: string;
  imageClassName?: string;
  /** Use `eager` inside dialogs — lazy often never loads in portaled content. */
  loading?: "lazy" | "eager";
}

/**
 * Use a plain img for billboards: next/image optimization often fails for
 * signed /api/files URLs and for remote map-bilboard hosts the server cannot reach.
 * Tries the card thumb first, then the full image, before showing a placeholder.
 */
export function BillboardThumbnail({
  billboard,
  alt,
  sizes: _sizes,
  className,
  imageClassName,
  loading = "lazy",
}: BillboardThumbnailProps) {
  void _sizes;
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const cardSrc = getBillboardCardImage(billboard);
  const fullSrc = getBillboardDisplayImage(billboard);
  const candidates = [cardSrc, fullSrc].filter(
    (url, index, list) =>
      Boolean(url) && url !== BILLBOARD_PLACEHOLDER_IMAGE && list.indexOf(url) === index
  );

  useEffect(() => {
    setFailedSrc(null);
  }, [billboard.id, cardSrc, fullSrc]);

  const activeIndex = failedSrc ? candidates.indexOf(failedSrc) + 1 : 0;
  const src = candidates[Math.min(Math.max(activeIndex, 0), candidates.length)] ?? "";
  const exhausted =
    !hasBillboardDisplayImage(billboard) ||
    candidates.length === 0 ||
    (failedSrc !== null && activeIndex >= candidates.length);

  if (exhausted || !src) {
    return (
      <MediaPlaceholder
        kind="billboard"
        className={cn("absolute inset-0", className)}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={src}
      src={src}
      alt={alt}
      loading={loading}
      decoding="async"
      fetchPriority={loading === "eager" ? "high" : undefined}
      className={cn("absolute inset-0 h-full w-full object-cover", imageClassName, className)}
      onError={() => setFailedSrc(src)}
    />
  );
}
