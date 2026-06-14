"use client";

import Image from "next/image";
import { MediaPlaceholder } from "@/components/ui/media-placeholder";
import { cn } from "@/lib/utils";

interface MediaThumbnailProps {
  src?: string | null;
  alt: string;
  kind?: "image" | "video" | "poster";
  fill?: boolean;
  className?: string;
  sizes?: string;
  objectFit?: "cover" | "contain";
}

export function MediaThumbnail({
  src,
  alt,
  kind = "image",
  fill = true,
  className,
  sizes = "400px",
  objectFit = "cover",
}: MediaThumbnailProps) {
  if (!src) {
    return <MediaPlaceholder kind={kind} className={className} />;
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill={fill}
      className={cn(objectFit === "contain" ? "object-contain" : "object-cover", className)}
      sizes={sizes}
    />
  );
}
