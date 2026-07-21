import { runDailyBackupIfDue } from "@/lib/services/daily-backup-scheduler";
import { getLastDailyBackupDay } from "@/lib/services/daily-backup-state";
import { getTehranCalendarDateIso } from "@/lib/safe-dates";
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

  const before = await getLastDailyBackupDay();
  await runDailyBackupIfDue();
  const after = await getLastDailyBackupDay();
  const tehranDay = getTehranCalendarDateIso();

  return Response.json({
    success: true,
    tehranDay,
    alreadyDone: before === tehranDay,
    markedComplete: after === tehranDay,
    lastDailyBackupDay: after,
  });
}

export async function GET(request: Request) {
  return handleCron(request);
}

export async function POST(request: Request) {
  return handleCron(request);
}
