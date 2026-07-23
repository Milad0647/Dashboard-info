"use client";

export type BackupJobPollResult = {
  status: "queued" | "running" | "done" | "failed";
  error?: string;
  result?: {
    filename: string;
    sizeBytes: number;
    includedFiles: number;
    skippedFiles: number;
  };
  warning?: string;
};

async function readJob(jobId: string): Promise<BackupJobPollResult> {
  const response = await fetch(`/api/backups?jobId=${encodeURIComponent(jobId)}`, {
    cache: "no-store",
  });
  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
    job?: BackupJobPollResult & { result?: BackupJobPollResult["result"] };
  };
  if (!response.ok) {
    throw new Error(body.error ?? "خطا در پیگیری وضعیت بکاپ");
  }
  if (!body.job) throw new Error("وضعیت بکاپ پیدا نشد");
  return body.job;
}

/** Start backup and wait until done/failed (supports sync + async API responses). */
export async function startAndWaitForBackup(input: {
  campaignId: string;
  includeUploads?: boolean;
  userId?: string;
  onProgress?: (status: string) => void;
  maxWaitMs?: number;
}): Promise<BackupJobPollResult> {
  const startResponse = await fetch("/api/backups", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      campaignId: input.campaignId,
      includeUploads: input.includeUploads !== false,
      userId: input.userId,
    }),
  });

  const startBody = (await startResponse.json().catch(() => ({}))) as {
    error?: string;
    async?: boolean;
    job?: { id?: string; status?: BackupJobPollResult["status"]; result?: BackupJobPollResult["result"] };
    result?: BackupJobPollResult["result"];
  };

  if (!startResponse.ok && startResponse.status !== 202) {
    throw new Error(startBody.error ?? "شروع بکاپ ناموفق بود");
  }

  // Sync path (data-only): file is already on disk.
  if (startBody.async === false || startBody.job?.status === "done" || startBody.result) {
    const result = startBody.result ?? startBody.job?.result;
    input.onProgress?.("done");
    const done: BackupJobPollResult = { status: "done", result };
    if (result && result.skippedFiles > 0) {
      done.warning = `${result.skippedFiles} فایل رسانه پیدا نشد یا خوانده نشد.`;
    }
    return done;
  }

  const jobId = startBody.job?.id;
  if (!jobId) {
    throw new Error("شناسه کار بکاپ برنگشت");
  }

  const maxWaitMs = input.maxWaitMs ?? 60 * 60 * 1000;
  const startedAt = Date.now();

  while (Date.now() - startedAt < maxWaitMs) {
    const job = await readJob(jobId);
    input.onProgress?.(job.status);

    if (job.status === "done") {
      if (job.result && job.result.skippedFiles > 0) {
        job.warning = `${job.result.skippedFiles} فایل رسانه پیدا نشد یا خوانده نشد.`;
      }
      return job;
    }
    if (job.status === "failed") {
      throw new Error(job.error ?? "بکاپ ناموفق بود");
    }

    await new Promise((resolve) => window.setTimeout(resolve, 2000));
  }

  throw new Error(
    "بکاپ هنوز تمام نشده؛ در پس‌زمینه ادامه دارد. چند دقیقه بعد لیست پشتیبان‌ها را بروزرسانی کنید."
  );
}
