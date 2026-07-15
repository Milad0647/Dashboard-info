export function extractAparatVideoHash(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const scriptSrcMatch = trimmed.match(/src=["'](https?:\/\/[^"']*aparat\.com[^"']*)["']/i);
  if (scriptSrcMatch?.[1]) {
    return extractAparatVideoHash(scriptSrcMatch[1]);
  }

  const patterns = [
    /aparat\.com\/embed\/([^/?#"'\s&]+)/i,
    /aparat\.com\/v\/([^/?#"'\s&]+)/i,
    /videohash\/([^/?#"'\s&]+)/i,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]) return match[1];
  }

  return null;
}

export function getAparatThumbnailUrl(hash: string): string {
  return `https://www.aparat.com/public/video/video/videohash/${hash}/thumb-720.jpg`;
}

export function isAparatVideoInput(input: string): boolean {
  return extractAparatVideoHash(input) !== null;
}

/** @deprecated Use raw embed input; kept for backward compatibility */
export function normalizeVideoInput(input: string): string {
  return input.trim();
}

export function resolveVideoEmbedUrl(input: string): string {
  const hash = extractAparatVideoHash(input);
  if (hash) {
    return `https://www.aparat.com/video/video/embed/videohash/${hash}/vt/frame`;
  }
  return input.trim();
}

export function resolveVideoThumbnail(
  videoUrl: string,
  thumbnailUrl?: string | null
): string | null {
  const customCover = thumbnailUrl?.trim() || "";
  // Never treat a video file path as an image cover (breaks <img> previews).
  if (
    customCover &&
    hasDistinctThumbnail(customCover, videoUrl) &&
    !isDirectVideoUrl(customCover)
  ) {
    return customCover;
  }

  const hash = extractAparatVideoHash(videoUrl);
  if (hash) return getAparatThumbnailUrl(hash);

  return null;
}

export function buildVideoVersionMedia(videoUrl: string, thumbnailUrl?: string) {
  const trimmedVideoUrl = videoUrl.trim();
  const customCover = thumbnailUrl?.trim() || "";
  const hash = extractAparatVideoHash(trimmedVideoUrl);
  const resolvedThumbnail =
    customCover && !isDirectVideoUrl(customCover) && customCover !== trimmedVideoUrl
      ? customCover
      : hash
        ? getAparatThumbnailUrl(hash)
        : "";

  return {
    videoUrl: trimmedVideoUrl,
    thumbnailUrl: resolvedThumbnail,
  };
}

export function isDirectVideoUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (/^\/api\/files\/.+\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(trimmed)) return true;
  try {
    const pathname = new URL(trimmed, "https://local.invalid").pathname;
    if (/^\/api\/files\/.+\.(mp4|webm|ogg|mov)$/i.test(pathname)) return true;
    return /\.(mp4|webm|ogg|mov)$/i.test(pathname);
  } catch {
    return /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(trimmed);
  }
}

export function isDirectAudioUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (/^\/api\/files\/.+\.(mp3|wav|ogg|m4a|aac|webm|mpeg)(\?.*)?$/i.test(trimmed)) return true;
  return /\.(mp3|wav|ogg|m4a|aac|mpeg)(\?.*)?$/i.test(trimmed);
}

export function resolveAbsoluteMediaUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (typeof window !== "undefined") {
    return new URL(trimmed, window.location.origin).href;
  }
  return trimmed;
}

export function isEmbeddableVideoUrl(url: string): boolean {
  if (extractAparatVideoHash(url)) return true;
  const embedUrl = resolveVideoEmbedUrl(url);
  if (/^\/api\/files\/.+\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(embedUrl.trim())) return true;
  return isDirectVideoUrl(embedUrl) || /aparat\.com\/video\/video\/embed/i.test(embedUrl);
}

export async function downloadMedia(url: string, filename: string): Promise<void> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Download failed");
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = blobUrl;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(blobUrl);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

export function getFilenameFromUrl(url: string, fallback: string): string {
  try {
    const pathname = new URL(url, window.location.origin).pathname;
    const base = pathname.split("/").pop();
    return base && base.length > 0 ? base : fallback;
  } catch {
    return fallback;
  }
}

export function hasDistinctThumbnail(thumbnailUrl?: string | null, mediaUrl?: string | null): boolean {
  if (!thumbnailUrl) return false;
  if (!mediaUrl) return true;
  return thumbnailUrl.trim() !== mediaUrl.trim();
}

interface VersionWithFinal {
  id: string;
  versionNumber: number;
  isFinal?: boolean;
}

export function resolveDisplayVersion<T extends VersionWithFinal>(versions: T[]): T | undefined {
  if (versions.length === 0) return undefined;
  const sorted = [...versions].sort((a, b) => a.versionNumber - b.versionNumber);
  return sorted.find((version) => version.isFinal) ?? sorted[sorted.length - 1];
}
