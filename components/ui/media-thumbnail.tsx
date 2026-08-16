"use client";

import { useEffect, useState } from "react";
import { MediaPlaceholder } from "@/components/ui/media-placeholder";
import {
  isLocalUploadedMediaUrl,
  OptimizedMediaImage,
} from "@/components/ui/optimized-media-image";
import { toCardThumbnailUrl } from "@/lib/card-image";
import { cn } from "@/lib/utils";

interface MediaThumbnailProps {
  src?: string | null;
  alt: string;
  kind?: "image" | "video" | "poster" | "billboard";
  fill?: boolean;
  className?: string;
  sizes?: string;
  objectFit?: "cover" | "contain";
}

function shouldUsePlainImg(url: string): boolean {
  return (
    isLocalUploadedMediaUrl(url) ||
    url.startsWith("http://") ||
    url.startsWith("https://")
  );
}

function stripThumbParam(url: string): string {
  const trimmed = url.trim();
  if (!trimmed || !trimmed.includes("thumb=")) return trimmed;
  try {
    const isAbsolute = /^https?:\/\//i.test(trimmed);
    const parsed = new URL(trimmed, "https://local.invalid");
    if (!parsed.searchParams.has("thumb")) return trimmed;
    parsed.searchParams.delete("thumb");
    if (!isAbsolute) {
      const query = parsed.searchParams.toString();
      return query ? `${parsed.pathname}?${query}` : parsed.pathname;
    }
    return parsed.toString();
  } catch {
    return trimmed;
  }
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
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  useEffect(() => {
    setFailedSrc(null);
  }, [src]);

  if (!src) {
    return <MediaPlaceholder kind={kind} className={className} />;
  }

  const preferred = toCardThumbnailUrl(src);
  const fallback = stripThumbParam(preferred);
  const candidates = [preferred, fallback, src.trim()].filter(
    (url, index, list) => Boolean(url) && list.indexOf(url) === index
  );
  const activeIndex = failedSrc ? candidates.indexOf(failedSrc) + 1 : 0;
  const cardSrc = candidates[Math.min(Math.max(activeIndex, 0), candidates.length - 1)] ?? src;
  const exhausted = failedSrc !== null && activeIndex >= candidates.length;

  if (exhausted) {
    return <MediaPlaceholder kind={kind} className={className} />;
  }

  const fitClass = objectFit === "contain" ? "object-contain" : "object-cover";
  const handleError = () => setFailedSrc(cardSrc);

  if (shouldUsePlainImg(cardSrc) || kind === "billboard") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={cardSrc}
        src={cardSrc}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={handleError}
        className={cn(
          fill ? "absolute inset-0 h-full w-full" : "h-full w-full",
          fitClass,
          className
        )}
      />
    );
  }

  return (
    <OptimizedMediaImage
      key={cardSrc}
      src={cardSrc}
      alt={alt}
      fill={fill}
      loading="lazy"
      decoding="async"
      quality={65}
      className={cn(fitClass, className)}
      sizes={sizes}
      onError={handleError}
    />
  );
}
