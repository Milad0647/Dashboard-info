"use client";

import { useState } from "react";
import Image, { type ImageProps } from "next/image";
import { MediaPlaceholder } from "@/components/ui/media-placeholder";
import { isLocalUploadedMediaUrl, normalizeUploadMediaUrl } from "@/lib/uploads";
import { cn } from "@/lib/utils";

export { isLocalUploadedMediaUrl } from "@/lib/uploads";

type OptimizedMediaImageProps = ImageProps & {
  placeholderKind?: "image" | "video" | "poster";
};

export function OptimizedMediaImage({
  src,
  alt = "",
  fill,
  className,
  sizes,
  unoptimized,
  placeholderKind = "image",
  ...props
}: OptimizedMediaImageProps) {
  const [hasError, setHasError] = useState(false);
  const srcValue = typeof src === "string" ? normalizeUploadMediaUrl(src) : "";

  if (!srcValue || hasError) {
    return (
      <MediaPlaceholder
        kind={placeholderKind}
        className={cn(fill && "absolute inset-0 h-full w-full", className)}
      />
    );
  }

  if (isLocalUploadedMediaUrl(srcValue)) {
    if (fill) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={srcValue}
          alt={alt}
          className={cn("absolute inset-0 h-full w-full", className)}
          loading="lazy"
          onError={() => setHasError(true)}
        />
      );
    }

    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={srcValue}
        alt={alt}
        className={className}
        loading="lazy"
        onError={() => setHasError(true)}
        {...props}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill={fill}
      className={className}
      sizes={sizes}
      unoptimized={unoptimized}
      onError={() => setHasError(true)}
      {...props}
    />
  );
}
