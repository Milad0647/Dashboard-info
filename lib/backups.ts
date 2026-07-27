import path from "path";
import { getUploadsDir } from "@/lib/uploads";

const BACKUP_FILENAME_RE =
  /^backup-[a-zA-Z0-9_-]+-\d{4}-\d{2}-\d{2}(?:-\d{6})?\.zip$/;

const DB_DUMP_FILENAME_RE = /^db-dump-\d{4}-\d{2}-\d{2}\.sql$/;

export type StoredBackupKind = "campaign" | "db-dump";

export function getBackupsDir(): string {
  if (process.env.BACKUP_DIR?.trim()) {
    return process.env.BACKUP_DIR.trim();
  }
  return path.join(path.dirname(getUploadsDir()), "backups");
}

export function isSafeCampaignBackupFilename(filename: string): boolean {
  const safe = path.basename(filename);
  return safe === filename && BACKUP_FILENAME_RE.test(safe);
}

export function isSafeDbDumpFilename(filename: string): boolean {
  const safe = path.basename(filename);
  return safe === filename && DB_DUMP_FILENAME_RE.test(safe);
}

/** Campaign ZIP or Postgres dump — anything we may list / download / delete. */
export function isSafeBackupFilename(filename: string): boolean {
  return isSafeCampaignBackupFilename(filename) || isSafeDbDumpFilename(filename);
}

export function getStoredBackupKind(filename: string): StoredBackupKind | null {
  if (isSafeCampaignBackupFilename(filename)) return "campaign";
  if (isSafeDbDumpFilename(filename)) return "db-dump";
  return null;
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
