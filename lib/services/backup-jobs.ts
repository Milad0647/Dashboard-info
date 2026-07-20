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

async function runJob(jobId: string): Promise<void> {
  if (runningJobs.has(jobId)) return;
  runningJobs.add(jobId);

  const current = await getBackupJob(jobId);
  if (!current) {
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
  } catch (error) {
    await writeJob({
      ...running,
      status: "failed",
      updatedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Backup failed",
    });
  } finally {
    runningJobs.delete(jobId);
  }
}

/** Start a background backup job and return immediately (avoids proxy 504). */
export async function startStoredBackupJob(input: {
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
  void runJob(job.id);
  return job;
}
