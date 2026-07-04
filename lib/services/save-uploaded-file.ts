import { mkdir, writeFile } from "fs/promises";
import { randomUUID } from "crypto";
import { getUploadPublicUrl, getUploadsDir } from "@/lib/uploads";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
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

export async function saveUploadedImageFile(file: File): Promise<string> {
  if (!IMAGE_TYPES.has(file.type)) {
    throw new Error("نوع فایل تصویر مجاز نیست");
  }

  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("حجم تصویر بیش از حد مجاز است");
  }

  const extension = extensionForMime(file.type);
  const filename = `${randomUUID()}${extension}`;
  const uploadsDir = getUploadsDir();

  await mkdir(uploadsDir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(`${uploadsDir}/${filename}`, buffer);

  return getUploadPublicUrl(filename);
}
