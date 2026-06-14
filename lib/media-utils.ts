export function resolveVideoEmbedUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;

  const aparatMatch = trimmed.match(
    /aparat\.com\/(?:v|video\/video\/embed\/videohash)\/([^/?#]+)/i
  );
  if (aparatMatch?.[1]) {
    return `https://www.aparat.com/video/video/embed/videohash/${aparatMatch[1]}/vt/frame`;
  }

  const aparatShortMatch = trimmed.match(/aparat\.com\/v\/([^/?#]+)/i);
  if (aparatShortMatch?.[1]) {
    return `https://www.aparat.com/video/video/embed/videohash/${aparatShortMatch[1]}/vt/frame`;
  }

  return trimmed;
}

export function isDirectVideoUrl(url: string): boolean {
  return /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url);
}

export function isEmbeddableVideoUrl(url: string): boolean {
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
