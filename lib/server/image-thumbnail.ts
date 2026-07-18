import { mkdir, readFile, stat, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { getUploadsDir, resolveUploadFilePath } from "@/lib/uploads";

/** Max edge for card/grid covers — enough for ~280–400px tiles on retina. */
export const CARD_THUMB_MAX_WIDTH = 480;
export const CARD_THUMB_WEBP_QUALITY = 70;

const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".bmp",
  ".tif",
  ".tiff",
  ".avif",
  ".heic",
  ".heif",
]);

export function isThumbnailableImageFilename(filename: string): boolean {
  const safe = path.basename(filename.split("?")[0].split("#")[0]);
  if (!safe || safe.includes(".thumb.")) return false;
  const ext = safe.slice(safe.lastIndexOf(".")).toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}

export function thumbFilenameFor(originalFilename: string): string {
  const safe = path.basename(originalFilename.split("?")[0].split("#")[0]);
  const base = safe.includes(".") ? safe.slice(0, safe.lastIndexOf(".")) : safe;
  return `${base}.thumb.webp`;
}

export async function createWebpThumbnailBuffer(input: Buffer): Promise<Buffer> {
  return sharp(input, { animated: false })
    .rotate()
    .resize({
      width: CARD_THUMB_MAX_WIDTH,
      height: CARD_THUMB_MAX_WIDTH,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: CARD_THUMB_WEBP_QUALITY })
    .toBuffer();
}

export async function writeImageThumbnail(
  originalFilename: string,
  originalBuffer: Buffer
): Promise<string> {
  const thumbName = thumbFilenameFor(originalFilename);
  const thumbBuffer = await createWebpThumbnailBuffer(originalBuffer);
  const uploadsDir = getUploadsDir();
  await mkdir(uploadsDir, { recursive: true });
  await writeFile(path.join(uploadsDir, thumbName), thumbBuffer);
  return thumbName;
}

/**
 * Ensure a cached WebP card thumb exists for a local upload.
 * Returns the thumb filename, or null if the source is not an image.
 */
export async function ensureLocalImageThumbnail(
  originalFilename: string
): Promise<string | null> {
  if (!isThumbnailableImageFilename(originalFilename)) return null;

  const thumbName = thumbFilenameFor(originalFilename);
  const thumbPath = resolveUploadFilePath(thumbName);

  try {
    const existing = await stat(thumbPath);
    if (existing.isFile() && existing.size > 0) return thumbName;
  } catch {
    // create below
  }

  const originalPath = resolveUploadFilePath(originalFilename);
  const originalBuffer = await readFile(originalPath);
  await writeImageThumbnail(originalFilename, originalBuffer);
  return thumbName;
}
