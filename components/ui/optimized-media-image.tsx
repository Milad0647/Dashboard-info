"use client";

import Image, { type ImageProps } from "next/image";
import { isLocalUploadedMediaUrl, normalizeUploadMediaUrl } from "@/lib/uploads";
import { cn } from "@/lib/utils";

export { isLocalUploadedMediaUrl } from "@/lib/uploads";

type OptimizedMediaImageProps = ImageProps;

export function OptimizedMediaImage({
  src,
  alt = "",
  fill,
  className,
  sizes,
  unoptimized,
  ...props
}: OptimizedMediaImageProps) {
  const srcValue = typeof src === "string" ? normalizeUploadMediaUrl(src) : "";

  if (isLocalUploadedMediaUrl(srcValue)) {
    if (fill) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={srcValue}
          alt={alt}
          className={cn("absolute inset-0 h-full w-full", className)}
          loading="lazy"
        />
      );
    }

    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={srcValue} alt={alt} className={className} loading="lazy" {...props} />
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
      {...props}
    />
  );
}
