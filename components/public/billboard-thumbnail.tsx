"use client";

import { useState } from "react";
import { MediaPlaceholder } from "@/components/ui/media-placeholder";
import { OptimizedMediaImage } from "@/components/ui/optimized-media-image";
import { getBillboardDisplayImage, hasBillboardDisplayImage } from "@/lib/billboard-media";
import type { Billboard } from "@/lib/types";
import { cn } from "@/lib/utils";

interface BillboardThumbnailProps {
  billboard: Billboard;
  alt: string;
  sizes: string;
  className?: string;
  imageClassName?: string;
}

export function BillboardThumbnail({
  billboard,
  alt,
  sizes,
  className,
  imageClassName,
}: BillboardThumbnailProps) {
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
    <OptimizedMediaImage
      src={getBillboardDisplayImage(billboard)}
      alt={alt}
      fill
      loading="lazy"
      decoding="async"
      quality={65}
      className={cn("object-cover", imageClassName, className)}
      sizes={sizes}
      onError={() => setImageFailed(true)}
    />
  );
}
