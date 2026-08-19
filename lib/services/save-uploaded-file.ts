import { mkdir, writeFile } from "fs/promises";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { assertMagicMatchesKind, detectFileKind, looksLikeSvg } from "@/lib/security/file-magic";
import {
  isThumbnailableImageFilename,
  writeImageThumbnail,
} from "@/lib/server/image-thumbnail";
import { getUploadPublicUrl, getUploadsDir } from "@/lib/uploads";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_EDGE = 4500;

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/tiff",
  "image/heic",
  "image/heif",
  "image/avif",
]);

function extensionForMime(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    default:
      return "";
  }
}

/** Re-encode JPEG and oversized images into a browser-safe sRGB file. */
async function normalizeImageForWeb(
  buffer: Buffer,
  mime: string
): Promise<{ buffer: Buffer; mime: string; extension: string }> {
  const fallback = { buffer, mime, extension: extensionForMime(mime) };
  if (mime === "image/gif") return fallback;

  try {
    const pipeline = sharp(buffer, {
      failOn: "none",
      animated: false,
      limitInputPixels: 100_000_000,
    }).rotate();
    const meta = await pipeline.metadata();
    const tooLarge = (meta.width ?? 0) > MAX_IMAGE_EDGE || (meta.height ?? 0) > MAX_IMAGE_EDGE;
    const isJpeg = mime === "image/jpeg" || meta.format === "jpeg";

    if (!tooLarge && !isJpeg) return fallback;

    let output = pipeline.toColourspace("srgb");
    if (tooLarge) {
      output = output.resize({
        width: MAX_IMAGE_EDGE,
        height: MAX_IMAGE_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      });
    }

    if (isJpeg) {
      const next = await output.jpeg({ quality: 88, mozjpeg: true }).toBuffer();
      return { buffer: next, mime: "image/jpeg", extension: ".jpg" };
    }
    if (mime === "image/png" || meta.format === "png") {
      const next = await output.png({ compressionLevel: 8 }).toBuffer();
      return { buffer: next, mime: "image/png", extension: ".png" };
    }
    if (mime === "image/webp" || meta.format === "webp") {
      const next = await output.webp({ quality: 82 }).toBuffer();
      return { buffer: next, mime: "image/webp", extension: ".webp" };
    }
    return fallback;
  } catch (error) {
    console.warn("Image normalization failed:", error);
    return fallback;
  }
}

function mimeFromDetectedKind(kind: ReturnType<typeof detectFileKind>): string {
  switch (kind) {
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    default:
      return "";
  }
}

function resolveDeclaredImageMime(fileType: string): string {
  const normalized = fileType.trim().toLowerCase();
  if (normalized === "image/jpg") return "image/jpeg";
  return normalized;
}

function looksLikeExecutable(buffer: Buffer): boolean {
  // Windows PE / ELF / Mach-O
  if (buffer.length >= 2 && buffer[0] === 0x4d && buffer[1] === 0x5a) return true;
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x7f &&
    buffer[1] === 0x45 &&
    buffer[2] === 0x4c &&
    buffer[3] === 0x46
  ) {
    return true;
  }
  if (
    buffer.length >= 4 &&
    ((buffer[0] === 0xcf && buffer[1] === 0xfa && buffer[2] === 0xed && buffer[3] === 0xfe) ||
      (buffer[0] === 0xce && buffer[1] === 0xfa && buffer[2] === 0xed && buffer[3] === 0xfe))
  ) {
    return true;
  }
  return false;
}

export async function saveUploadedImageFile(file: File): Promise<string> {
  if (file.type === "image/svg+xml") {
    throw new Error("آپلود فایل SVG مجاز نیست");
  }

  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("حجم تصویر بیش از حد مجاز است");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const magic = assertMagicMatchesKind(buffer, "image");

  const declaredMime = resolveDeclaredImageMime(file.type);
  const mime = IMAGE_TYPES.has(declaredMime)
    ? declaredMime
    : mimeFromDetectedKind(detectFileKind(buffer));
  if (!magic.ok && !IMAGE_TYPES.has(mime)) {
    if (looksLikeSvg(buffer)) {
      throw new Error("آپلود فایل SVG مجاز نیست");
    }
    if (looksLikeExecutable(buffer)) {
      throw new Error("نوع فایل تصویر مجاز نیست");
    }
    // Fallback for modern/phone formats that magic checker doesn't classify yet.
    try {
      await sharp(buffer, { failOn: "none", limitInputPixels: 100_000_000 })
        .rotate()
        .metadata();
    } catch {
      throw new Error("محتوای فایل با نوع تصویر هم‌خوانی ندارد");
    }
  }

  const normalized = await normalizeImageForWeb(buffer, IMAGE_TYPES.has(mime) ? mime : "image/jpeg");
  const filename = `${randomUUID()}${normalized.extension}`;
  const uploadsDir = getUploadsDir();

  await mkdir(uploadsDir, { recursive: true });
  await writeFile(`${uploadsDir}/${filename}`, normalized.buffer);

  if (isThumbnailableImageFilename(filename)) {
    try {
      await writeImageThumbnail(filename, normalized.buffer);
    } catch (error) {
      console.warn("Card thumbnail generation failed:", error);
    }
  }

  return getUploadPublicUrl(filename);
}

/**
 * Download a remote image URL and save it locally, returning a `/api/files/...` URL.
 * Returns `null` when the download fails or the response is not an image.
 */
export async function downloadRemoteImageToLocal(
  remoteUrl: string
): Promise<string | null> {
  if (!remoteUrl?.trim()) return null;
  if (remoteUrl.startsWith("/api/files/")) return remoteUrl;

  try {
    const response = await fetch(remoteUrl, {
      signal: AbortSignal.timeout(30_000),
      headers: { Accept: "image/*" },
    });
    if (!response.ok) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) return null;

    const contentType = response.headers.get("content-type") ?? "";
    const kind = detectFileKind(buffer);
    const mime = mimeFromDetectedKind(kind) || contentType.split(";")[0].trim();
    if (!IMAGE_TYPES.has(mime) && kind === "unknown") return null;

    const normalized = await normalizeImageForWeb(buffer, mime);
    const filename = `${randomUUID()}${normalized.extension}`;
    const uploadsDir = getUploadsDir();

    await mkdir(uploadsDir, { recursive: true });
    await writeFile(`${uploadsDir}/${filename}`, normalized.buffer);

    if (isThumbnailableImageFilename(filename)) {
      try {
        await writeImageThumbnail(filename, normalized.buffer);
      } catch {
        // thumbnail generation is best-effort
      }
    }

    return getUploadPublicUrl(filename);
  } catch {
    return null;
  }
}
