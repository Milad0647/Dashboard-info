/**
 * Sidecar poller for Docker: triggers daily campaign backups at 12:00 Asia/Tehran
 * by calling the local Next.js cron endpoint. Started from docker-entrypoint.sh.
 *
 * Shares BACKUP_DIR/.last-daily-backup with the in-app scheduler so only one run happens per day.
 * Localhost calls are authorized even without CRON_SECRET (see /api/cron/daily-backup).
 */
import { readFile } from "fs/promises";
import path from "path";

const PORT = Number(process.env.PORT || 3030);
const CHECK_MS = 60_000;
const STATE_FILENAME = ".last-daily-backup";
const SERVER_WAIT_ATTEMPTS = 90;
const SERVER_WAIT_MS = 2_000;

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

async function waitForServer() {
  for (let attempt = 1; attempt <= SERVER_WAIT_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/`, {
        method: "GET",
        redirect: "manual",
      });
      // Any HTTP response means the Next server is accepting connections.
      if (response.status > 0) {
        console.info(
          `[daily-backup-poller] Server ready after ${attempt} attempt(s) (HTTP ${response.status})`
        );
        return true;
      }
    } catch {
      // Not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, SERVER_WAIT_MS));
  }
  console.error("[daily-backup-poller] Server did not become ready in time");
  return false;
}

async function triggerBackup() {
  const secret = process.env.CRON_SECRET?.trim();
  const headers = {};
  if (secret) {
    headers.Authorization = `Bearer ${secret}`;
    headers["x-cron-secret"] = secret;
  }

  const response = await fetch(`http://127.0.0.1:${PORT}/api/cron/daily-backup`, {
    method: "POST",
    headers,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status}: ${body.slice(0, 200)}`);
  }

  const result = await response.json().catch(() => null);
  return result;
}

async function tick() {
  if (running) return;
  if (process.env.DISABLE_DAILY_BACKUP_SCHEDULER === "1") return;

  const { dateIso, hour } = tehranClock();
  if (hour < 0) return;

  const lastCompleted = await loadLastCompleted();
  if (lastCompleted === dateIso) return;

  running = true;
  try {
    console.info(`[daily-backup-poller] Triggering backup for ${dateIso}`);
    const result = await triggerBackup();
    const created = result?.createdCount ?? "?";
    const failed = result?.failedCount ?? "?";
    console.info(
      `[daily-backup-poller] Completed for ${dateIso} (created=${created} failed=${failed})`
    );
  } catch (error) {
    console.error("[daily-backup-poller] Failed:", error);
  } finally {
    running = false;
  }
}

console.info("[daily-backup-poller] Started (Tehran midnight via localhost cron)");

void (async () => {
  const ready = await waitForServer();
  if (!ready) return;
  await tick();
  setInterval(() => {
    void tick();
  }, CHECK_MS);
})();
