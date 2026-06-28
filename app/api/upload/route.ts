import { mkdir, writeFile } from "fs/promises";
import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  getAdminSessionCookieName,
  verifyAdminSessionToken,
} from "@/lib/auth/admin-session";
import { getUploadPublicUrl, getUploadsDir } from "@/lib/uploads";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;

const MAX_AUDIO_BYTES = 50 * 1024 * 1024;

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
    case "video/mp4":
      return ".mp4";
    case "video/webm":
      return ".webm";
    case "video/quicktime":
      return ".mov";
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

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = cookieStore.get(getAdminSessionCookieName())?.value;
  const isAuthorized = await verifyAdminSessionToken(session);

  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const kind = String(formData.get("kind") ?? "image");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "فایلی ارسال نشده است" }, { status: 400 });
  }

  const allowedTypes =
    kind === "video"
      ? VIDEO_TYPES
      : kind === "audio"
        ? AUDIO_TYPES
        : kind === "document"
          ? DOCUMENT_TYPES
          : IMAGE_TYPES;
  const maxBytes =
    kind === "video"
      ? MAX_VIDEO_BYTES
      : kind === "audio"
        ? MAX_AUDIO_BYTES
        : kind === "document"
          ? MAX_DOCUMENT_BYTES
          : MAX_IMAGE_BYTES;

  if (!allowedTypes.has(file.type)) {
    return NextResponse.json({ error: "نوع فایل مجاز نیست" }, { status: 400 });
  }

  if (file.size > maxBytes) {
    return NextResponse.json({ error: "حجم فایل بیش از حد مجاز است" }, { status: 400 });
  }

  const extension = extensionForMime(file.type);
  const filename = `${randomUUID()}${extension}`;
  const uploadsDir = getUploadsDir();

  await mkdir(uploadsDir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(`${uploadsDir}/${filename}`, buffer);

  return NextResponse.json({
    url: getUploadPublicUrl(filename),
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
  });
}
