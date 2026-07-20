import { NextResponse } from "next/server";
import { getAuthSession, isFullAdmin } from "@/lib/auth/get-session";
import { getBackupJob, startStoredBackupJob } from "@/lib/services/backup-jobs";
import { getLastDailyBackupDay } from "@/lib/services/daily-backup-state";
import { getTehranCalendarDateIso } from "@/lib/safe-dates";
import { listStoredBackups } from "@/lib/services/stored-backup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function requireFullAdmin() {
  const session = await getAuthSession();
  if (!session || !isFullAdmin(session)) return null;
  return session;
}

/** List stored backup ZIP files, or poll a background job with ?jobId=. */
export async function GET(request: Request) {
  if (!(await requireFullAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId")?.trim();
    if (jobId) {
      const job = await getBackupJob(jobId);
      if (!job) {
        return NextResponse.json({ error: "Job not found" }, { status: 404 });
      }
      return NextResponse.json({ job });
    }

    const campaignSlug = searchParams.get("campaignSlug")?.trim() || undefined;
    const [backups, lastDailyBackupDay] = await Promise.all([
      listStoredBackups(campaignSlug),
      getLastDailyBackupDay(),
    ]);
    return NextResponse.json({
      backups,
      lastDailyBackupDay,
      tehranDay: getTehranCalendarDateIso(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list backups";
    console.error("[backups] list failed", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Start a campaign backup in the background (returns immediately).
 * Poll GET /api/backups?jobId=... until status is done|failed.
 */
export async function POST(request: Request) {
  if (!(await requireFullAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let campaignId = "";
  let userId: string | undefined;
  let includeUploads = true;
  try {
    const body = (await request.json()) as {
      campaignId?: string;
      userId?: string;
      includeUploads?: boolean;
    };
    campaignId = body.campaignId?.trim() ?? "";
    userId = body.userId?.trim() || undefined;
    includeUploads = body.includeUploads !== false;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!campaignId) {
    return NextResponse.json({ error: "campaignId is required" }, { status: 400 });
  }

  try {
    const job = await startStoredBackupJob({
      campaignId,
      userId,
      includeUploads,
    });
    return NextResponse.json(
      {
        success: true,
        async: true,
        job,
        message:
          "بکاپ در پس‌زمینه شروع شد. تا تمام شدن صبر کنید؛ صفحه را نبندید.",
      },
      { status: 202 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Backup failed";
    console.error("[backups] start job failed", error);
    const status = message === "Campaign not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
