import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { getBackupsDir } from "@/lib/backups";

export const DAILY_BACKUP_STATE_FILENAME = ".last-daily-backup";

export function getDailyBackupStatePath(): string {
  return path.join(getBackupsDir(), DAILY_BACKUP_STATE_FILENAME);
}

export async function getLastDailyBackupDay(): Promise<string | null> {
  try {
    const raw = (await readFile(getDailyBackupStatePath(), "utf8")).trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
  } catch {
    return null;
  }
}

export async function markDailyBackupCompleted(dateIso: string): Promise<void> {
  const dir = getBackupsDir();
  await mkdir(dir, { recursive: true });
  await writeFile(getDailyBackupStatePath(), `${dateIso}\n`, "utf8");
}

/** Mark the day complete only when at least one backup succeeded, or nothing failed. */
export function shouldMarkDailyBackupComplete(summary: {
  created: unknown[];
  failed: unknown[];
}): boolean {
  return summary.created.length > 0 || summary.failed.length === 0;
}
