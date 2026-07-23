import { after, NextResponse } from "next/server";
import { spawn } from "child_process";
import { getAuthSession, isFullAdmin } from "@/lib/auth/get-session";
import {
  enqueueStoredBackupJob,
  getBackupJob,
  runBackupJob,
} from "@/lib/services/backup-jobs";
import { getLastDailyBackupDay } from "@/lib/services/daily-backup-state";
import { getTehranCalendarDateIso } from "@/lib/safe-dates";
import {
  createStoredCampaignBackup,
  listStoredBackups,
} from "@/lib/services/stored-backup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Allow long ZIP builds on self-hosted Node (media backups). */
export const maxDuration = 3600;

async function requireFullAdmin() {
  const session = await getAuthSession();
  if (!session || !isFullAdmin(session)) return null;
  return session;
}

/** Kick the job inside this process and optionally via localhost HTTP. */
function scheduleBackupJob(jobId: string, options?: { detachWorker?: boolean }): void {
  after(() => runBackupJob(jobId));

  if (!options?.detachWorker) return;

  const port = process.env.PORT?.trim() || "3030";
  const secret = process.env.AUTH_SECRET ?? "";
  const safeJobId = jobId.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safeJobId) return;

  const script = `
fetch("http://127.0.0.1:${port}/api/backups/run", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-internal-backup": process.env.AUTH_SECRET || ""
  },
  body: JSON.stringify({ jobId: "${safeJobId}" })
}).then(async (r) => {
  const text = await r.text();
  if (!r.ok) {
    console.error("[backup-kick] failed", r.status, text);
    process.exitCode = 1;
  }
}).catch((err) => {
  console.error("[backup-kick] error", err);
  process.exitCode = 1;
});
`;

  try {
    const child = spawn(process.execPath, ["-e", script], {
      detached: true,
      stdio: "ignore",
      env: { ...process.env, AUTH_SECRET: secret },
    });
    child.unref();
  } catch (error) {
    console.error("[backup-kick] spawn failed", error);
  }
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

      // If the original after() never ran (or process died mid-job), kick again.
      if (job.status === "queued") {
        scheduleBackupJob(job.id);
      } else if (job.status === "running") {
        const staleMs = Date.now() - new Date(job.updatedAt).getTime();
        if (Number.isFinite(staleMs) && staleMs > 60_000) {
          scheduleBackupJob(job.id);
        }
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
 * Create a campaign backup.
 * - includeUploads=false → runs synchronously (reliable small ZIP)
 * - includeUploads=true → enqueues job and continues via after() (avoids proxy 504)
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
    // Data-only backups are usually small — finish in this request so the file always lands.
    if (!includeUploads) {
      const result = await createStoredCampaignBackup(campaignId, {
        userId,
        includeUploads: false,
      });
      return NextResponse.json({
        success: true,
        async: false,
        result,
        job: {
          id: result.filename,
          status: "done" as const,
          result,
        },
        message: "بکاپ سریع آماده شد",
      });
    }

    const job = await enqueueStoredBackupJob({
      campaignId,
      userId,
      includeUploads: true,
    });

    scheduleBackupJob(job.id, { detachWorker: true });

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
