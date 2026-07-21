import { mkdir, readFile, writeFile, unlink, open } from "fs/promises";
import path from "path";
import { getBackupsDir } from "@/lib/backups";

export const DAILY_BACKUP_STATE_FILENAME = ".last-daily-backup";
export const DAILY_BACKUP_LOCK_FILENAME = ".daily-backup.lock";

/** Tehran hour when daily backup may start (midnight). */
export const DAILY_BACKUP_HOUR_TEHRAN = 0;
/**
 * Catch-up window: if midnight run was missed, allow until this hour (exclusive).
 * Prevents "every minute all day" retries when hour >= 0 was used by mistake.
 */
export const DAILY_BACKUP_CATCHUP_UNTIL_HOUR = 6;

export function getDailyBackupStatePath(): string {
  return path.join(getBackupsDir(), DAILY_BACKUP_STATE_FILENAME);
}

function getDailyBackupLockPath(): string {
  return path.join(getBackupsDir(), DAILY_BACKUP_LOCK_FILENAME);
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

/**
 * True when we are inside the nightly window:
 * - hour === 0 (midnight hour), or
 * - hour < CATCHUP_UNTIL and today not yet marked (catch-up after downtime)
 */
export function isWithinDailyBackupWindow(hour: number): boolean {
  if (hour === DAILY_BACKUP_HOUR_TEHRAN) return true;
  if (hour > DAILY_BACKUP_HOUR_TEHRAN && hour < DAILY_BACKUP_CATCHUP_UNTIL_HOUR) {
    return true;
  }
  return false;
}

/**
 * Always mark the Tehran day done after a finished attempt (success or fail)
 * so a broken run cannot spam backups every 60 seconds.
 */
export function shouldMarkDailyBackupComplete(_summary?: {
  created?: unknown[];
  failed?: unknown[];
}): boolean {
  void _summary;
  return true;
}

const LOCK_STALE_MS = 2 * 60 * 60 * 1000;

/**
 * Exclusive lock across in-app scheduler + Docker poller.
 * Returns release function, or null if another run holds the lock.
 */
export async function tryAcquireDailyBackupLock(): Promise<(() => Promise<void>) | null> {
  const dir = getBackupsDir();
  await mkdir(dir, { recursive: true });
  const lockPath = getDailyBackupLockPath();

  try {
    const handle = await open(lockPath, "wx");
    await handle.writeFile(
      `${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })}\n`,
      "utf8"
    );
    await handle.close();
  } catch {
    // Lock exists — steal if stale
    try {
      const raw = await readFile(lockPath, "utf8");
      const parsed = JSON.parse(raw) as { startedAt?: string };
      const startedAt = parsed.startedAt ? Date.parse(parsed.startedAt) : 0;
      if (startedAt && Date.now() - startedAt < LOCK_STALE_MS) {
        return null;
      }
      await unlink(lockPath);
      return tryAcquireDailyBackupLock();
    } catch {
      return null;
    }
  }

  return async () => {
    try {
      await unlink(lockPath);
    } catch {
      // ignore
    }
  };
}
