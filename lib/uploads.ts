import path from "path";

export function getUploadsDir(): string {
  return process.env.UPLOAD_DIR ?? path.join(process.cwd(), "data", "uploads");
}

export function getUploadPublicUrl(filename: string): string {
  return `/api/files/${filename}`;
}

export function resolveUploadFilePath(filename: string): string {
  const safeName = path.basename(filename);
  return path.join(getUploadsDir(), safeName);
}
