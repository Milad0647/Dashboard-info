import path from "path";
import { getUploadsDir } from "@/lib/uploads";

const BACKUP_FILENAME_RE =
  /^backup-[a-zA-Z0-9_-]+-\d{4}-\d{2}-\d{2}(?:-\d{6})?\.zip$/;

export function getBackupsDir(): string {
  if (process.env.BACKUP_DIR?.trim()) {
    return process.env.BACKUP_DIR.trim();
  }
  return path.join(path.dirname(getUploadsDir()), "backups");
}

export function isSafeBackupFilename(filename: string): boolean {
  const safe = path.basename(filename);
  return safe === filename && BACKUP_FILENAME_RE.test(safe);
}

export function resolveBackupFilePath(filename: string): string | null {
  if (!isSafeBackupFilename(filename)) return null;
  return path.join(getBackupsDir(), path.basename(filename));
}

export function buildBackupFilename(slug: string, createdAt: Date = new Date()): string {
  const safeSlug = slug.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-") || "campaign";
  const date = createdAt.toISOString().slice(0, 10);
  const time = createdAt
    .toISOString()
    .slice(11, 19)
    .replace(/:/g, "");
  return `backup-${safeSlug}-${date}-${time}.zip`;
}
