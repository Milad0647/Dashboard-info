"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Archive,
  Database,
  Download,
  Loader2,
  RefreshCw,
  RotateCcw,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { useAdminCampaign } from "@/components/admin/admin-campaign-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatStorageBytes } from "@/lib/raw-media-storage";
import { startAndWaitForBackup } from "@/lib/client/backup-job";
import { formatPersianDateTime } from "@/lib/utils";

interface StoredBackupItem {
  filename: string;
  campaignSlug: string;
  kind: "campaign" | "db-dump";
  sizeBytes: number;
  createdAt: string;
}

async function readApiError(response: Response, fallback: string): Promise<string> {
  try {
    const result = (await response.json()) as { error?: string };
    if (result.error?.trim()) return result.error;
  } catch {
    // Non-JSON body
  }
  if (response.status === 401) return "نشست شما منقضی شده؛ دوباره وارد شوید";
  if (response.status === 504 || response.status === 502) {
    return "سرور پاسخ نداد؛ حجم بکاپ زیاد است یا سرور مشغول است";
  }
  return fallback;
}

function formatFreed(bytes: number): string {
  return formatStorageBytes(bytes);
}

export function BackupsAdmin() {
  const { campaignId, currentCampaign } = useAdminCampaign();
  const [backups, setBackups] = useState<StoredBackupItem[]>([]);
  const [totalBytes, setTotalBytes] = useState(0);
  const [lastDailyBackupDay, setLastDailyBackupDay] = useState<string | null>(null);
  const [tehranDay, setTehranDay] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [restoreUserId, setRestoreUserId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [olderThanDays, setOlderThanDays] = useState("7");
  const fullRestoreRef = useRef<HTMLInputElement>(null);
  const userRestoreRef = useRef<HTMLInputElement>(null);

  const loadBackups = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/backups", { cache: "no-store" });
      if (!response.ok) {
        toast.error(await readApiError(response, "خطا در دریافت لیست پشتیبان‌ها"));
        return;
      }
      const result = (await response.json()) as {
        backups?: StoredBackupItem[];
        totalBytes?: number;
        lastDailyBackupDay?: string | null;
        tehranDay?: string;
      };
      setBackups(result.backups ?? []);
      setTotalBytes(result.totalBytes ?? 0);
      setLastDailyBackupDay(result.lastDailyBackupDay ?? null);
      setTehranDay(result.tehranDay ?? null);
      setSelected(new Set());
    } catch {
      toast.error("خطا در دریافت لیست پشتیبان‌ها");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBackups();
  }, [loadBackups]);

  const allSelected = useMemo(
    () => backups.length > 0 && selected.size === backups.length,
    [backups.length, selected.size]
  );

  const selectedBytes = useMemo(() => {
    let sum = 0;
    for (const item of backups) {
      if (selected.has(item.filename)) sum += item.sizeBytes;
    }
    return sum;
  }, [backups, selected]);

  const toggleSelected = (filename: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(filename)) next.delete(filename);
      else next.add(filename);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(backups.map((item) => item.filename)));
  };

  const createBackup = (includeUploads: boolean) => {
    if (!campaignId) {
      toast.error("کمپینی انتخاب نشده است");
      return;
    }

    startTransition(async () => {
      try {
        setJobStatus("queued");
        toast.message(
          includeUploads ? "بکاپ کامل در پس‌زمینه شروع شد…" : "بکاپ سریع (بدون رسانه) شروع شد…",
          {
            description:
              includeUploads
                ? "ممکن است برای حجم زیاد چند دقیقه طول بکشد؛ صفحه را باز نگه دارید."
                : "فقط JSON و ساختار کاربران؛ فایل‌های رسانه روی volume سرور می‌مانند.",
          }
        );

        const job = await startAndWaitForBackup({
          campaignId,
          includeUploads,
          onProgress: (status) => setJobStatus(status),
        });

        if (job.warning) toast.warning(job.warning);
        toast.success(
          includeUploads ? "پشتیبان کامل آماده شد" : "پشتیبان سریع (بدون رسانه) آماده شد"
        );
        setJobStatus(null);
        await loadBackups();
      } catch (error) {
        setJobStatus(null);
        toast.error(error instanceof Error ? error.message : "گرفتن پشتیبان ناموفق بود");
      }
    });
  };

  const deleteBackup = (filename: string) => {
    const ok = window.confirm(`این فایل حذف شود؟\n${filename}`);
    if (!ok) return;

    startTransition(async () => {
      try {
        const response = await fetch(`/api/backups/${encodeURIComponent(filename)}`, {
          method: "DELETE",
        });
        if (!response.ok) {
          toast.error(await readApiError(response, "حذف پشتیبان ناموفق بود"));
          return;
        }
        toast.success("پشتیبان حذف شد");
        await loadBackups();
      } catch {
        toast.error("حذف پشتیبان ناموفق بود");
      }
    });
  };

  const deleteSelected = () => {
    if (selected.size === 0) {
      toast.error("هیچ فایلی انتخاب نشده است");
      return;
    }
    const ok = window.confirm(
      `${selected.size} فایل انتخاب‌شده حذف شود؟ (${formatFreed(selectedBytes)})`
    );
    if (!ok) return;

    startTransition(async () => {
      try {
        const response = await fetch("/api/backups/cleanup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filenames: Array.from(selected) }),
        });
        if (!response.ok) {
          toast.error(await readApiError(response, "حذف دسته‌جمعی ناموفق بود"));
          return;
        }
        const result = (await response.json()) as {
          deleted?: string[];
          failed?: string[];
        };
        const deletedCount = result.deleted?.length ?? 0;
        const failedCount = result.failed?.length ?? 0;
        if (failedCount > 0) {
          toast.warning(`${deletedCount} حذف شد، ${failedCount} ناموفق`);
        } else {
          toast.success(`${deletedCount} فایل حذف شد`);
        }
        await loadBackups();
      } catch {
        toast.error("حذف دسته‌جمعی ناموفق بود");
      }
    });
  };

  const cleanupOlderThan = () => {
    const days = Math.floor(Number(olderThanDays));
    if (!Number.isFinite(days) || days < 1) {
      toast.error("تعداد روز باید حداقل ۱ باشد");
      return;
    }
    const ok = window.confirm(
      `همه پشتیبان‌های قدیمی‌تر از ${days} روز حذف شوند؟ این کار برگشت‌ناپذیر است.`
    );
    if (!ok) return;

    startTransition(async () => {
      try {
        const response = await fetch("/api/backups/cleanup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ olderThanDays: days }),
        });
        if (!response.ok) {
          toast.error(await readApiError(response, "پاکسازی ناموفق بود"));
          return;
        }
        const result = (await response.json()) as {
          deleted?: string[];
          freedBytes?: number;
        };
        const deletedCount = result.deleted?.length ?? 0;
        if (deletedCount === 0) {
          toast.message("فایل قدیمی‌تری برای حذف پیدا نشد");
        } else {
          toast.success(
            `${deletedCount} فایل حذف شد` +
              (result.freedBytes ? ` (${formatFreed(result.freedBytes)})` : "")
          );
        }
        await loadBackups();
      } catch {
        toast.error("پاکسازی ناموفق بود");
      }
    });
  };

  const keepNewestOnly = () => {
    const ok = window.confirm(
      "فقط ۷ بکاپ اخیر هر کمپین و ۷ دامپ دیتابیس اخیر نگه داشته شود و بقیه حذف شوند؟"
    );
    if (!ok) return;

    startTransition(async () => {
      try {
        const response = await fetch("/api/backups/cleanup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keepCampaignPerSlug: 7, keepDbDumps: 7 }),
        });
        if (!response.ok) {
          toast.error(await readApiError(response, "پاکسازی ناموفق بود"));
          return;
        }
        const result = (await response.json()) as {
          deleted?: string[];
          freedBytes?: number;
        };
        const deletedCount = result.deleted?.length ?? 0;
        if (deletedCount === 0) {
          toast.message("چیزی برای حذف نبود");
        } else {
          toast.success(
            `${deletedCount} فایل قدیمی حذف شد` +
              (result.freedBytes ? ` (${formatFreed(result.freedBytes)})` : "")
          );
        }
        await loadBackups();
      } catch {
        toast.error("پاکسازی ناموفق بود");
      }
    });
  };

  const restoreFromFile = (file: File, mode: "full" | "user") => {
    if (!campaignId) {
      toast.error("کمپینی انتخاب نشده است");
      return;
    }
    if (mode === "user" && !restoreUserId.trim()) {
      toast.error("شناسه کاربر (userId) را وارد کنید");
      return;
    }

    if (mode === "full") {
      const ok = window.confirm(
        "هشدار: همه داده‌های فعلی این کمپین پاک می‌شود و کامل با بکاپ جایگزین می‌گردد. ادامه می‌دهید؟"
      );
      if (!ok) return;
    } else {
      const ok = window.confirm(
        "هشدار: محتوای فعلی همین کاربر در کمپین پاک و با بکاپ جایگزین می‌شود. ادامه می‌دهید؟"
      );
      if (!ok) return;
    }

    startTransition(async () => {
      try {
        toast.message(mode === "full" ? "در حال بازیابی کامل…" : "در حال ایمپورت کاربر…");
        const formData = new FormData();
        formData.append("file", file);
        formData.append("campaignId", campaignId);
        formData.append("mode", mode);
        if (mode === "user") formData.append("userId", restoreUserId.trim());

        const response = await fetch("/api/backups/restore", {
          method: "POST",
          body: formData,
        });
        if (!response.ok) {
          toast.error(await readApiError(response, "بازیابی ناموفق بود"));
          return;
        }
        toast.success(mode === "full" ? "بازیابی کامل انجام شد" : "کاربر بازیابی شد");
        window.location.reload();
      } catch {
        toast.error("بازیابی ناموفق بود");
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Archive className="h-6 w-6 text-primary" />
            پشتیبان‌گیری
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            بکاپ شبانه خودکار (۰۰:۰۰–۰۵:۵۹ تهران) یک‌بار در روز: دامپ دیتابیس + ZIP کامل هر کمپین
            همراه با فایل‌های رسانه. بکاپ‌های قدیمی‌تر از ۷ نسخه اخیر به‌صورت خودکار پاک می‌شوند.
          </p>
          {jobStatus ? (
            <p className="mt-2 text-xs font-medium text-primary">
              وضعیت کار بکاپ: {jobStatus === "running" ? "در حال ساخت ZIP…" : jobStatus}
            </p>
          ) : null}
          {!isLoading && (
            <p className="mt-2 text-xs text-muted-foreground">
              وضعیت بکاپ خودکار امروز:{" "}
              {lastDailyBackupDay && tehranDay && lastDailyBackupDay === tehranDay ? (
                <span className="font-medium text-emerald-600">انجام شده</span>
              ) : (
                <span className="font-medium text-amber-600">هنوز گرفته نشده</span>
              )}
              {lastDailyBackupDay ? (
                <span dir="ltr" className="ms-1 opacity-80">
                  (آخرین: {lastDailyBackupDay})
                </span>
              ) : null}
              {backups.length > 0 ? (
                <span className="ms-2">
                  — {backups.length} فایل، مجموع {formatStorageBytes(totalBytes)}
                </span>
              ) : null}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={isLoading || isPending}
            onClick={() => void loadBackups()}
          >
            <RefreshCw className="h-4 w-4" />
            بروزرسانی لیست
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={isPending || !campaignId}
            onClick={() => createBackup(false)}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
            بکاپ سریع (بدون رسانه)
          </Button>
          <Button size="sm" disabled={isPending || !campaignId} onClick={() => createBackup(true)}>
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Archive className="h-4 w-4" />
            )}
            بکاپ کامل با رسانه
            {currentCampaign ? ` (${currentCampaign.title})` : ""}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">بازیابی از ZIP</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="destructive"
              size="sm"
              disabled={isPending || !campaignId}
              onClick={() => fullRestoreRef.current?.click()}
            >
              <RotateCcw className="h-4 w-4" />
              بازیابی کامل کمپین
            </Button>
            <input
              ref={fullRestoreRef}
              type="file"
              accept=".zip,application/zip"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) restoreFromFile(file, "full");
                event.target.value = "";
              }}
            />
          </div>

          <div className="space-y-2 rounded-xl border p-3">
            <Label htmlFor="restore-user-id">ایمپورت فقط یک کاربر</Label>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[220px] flex-1 space-y-1">
                <Input
                  id="restore-user-id"
                  dir="ltr"
                  placeholder="user UUID"
                  value={restoreUserId}
                  onChange={(event) => setRestoreUserId(event.target.value)}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={isPending || !campaignId}
                onClick={() => userRestoreRef.current?.click()}
              >
                <UserRound className="h-4 w-4" />
                انتخاب ZIP کاربر
              </Button>
              <input
                ref={userRestoreRef}
                type="file"
                accept=".zip,application/zip"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) restoreFromFile(file, "user");
                  event.target.value = "";
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              محتوای فعلی همان کاربر پاک و با داده‌های بکاپ جایگزین می‌شود.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base">فایل‌های ذخیره‌شده روی سرور</CardTitle>
          {!isLoading && backups.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={1}
                  className="h-8 w-16"
                  dir="ltr"
                  value={olderThanDays}
                  onChange={(event) => setOlderThanDays(event.target.value)}
                  aria-label="روز"
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={cleanupOlderThan}
                >
                  حذف قدیمی‌تر از N روز
                </Button>
              </div>
              <Button variant="outline" size="sm" disabled={isPending} onClick={keepNewestOnly}>
                نگه‌داشتن ۷ نسخه اخیر
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={isPending || selected.size === 0}
                onClick={deleteSelected}
              >
                <Trash2 className="h-4 w-4" />
                حذف انتخاب‌شده‌ها
                {selected.size > 0 ? ` (${selected.size})` : ""}
              </Button>
            </div>
          ) : null}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              در حال بارگذاری…
            </div>
          ) : backups.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              هنوز پشتیبانی ذخیره نشده است. دکمه «گرفتن پشتیبان کامل» را بزنید.
            </p>
          ) : (
            <div className="space-y-2">
              <label className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="size-4 rounded border"
                />
                انتخاب همه ({backups.length} فایل — {formatStorageBytes(totalBytes)})
              </label>
              <ul className="divide-y rounded-xl border">
                {backups.map((backup) => (
                  <li
                    key={backup.filename}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selected.has(backup.filename)}
                        onChange={() => toggleSelected(backup.filename)}
                        className="mt-1 size-4 shrink-0 rounded border"
                        aria-label={`انتخاب ${backup.filename}`}
                      />
                      <div className="min-w-0 space-y-1">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                          {backup.kind === "db-dump" ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                              <Database className="h-3 w-3" />
                              دامپ دیتابیس
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                              <Archive className="h-3 w-3" />
                              ZIP کمپین
                            </span>
                          )}
                          <span className="truncate" dir="ltr">
                            {backup.filename}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {backup.kind === "db-dump"
                            ? "دیتابیس Postgres"
                            : `کمپین: ${backup.campaignSlug}`}{" "}
                          — {formatPersianDateTime(backup.createdAt)} —{" "}
                          {formatStorageBytes(backup.sizeBytes)}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <a
                          href={`/api/backups/${encodeURIComponent(backup.filename)}`}
                          download={backup.filename}
                        >
                          <Download className="h-4 w-4" />
                          دانلود
                        </a>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isPending}
                        onClick={() => deleteBackup(backup.filename)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                        حذف
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
