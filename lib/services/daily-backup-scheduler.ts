import { getTehranCalendarDateIso } from "@/lib/safe-dates";
import {
  getLastDailyBackupDay,
  isWithinDailyBackupWindow,
  markDailyBackupCompleted,
  shouldMarkDailyBackupComplete,
  tryAcquireDailyBackupLock,
} from "@/lib/services/daily-backup-state";
import {
  createDailyBackupsForAllCampaigns,
  pruneStoredBackups,
} from "@/lib/services/stored-backup";
import { createPostgresDumpBackup } from "@/lib/services/db-dump-backup";
import { isPostgresConfigured } from "@/lib/utils";

/** Keep newest N campaign ZIPs per slug and N DB dumps after nightly run. */
const DAILY_BACKUP_KEEP_CAMPAIGN = Math.max(
  1,
  Number(process.env.BACKUP_KEEP_CAMPAIGN_PER_SLUG ?? 7) || 7
);
const DAILY_BACKUP_KEEP_DB_DUMPS = Math.max(
  1,
  Number(process.env.BACKUP_KEEP_DB_DUMPS ?? 7) || 7
);

const TEHRAN_TIME_ZONE = "Asia/Tehran";
const CHECK_INTERVAL_MS = 60_000;

const tehranPartsFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TEHRAN_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

let schedulerStarted = false;
let isRunning = false;

function getTehranClock(date: Date = new Date()): {
  dateIso: string;
  hour: number;
  minute: number;
} {
  const parts = tehranPartsFormatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  const year = get("year");
  const month = get("month");
  const day = get("day");
  let hour = Number(get("hour"));
  if (hour === 24) hour = 0;
  const minute = Number(get("minute"));

  return {
    dateIso: `${year}-${month}-${day}`,
    hour,
    minute,
  };
}

/**
 * Nightly DR backup:
 * 1) Postgres dump (full DB)
 * 2) Per-campaign full ZIPs including media files
 * Runs once per Tehran day inside 00:00–05:59 window only.
 */
export async function runDailyBackupIfDue(): Promise<void> {
  if (isRunning) return;
  if (!isPostgresConfigured()) return;

  const { dateIso, hour } = getTehranClock();
  if (!isWithinDailyBackupWindow(hour)) return;

  const lastCompleted = (await getLastDailyBackupDay()) ?? "";
  if (lastCompleted === dateIso) return;

  const release = await tryAcquireDailyBackupLock();
  if (!release) {
    console.info("[daily-backup] Another run holds the lock; skipping");
    return;
  }

  isRunning = true;
  try {
    // Re-check after lock (poller + in-app race)
    const again = (await getLastDailyBackupDay()) ?? "";
    if (again === dateIso) return;

    console.info(
      `[daily-backup] Starting nightly full backup (DB + media ZIPs) for Tehran day ${dateIso}`
    );

    let dbDump: { filename: string; sizeBytes: number } | null = null;
    try {
      dbDump = await createPostgresDumpBackup();
      console.info(
        `[daily-backup] DB dump ok: ${dbDump.filename} (${dbDump.sizeBytes} bytes)`
      );
    } catch (error) {
      console.error("[daily-backup] DB dump failed:", error);
    }

    // Full campaign ZIPs with media — portable restore in one archive.
    const summary = await createDailyBackupsForAllCampaigns({
      includeUploads: true,
    });

    if (shouldMarkDailyBackupComplete(summary)) {
      try {
        await markDailyBackupCompleted(dateIso);
      } catch (error) {
        console.warn("[daily-backup] Could not persist last-run date:", error);
      }
    }

    try {
      const pruned = await pruneStoredBackups({
        keepCampaignPerSlug: DAILY_BACKUP_KEEP_CAMPAIGN,
        keepDbDumps: DAILY_BACKUP_KEEP_DB_DUMPS,
      });
      if (pruned.deleted.length > 0) {
        console.info(
          `[daily-backup] Pruned ${pruned.deleted.length} old backup(s), freed ${pruned.freedBytes} bytes`
        );
      }
    } catch (error) {
      console.warn("[daily-backup] Prune failed:", error);
    }

    console.info(
      `[daily-backup] Done: dbDump=${dbDump ? "yes" : "no"} created=${summary.created.length} failed=${summary.failed.length}`
    );
    if (summary.failed.length > 0) {
      console.warn("[daily-backup] Campaign ZIP failures:", summary.failed);
    }
  } catch (error) {
    console.error("[daily-backup] Scheduled run failed:", error);
    // Still mark the day to stop every-minute spam; admin can run manual backup.
    try {
      await markDailyBackupCompleted(dateIso);
    } catch {
      // ignore
    }
  } finally {
    isRunning = false;
    await release();
  }
}

/**
 * Starts an in-process timer for nightly Tehran backups (00:00–05:59 catch-up).
 */
export function startDailyBackupScheduler(): void {
  if (schedulerStarted) return;
  if (process.env.DISABLE_DAILY_BACKUP_SCHEDULER === "1") {
    console.info("[daily-backup] Scheduler disabled via DISABLE_DAILY_BACKUP_SCHEDULER");
    return;
  }

  schedulerStarted = true;

  void (async () => {
    const lastCompleted = (await getLastDailyBackupDay()) ?? "none";
    console.info(
      `[daily-backup] Scheduler started (Tehran 00:00–05:59). Today=${getTehranCalendarDateIso()}, lastCompleted=${lastCompleted}`
    );
    await runDailyBackupIfDue();
    setInterval(() => {
      void runDailyBackupIfDue();
    }, CHECK_INTERVAL_MS);
  })();
}
