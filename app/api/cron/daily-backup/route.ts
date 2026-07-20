import { getTehranCalendarDateIso } from "@/lib/safe-dates";
import {
  markDailyBackupCompleted,
  shouldMarkDailyBackupComplete,
} from "@/lib/services/daily-backup-state";
import { createDailyBackupsForAllCampaigns } from "@/lib/services/stored-backup";
import { isPostgresConfigured } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isLocalhostRequest(request: Request): boolean {
  try {
    const { hostname } = new URL(request.url);
    return (
      hostname === "127.0.0.1" ||
      hostname === "localhost" ||
      hostname === "::1"
    );
  } catch {
    return false;
  }
}

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const authorization = request.headers.get("authorization");
    const bearer =
      authorization?.toLowerCase().startsWith("bearer ")
        ? authorization.slice(7).trim()
        : null;
    const headerSecret = request.headers.get("x-cron-secret")?.trim() ?? null;
    if (bearer === secret || headerSecret === secret) return true;
  }

  // Docker sidecar poller calls 127.0.0.1 — allow even when CRON_SECRET is unset.
  return isLocalhostRequest(request);
}

async function handleCron(request: Request) {
  if (!authorizeCron(request)) {
    return Response.json(
      {
        success: false,
        error:
          "Unauthorized. Set CRON_SECRET and send Authorization: Bearer <secret>, or call from localhost.",
      },
      { status: 401 }
    );
  }

  if (!isPostgresConfigured()) {
    return Response.json(
      { success: false, error: "Database is not configured" },
      { status: 503 }
    );
  }

  const summary = await createDailyBackupsForAllCampaigns();
  const tehranDay = getTehranCalendarDateIso();
  let markedComplete = false;
  if (shouldMarkDailyBackupComplete(summary)) {
    try {
      await markDailyBackupCompleted(tehranDay);
      markedComplete = true;
    } catch (error) {
      console.warn("[daily-backup] Could not persist last-run date:", error);
    }
  }

  return Response.json({
    success: true,
    createdCount: summary.created.length,
    failedCount: summary.failed.length,
    tehranDay,
    markedComplete,
    summary,
  });
}

export async function GET(request: Request) {
  return handleCron(request);
}

export async function POST(request: Request) {
  return handleCron(request);
}
