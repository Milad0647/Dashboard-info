import { readFile, writeFile } from "fs/promises";
import path from "path";
import { getBackupsDir } from "@/lib/backups";
import { getTehranCalendarDateIso } from "@/lib/safe-dates";
import { createDailyBackupsForAllCampaigns } from "@/lib/services/stored-backup";
import { isPostgresConfigured } from "@/lib/utils";

const TEHRAN_TIME_ZONE = "Asia/Tehran";
/** Daily backup hour in Asia/Tehran (noon). */
const BACKUP_HOUR_TEHRAN = 12;
const CHECK_INTERVAL_MS = 60_000;
const STATE_FILENAME = ".last-daily-backup";

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
let lastCompletedTehranDate = "";
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

function stateFilePath(): string {
  return path.join(getBackupsDir(), STATE_FILENAME);
}

async function loadLastCompletedDate(): Promise<string> {
  try {
    const raw = (await readFile(stateFilePath(), "utf8")).trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
  } catch {
    return "";
  }
}

async function saveLastCompletedDate(dateIso: string): Promise<void> {
  try {
    await writeFile(stateFilePath(), `${dateIso}\n`, "utf8");
  } catch (error) {
    console.warn("[daily-backup] Could not persist last-run date:", error);
  }
}

async function runDailyBackupIfDue(): Promise<void> {
  if (isRunning) return;
  if (!isPostgresConfigured()) return;

  const { dateIso, hour } = getTehranClock();
  if (hour < BACKUP_HOUR_TEHRAN) return;
  if (lastCompletedTehranDate === dateIso) return;

  isRunning = true;
  try {
    console.info(`[daily-backup] Starting scheduled backup for Tehran day ${dateIso}`);
    const summary = await createDailyBackupsForAllCampaigns();
    lastCompletedTehranDate = dateIso;
    await saveLastCompletedDate(dateIso);
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
    lastCompletedTehranDate = await loadLastCompletedDate();
    console.info(
      `[daily-backup] Scheduler started (Tehran noon). Today=${getTehranCalendarDateIso()}, lastCompleted=${lastCompletedTehranDate || "none"}`
    );
    await runDailyBackupIfDue();
    setInterval(() => {
      void runDailyBackupIfDue();
    }, CHECK_INTERVAL_MS);
  })();
}
