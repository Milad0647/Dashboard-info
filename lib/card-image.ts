/**
 * Client/server helpers to prefer low-size card covers over full images.
 */

const LOCAL_FILE_PATH_RE = /^\/api\/files\/([^/?#]+)(?:[?#].*)?$/i;

const IMAGE_FILENAME_RE =
  /\.(jpe?g|png|webp|gif|bmp|tiff?|avif|heic|heif)$/i;

function extractLocalFilename(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  const relative = LOCAL_FILE_PATH_RE.exec(trimmed);
  if (relative?.[1]) return relative[1];

  try {
    const parsed = new URL(trimmed, "https://local.invalid");
    if (!parsed.pathname.startsWith("/api/files/")) return null;
    return decodeURIComponent(parsed.pathname.slice("/api/files/".length));
  } catch {
    return null;
  }
}

/** True when URL points at a local uploaded image (not video/doc). */
export function isLocalUploadedImageUrl(url: string): boolean {
  const filename = extractLocalFilename(url);
  if (!filename) return false;
  if (filename.includes(".thumb.")) return true;
  return IMAGE_FILENAME_RE.test(filename);
}

/**
 * Rewrite a local /api/files image URL so the files route serves a cached WebP thumb.
 * Remote URLs and non-images are returned unchanged.
 */
export function toCardThumbnailUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;

  const filename = extractLocalFilename(trimmed);
  if (!filename) return trimmed;
  if (filename.includes(".thumb.")) return trimmed;
  if (!IMAGE_FILENAME_RE.test(filename)) return trimmed;

  try {
    const isAbsolute = /^https?:\/\//i.test(trimmed);
    const parsed = new URL(trimmed, "https://local.invalid");
    if (parsed.searchParams.get("thumb") === "1") return trimmed;
    parsed.searchParams.set("thumb", "1");

    if (!isAbsolute) {
      const query = parsed.searchParams.toString();
      return query ? `${parsed.pathname}?${query}` : parsed.pathname;
    }
    return parsed.toString();
  } catch {
    return trimmed;
  }
}

/**
 * Pick the best URL for a card/grid cover.
 * Prefers an explicit distinct thumbnail, otherwise adds thumb=1 for local uploads.
 */
export function resolveCardCoverUrl(
  imageUrl?: string | null,
  thumbnailUrl?: string | null
): string {
  const full = imageUrl?.trim() || "";
  const thumb = thumbnailUrl?.trim() || "";

  if (thumb && thumb !== full) {
    return toCardThumbnailUrl(thumb);
  }

  if (full) return toCardThumbnailUrl(full);
  if (thumb) return toCardThumbnailUrl(thumb);
  return "";
}
