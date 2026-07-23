import { NextResponse } from "next/server";
import { getBackupJob, runBackupJob } from "@/lib/services/backup-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 3600;

function authorizeInternal(request: Request): boolean {
  const secret = process.env.AUTH_SECRET?.trim();
  const header = request.headers.get("x-internal-backup")?.trim();
  if (secret && header && header === secret) return true;

  try {
    const { hostname } = new URL(request.url);
    return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
  } catch {
    return false;
  }
}

/**
 * Internal endpoint: run a queued backup job to completion.
 * Called from localhost by the detached worker (bypasses external proxy timeouts).
 */
export async function POST(request: Request) {
  if (!authorizeInternal(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let jobId = "";
  try {
    const body = (await request.json()) as { jobId?: string };
    jobId = body.jobId?.trim() ?? "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }

  const existing = await getBackupJob(jobId);
  if (!existing) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  await runBackupJob(jobId);
  const job = await getBackupJob(jobId);
  return NextResponse.json({ success: true, job });
}
