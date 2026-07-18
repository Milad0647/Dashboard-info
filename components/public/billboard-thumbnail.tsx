"use client";

import { useState } from "react";
import { MediaPlaceholder } from "@/components/ui/media-placeholder";
import { getBillboardCardImage, hasBillboardDisplayImage } from "@/lib/billboard-media";
import type { Billboard } from "@/lib/types";
import { cn } from "@/lib/utils";

interface BillboardThumbnailProps {
  billboard: Billboard;
  alt: string;
  sizes: string;
  className?: string;
  imageClassName?: string;
}

/**
 * Use a plain img for billboards: next/image optimization often fails for
 * signed /api/files URLs and for remote map-bilboard hosts the server cannot reach.
 */
export function BillboardThumbnail({
  billboard,
  alt,
  sizes: _sizes,
  className,
  imageClassName,
}: BillboardThumbnailProps) {
  void _sizes;
  const [imageFailed, setImageFailed] = useState(false);
  const hasImage = hasBillboardDisplayImage(billboard) && !imageFailed;

  if (!hasImage) {
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
      src={getBillboardCardImage(billboard)}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={cn("absolute inset-0 h-full w-full object-cover", imageClassName, className)}
      onError={() => setImageFailed(true)}
    />
  );
}
