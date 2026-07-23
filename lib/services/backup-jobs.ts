import { existsSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { getBackupsDir } from "@/lib/backups";
import {
  createStoredCampaignBackup,
  type CreateStoredBackupResult,
} from "@/lib/services/stored-backup";
import { generateId } from "@/lib/utils";

export type BackupJobStatus = "queued" | "running" | "done" | "failed";

export interface BackupJobRecord {
  id: string;
  campaignId: string;
  userId?: string;
  includeUploads: boolean;
  status: BackupJobStatus;
  createdAt: string;
  updatedAt: string;
  error?: string;
  result?: CreateStoredBackupResult;
}

const JOB_PREFIX = ".backup-job-";
const runningJobs = new Set<string>();

function jobPath(jobId: string): string {
  return path.join(getBackupsDir(), `${JOB_PREFIX}${jobId}.json`);
}

async function writeJob(job: BackupJobRecord): Promise<void> {
  await mkdir(getBackupsDir(), { recursive: true });
  await writeFile(jobPath(job.id), `${JSON.stringify(job, null, 2)}\n`, "utf8");
}

export async function getBackupJob(jobId: string): Promise<BackupJobRecord | null> {
  const file = jobPath(jobId);
  if (!existsSync(file)) return null;
  try {
    const raw = await readFile(file, "utf8");
    return JSON.parse(raw) as BackupJobRecord;
  } catch {
    return null;
  }
}

/** Execute a queued/running backup job to completion (idempotent per process). */
export async function runBackupJob(jobId: string): Promise<void> {
  if (runningJobs.has(jobId)) return;
  runningJobs.add(jobId);

  const current = await getBackupJob(jobId);
  if (!current) {
    runningJobs.delete(jobId);
    return;
  }

  if (current.status === "done" || current.status === "failed") {
    runningJobs.delete(jobId);
    return;
  }

  const running: BackupJobRecord = {
    ...current,
    status: "running",
    updatedAt: new Date().toISOString(),
  };
  await writeJob(running);

  try {
    console.info("[backup-job] started", jobId, {
      campaignId: current.campaignId,
      includeUploads: current.includeUploads,
    });
    const result = await createStoredCampaignBackup(current.campaignId, {
      userId: current.userId,
      includeUploads: current.includeUploads,
    });
    await writeJob({
      ...running,
      status: "done",
      updatedAt: new Date().toISOString(),
      result,
      error: undefined,
    });
    console.info("[backup-job] done", jobId, result.filename, result.sizeBytes);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "Backup failed";
    console.error("[backup-job] failed", jobId, error);
    await writeJob({
      ...running,
      status: "failed",
      updatedAt: new Date().toISOString(),
      error: message,
    });
  } finally {
    runningJobs.delete(jobId);
  }
}

/** Persist a job record and return it. Caller must schedule runBackupJob (e.g. via after()). */
export async function enqueueStoredBackupJob(input: {
  campaignId: string;
  userId?: string;
  includeUploads?: boolean;
}): Promise<BackupJobRecord> {
  const job: BackupJobRecord = {
    id: generateId(),
    campaignId: input.campaignId,
    userId: input.userId,
    includeUploads: input.includeUploads !== false,
    status: "queued",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await writeJob(job);
  return job;
}

/**
 * @deprecated Prefer enqueueStoredBackupJob + after(runBackupJob).
 * Kept for callers that still fire-and-forget.
 */
export async function startStoredBackupJob(input: {
  campaignId: string;
  userId?: string;
  includeUploads?: boolean;
}): Promise<BackupJobRecord> {
  const job = await enqueueStoredBackupJob(input);
  void runBackupJob(job.id);
  return job;
}
