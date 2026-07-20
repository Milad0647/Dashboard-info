/**
 * Sidecar poller for Docker: triggers daily campaign backups at 12:00 Asia/Tehran
 * by calling the local Next.js cron endpoint. Started from docker-entrypoint.sh.
 *
 * Shares BACKUP_DIR/.last-daily-backup with the in-app scheduler so only one run happens per day.
 */
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";

const PORT = Number(process.env.PORT || 3030);
const CHECK_MS = 60_000;
const STATE_FILENAME = ".last-daily-backup";

let lastCompleted = "";
let running = false;

function backupsDir() {
  return process.env.BACKUP_DIR?.trim() || path.join(process.cwd(), "data", "backups");
}

function stateFilePath() {
  return path.join(backupsDir(), STATE_FILENAME);
}

function tehranClock(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type) => parts.find((part) => part.type === type)?.value ?? "";
  let hour = Number(get("hour"));
  if (hour === 24) hour = 0;

  return {
    dateIso: `${get("year")}-${get("month")}-${get("day")}`,
    hour,
  };
}

async function loadLastCompleted() {
  try {
    const raw = (await readFile(stateFilePath(), "utf8")).trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
  } catch {
    return "";
  }
}

async function saveLastCompleted(dateIso) {
  try {
    await mkdir(backupsDir(), { recursive: true });
    await writeFile(stateFilePath(), `${dateIso}\n`, "utf8");
  } catch (error) {
    console.warn("[daily-backup-poller] Could not persist last-run date:", error);
  }
}

async function triggerBackup() {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    console.warn(
      "[daily-backup-poller] CRON_SECRET is not set; cannot call /api/cron/daily-backup"
    );
    return false;
  }

  const response = await fetch(`http://127.0.0.1:${PORT}/api/cron/daily-backup`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "x-cron-secret": secret,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status}: ${body.slice(0, 200)}`);
  }

  return true;
}

async function tick() {
  if (running) return;
  if (process.env.DISABLE_DAILY_BACKUP_SCHEDULER === "1") return;

  const { dateIso, hour } = tehranClock();
  if (hour < 12) return;

  lastCompleted = await loadLastCompleted();
  if (lastCompleted === dateIso) return;

  running = true;
  try {
    console.info(`[daily-backup-poller] Triggering backup for ${dateIso}`);
    const ok = await triggerBackup();
    if (ok) {
      lastCompleted = dateIso;
      await saveLastCompleted(dateIso);
      console.info(`[daily-backup-poller] Completed for ${dateIso}`);
    }
  } catch (error) {
    console.error("[daily-backup-poller] Failed:", error);
  } finally {
    running = false;
  }
}

console.info("[daily-backup-poller] Started (Tehran noon via localhost cron)");
setInterval(() => {
  void tick();
}, CHECK_MS);
setTimeout(() => {
  void tick();
}, 15_000);
