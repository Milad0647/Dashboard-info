import Image, { type ImageProps } from "next/image";

/** Uploaded files use signed ?exp=&sig= query params that break next/image optimization. */
export function isLocalUploadedMediaUrl(url?: string | null): boolean {
  return Boolean(url?.startsWith("/api/files/"));
}

export function OptimizedMediaImage({ src, unoptimized, alt = "", ...props }: ImageProps) {
  const srcValue = typeof src === "string" ? src : "";
  const useUnoptimized = unoptimized ?? isLocalUploadedMediaUrl(srcValue);

  return <Image {...props} src={src} alt={alt} unoptimized={useUnoptimized} />;
}
