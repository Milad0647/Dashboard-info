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
  if (thumbnailUrl && hasDistinctThumbnail(thumbnailUrl, videoUrl)) {
    return thumbnailUrl;
  }

  const hash = extractAparatVideoHash(videoUrl);
  if (hash) return getAparatThumbnailUrl(hash);

  return thumbnailUrl || null;
}

export function buildVideoVersionMedia(videoUrl: string, thumbnailUrl?: string) {
  const trimmedVideoUrl = videoUrl.trim();
  const hash = extractAparatVideoHash(trimmedVideoUrl);
  const resolvedThumbnail =
    thumbnailUrl?.trim() ||
    (hash ? getAparatThumbnailUrl(hash) : trimmedVideoUrl);

  return {
    videoUrl: trimmedVideoUrl,
    thumbnailUrl: resolvedThumbnail,
  };
}

export function isDirectVideoUrl(url: string): boolean {
  return /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url);
}

export function isEmbeddableVideoUrl(url: string): boolean {
  if (extractAparatVideoHash(url)) return true;
  const embedUrl = resolveVideoEmbedUrl(url);
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
