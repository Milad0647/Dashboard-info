import { mkdir, writeFile } from "fs/promises";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/get-session";
import { assertMagicMatchesKind } from "@/lib/security/file-magic";
import {
  isThumbnailableImageFilename,
  writeImageThumbnail,
} from "@/lib/server/image-thumbnail";
import { getUploadPublicUrl, getUploadsDir, withFileAccessToken } from "@/lib/uploads";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const MAX_ACTIVITY_VIDEO_BYTES = 50 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;
const MAX_AUDIO_BYTES = 50 * 1024 * 1024;
const MAX_RAW_IMAGE_BYTES = 100 * 1024 * 1024;
const MAX_RAW_VIDEO_BYTES = 2 * 1024 * 1024 * 1024;

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const VIDEO_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

const DOCUMENT_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
]);

const AUDIO_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/ogg",
  "audio/webm",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aac",
]);

const RAW_IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".bmp",
  ".tif",
  ".tiff",
  ".heic",
  ".heif",
  ".avif",
  ".ico",
  ".raw",
  ".cr2",
  ".nef",
  ".dng",
  ".orf",
  ".arw",
  ".rw2",
]);

const RAW_VIDEO_EXTENSIONS = new Set([
  ".mp4",
  ".webm",
  ".mov",
  ".m4v",
  ".mkv",
  ".avi",
  ".mpeg",
  ".mpg",
  ".wmv",
  ".flv",
  ".3gp",
  ".ts",
  ".mts",
  ".m2ts",
  ".ogv",
  ".vob",
]);

function extensionFromFileName(fileName: string): string {
  const match = fileName.match(/(\.[a-z0-9]+)$/i);
  return match ? match[1].toLowerCase() : "";
}

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
    case "image/bmp":
      return ".bmp";
    case "image/tiff":
      return ".tiff";
    case "image/heic":
      return ".heic";
    case "image/heif":
      return ".heif";
    case "image/avif":
      return ".avif";
    case "image/svg+xml":
      return ".svg";
    case "video/mp4":
      return ".mp4";
    case "video/webm":
      return ".webm";
    case "video/quicktime":
      return ".mov";
    case "video/x-matroska":
      return ".mkv";
    case "video/x-msvideo":
      return ".avi";
    case "video/mpeg":
      return ".mpeg";
    case "video/x-ms-wmv":
      return ".wmv";
    case "video/x-flv":
      return ".flv";
    case "video/3gpp":
      return ".3gp";
    case "video/mp2t":
      return ".ts";
    case "application/pdf":
      return ".pdf";
    case "application/msword":
      return ".doc";
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return ".docx";
    case "application/vnd.ms-excel":
      return ".xls";
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      return ".xlsx";
    case "text/plain":
      return ".txt";
    case "audio/mpeg":
    case "audio/mp3":
      return ".mp3";
    case "audio/wav":
      return ".wav";
    case "audio/ogg":
      return ".ogg";
    case "audio/webm":
      return ".webm";
    case "audio/mp4":
    case "audio/x-m4a":
      return ".m4a";
    case "audio/aac":
      return ".aac";
    default:
      return "";
  }
}

function resolveUploadExtension(file: File): string {
  const fromName = extensionFromFileName(file.name);
  if (fromName) return fromName;
  return extensionForMime(file.type);
}

function isAllowedRawImage(file: File): boolean {
  if (file.type === "image/svg+xml") return false;
  if (file.type.startsWith("image/")) return true;
  const ext = extensionFromFileName(file.name);
  if (ext === ".svg") return false;
  return RAW_IMAGE_EXTENSIONS.has(ext);
}

function isAllowedRawVideo(file: File): boolean {
  if (file.type.startsWith("video/")) return true;
  const ext = extensionFromFileName(file.name);
  return RAW_VIDEO_EXTENSIONS.has(ext);
}

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const kind = String(formData.get("kind") ?? "image");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "فایلی ارسال نشده است" }, { status: 400 });
  }

  const maxBytes =
    kind === "raw-video"
      ? MAX_RAW_VIDEO_BYTES
      : kind === "raw-image"
        ? MAX_RAW_IMAGE_BYTES
        : kind === "activity-video"
          ? MAX_ACTIVITY_VIDEO_BYTES
          : kind === "video"
            ? MAX_VIDEO_BYTES
            : kind === "audio"
              ? MAX_AUDIO_BYTES
              : kind === "document"
                ? MAX_DOCUMENT_BYTES
                : MAX_IMAGE_BYTES;

  const isRawKind = kind === "raw-video" || kind === "raw-image";
  const allowed =
    kind === "raw-video"
      ? isAllowedRawVideo(file)
      : kind === "raw-image"
        ? isAllowedRawImage(file)
        : kind === "video" || kind === "activity-video"
          ? VIDEO_TYPES.has(file.type)
          : kind === "audio"
            ? AUDIO_TYPES.has(file.type)
            : kind === "document"
              ? DOCUMENT_TYPES.has(file.type)
              : IMAGE_TYPES.has(file.type);

  if (!allowed) {
    return NextResponse.json({ error: "نوع فایل مجاز نیست" }, { status: 400 });
  }

  if (file.size > maxBytes) {
    return NextResponse.json({ error: "حجم فایل بیش از حد مجاز است" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const magic = assertMagicMatchesKind(buffer, kind);
  if (!magic.ok) {
    return NextResponse.json({ error: magic.error }, { status: 400 });
  }

  const extension = isRawKind ? resolveUploadExtension(file) : extensionForMime(file.type);
  if (extension === ".svg") {
    return NextResponse.json({ error: "آپلود فایل SVG مجاز نیست" }, { status: 400 });
  }
  const filename = `${randomUUID()}${extension}`;
  const uploadsDir = getUploadsDir();

  await mkdir(uploadsDir, { recursive: true });

  await writeFile(`${uploadsDir}/${filename}`, buffer);

  let thumbnailUrl: string | undefined;
  if (isThumbnailableImageFilename(filename)) {
    try {
      const thumbName = await writeImageThumbnail(filename, buffer);
      thumbnailUrl = withFileAccessToken(getUploadPublicUrl(thumbName));
    } catch (error) {
      console.warn("Card thumbnail generation failed:", error);
    }
  }

  return NextResponse.json({
    url: withFileAccessToken(getUploadPublicUrl(filename)),
    ...(thumbnailUrl ? { thumbnailUrl } : {}),
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
  });
}
