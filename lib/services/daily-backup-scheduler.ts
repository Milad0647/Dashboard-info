import { getTehranCalendarDateIso } from "@/lib/safe-dates";
import {
  getLastDailyBackupDay,
  markDailyBackupCompleted,
  shouldMarkDailyBackupComplete,
} from "@/lib/services/daily-backup-state";
import { createDailyBackupsForAllCampaigns } from "@/lib/services/stored-backup";
import { isPostgresConfigured } from "@/lib/utils";

const TEHRAN_TIME_ZONE = "Asia/Tehran";
/** Daily backup hour in Asia/Tehran (midnight). */
const BACKUP_HOUR_TEHRAN = 0;
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
  // en-GB midnight can be reported as 24 in some environments
  if (hour === 24) hour = 0;
  const minute = Number(get("minute"));

  return {
    dateIso: `${year}-${month}-${day}`,
    hour,
    minute,
  };
}

async function runDailyBackupIfDue(): Promise<void> {
  if (isRunning) return;
  if (!isPostgresConfigured()) return;

  const { dateIso, hour } = getTehranClock();
  if (hour < BACKUP_HOUR_TEHRAN) return;

  // Always re-read disk so Docker poller / HTTP cron can dedupe with this process.
  const lastCompleted = (await getLastDailyBackupDay()) ?? "";
  if (lastCompleted === dateIso) return;

  isRunning = true;
  try {
    console.info(`[daily-backup] Starting scheduled backup for Tehran day ${dateIso}`);
    const summary = await createDailyBackupsForAllCampaigns();
    if (shouldMarkDailyBackupComplete(summary)) {
      try {
        await markDailyBackupCompleted(dateIso);
      } catch (error) {
        console.warn("[daily-backup] Could not persist last-run date:", error);
      }
    } else {
      console.warn(
        "[daily-backup] All campaigns failed; will retry later the same day"
      );
    }
    console.info(
      `[daily-backup] Done: created=${summary.created.length} failed=${summary.failed.length}`
    );
    if (summary.failed.length > 0) {
      console.warn("[daily-backup] Failures:", summary.failed);
    }
  } catch (error) {
    console.error("[daily-backup] Scheduled run failed:", error);
  } finally {
    isRunning = false;
  }
}

/**
 * Starts an in-process timer that creates campaign ZIP backups once per Tehran day
 * at/after 12:00. Safe to call multiple times (no-op after first start).
 * Persists last successful day under BACKUP_DIR so restarts do not double-run.
 * If the process was down at noon, it catches up later the same day.
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
      `[daily-backup] Scheduler started (Tehran midnight). Today=${getTehranCalendarDateIso()}, lastCompleted=${lastCompleted}`
    );
    await runDailyBackupIfDue();
    setInterval(() => {
      void runDailyBackupIfDue();
    }, CHECK_INTERVAL_MS);
  })();
}
