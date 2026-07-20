import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { getBackupsDir } from "@/lib/backups";
import { getTehranCalendarDateIso } from "@/lib/safe-dates";
import { createDailyBackupsForAllCampaigns } from "@/lib/services/stored-backup";
import { isPostgresConfigured } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const authorization = request.headers.get("authorization");
  const bearer =
    authorization?.toLowerCase().startsWith("bearer ")
      ? authorization.slice(7).trim()
      : null;
  const headerSecret = request.headers.get("x-cron-secret")?.trim() ?? null;

  return bearer === secret || headerSecret === secret;
}

async function markDailyBackupCompleted(dateIso: string): Promise<void> {
  try {
    const dir = getBackupsDir();
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, ".last-daily-backup"), `${dateIso}\n`, "utf8");
  } catch {
    // Non-fatal — schedulers may retry the same day
  }
}

async function handleCron(request: Request) {
  if (!authorizeCron(request)) {
    return Response.json(
      {
        success: false,
        error:
          "Unauthorized. Set CRON_SECRET and send Authorization: Bearer <secret>.",
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
  if (summary.created.length > 0 || summary.failed.length === 0) {
    await markDailyBackupCompleted(tehranDay);
  }

  return Response.json({
    success: true,
    createdCount: summary.created.length,
    failedCount: summary.failed.length,
    tehranDay,
    summary,
  });
}

export async function GET(request: Request) {
  return handleCron(request);
}

export async function POST(request: Request) {
  return handleCron(request);
}
