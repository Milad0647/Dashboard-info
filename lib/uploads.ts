import path from "path";

export function getUploadsDir(): string {
  return process.env.UPLOAD_DIR ?? path.join(process.cwd(), "data", "uploads");
}

export function getUploadPublicUrl(filename: string): string {
  return `/api/files/${filename}`;
}

const UPLOAD_FILE_PATTERN = /\.(jpe?g|png|webp|gif|mp4|webm|mov)$/i;

/** Normalize stored media paths to /api/files/{filename} for local uploads. */
export function normalizeUploadMediaUrl(url?: string | null): string {
  if (!url) return "";
  const trimmed = url.trim();
  if (!trimmed) return "";

  if (trimmed.startsWith("/api/files/")) {
    return trimmed;
  }

  const apiPathMatch = trimmed.match(/\/api\/files\/([^/?#]+)/i);
  if (apiPathMatch?.[1]) {
    return `/api/files/${decodeURIComponent(apiPathMatch[1])}`;
  }

  const basename = trimmed.split("?")[0].split("/").pop() ?? "";
  if (UPLOAD_FILE_PATTERN.test(basename) && !/^https?:\/\//i.test(trimmed)) {
    return `/api/files/${basename}`;
  }

  return trimmed;
}

export function isLocalUploadedMediaUrl(url?: string | null): boolean {
  return normalizeUploadMediaUrl(url).startsWith("/api/files/");
}

export function resolveUploadFilePath(filename: string): string {
  const safeName = path.basename(filename);
  return path.join(getUploadsDir(), safeName);
}
