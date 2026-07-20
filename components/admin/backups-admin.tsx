"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Archive, Download, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAdminCampaign } from "@/components/admin/admin-campaign-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatStorageBytes } from "@/lib/raw-media-storage";
import { formatPersianDateTime } from "@/lib/utils";

interface StoredBackupItem {
  filename: string;
  campaignSlug: string;
  sizeBytes: number;
  createdAt: string;
}

const BACKUP_FETCH_TIMEOUT_MS = 4 * 60 * 1000;

async function readApiError(response: Response, fallback: string): Promise<string> {
  try {
    const result = (await response.json()) as { error?: string };
    if (result.error?.trim()) return result.error;
  } catch {
    // Non-JSON body (proxy timeout / HTML error page)
  }
  if (response.status === 401) return "نشست شما منقضی شده؛ دوباره وارد شوید";
  if (response.status === 504 || response.status === 502) {
    return "سرور پاسخ نداد؛ حجم بکاپ زیاد است یا سرور مشغول است";
  }
  return fallback;
}

export function BackupsAdmin() {
  const { campaignId, currentCampaign } = useAdminCampaign();
  const [backups, setBackups] = useState<StoredBackupItem[]>([]);
  const [lastDailyBackupDay, setLastDailyBackupDay] = useState<string | null>(null);
  const [tehranDay, setTehranDay] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

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
        lastDailyBackupDay?: string | null;
        tehranDay?: string;
        error?: string;
      };
      setBackups(result.backups ?? []);
      setLastDailyBackupDay(result.lastDailyBackupDay ?? null);
      setTehranDay(result.tehranDay ?? null);
    } catch {
      toast.error("خطا در دریافت لیست پشتیبان‌ها");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBackups();
  }, [loadBackups]);

  const createBackup = () => {
    if (!campaignId) {
      toast.error("کمپینی انتخاب نشده است");
      return;
    }

    startTransition(async () => {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), BACKUP_FETCH_TIMEOUT_MS);

      try {
        toast.message("در حال گرفتن پشتیبان…", {
          description: "بسته به حجم فایل‌ها ممکن است چند دقیقه طول بکشد.",
        });

        const response = await fetch("/api/backups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ campaignId }),
          signal: controller.signal,
        });

        if (!response.ok) {
          toast.error(await readApiError(response, "گرفتن پشتیبان ناموفق بود"));
          return;
        }

        const result = (await response.json()) as {
          error?: string;
          warning?: string;
          backup?: StoredBackupItem;
        };

        if (result.warning) {
          toast.warning(result.warning);
        }
        toast.success("پشتیبان روی سرور ذخیره شد");
        await loadBackups();
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          toast.error("زمان بکاپ تمام شد؛ دوباره تلاش کنید یا حجم رسانه‌ها را کمتر کنید");
        } else {
          toast.error("گرفتن پشتیبان ناموفق بود");
        }
      } finally {
        window.clearTimeout(timeoutId);
      }
    });
  };

  const deleteBackup = (filename: string) => {
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Archive className="h-6 w-6 text-primary" />
            پشتیبان‌گیری
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            فایل ZIP پشتیبان روی خود سرور ذخیره می‌شود. هر روز ساعت ۱۲ ظهر به‌وقت تهران به‌صورت
            خودکار گرفته می‌شود. پشتیبان‌ها هرگز خودکار پاک نمی‌شوند؛ فقط ادمین از همین صفحه حذف
            می‌کند.
          </p>
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
          <Button size="sm" disabled={isPending || !campaignId} onClick={createBackup}>
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Archive className="h-4 w-4" />
            )}
            گرفتن پشتیبان الان
            {currentCampaign ? ` (${currentCampaign.title})` : ""}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">فایل‌های ذخیره‌شده روی سرور</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              در حال بارگذاری…
            </div>
          ) : backups.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              هنوز پشتیبانی ذخیره نشده است. دکمه «گرفتن پشتیبان الان» را بزنید یا منتظر بکاپ خودکار
              روزانه بمانید.
            </p>
          ) : (
            <ul className="divide-y rounded-xl border">
              {backups.map((backup) => (
                <li
                  key={backup.filename}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm font-medium" dir="ltr">
                      {backup.filename}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      کمپین: {backup.campaignSlug} —{" "}
                      {formatPersianDateTime(backup.createdAt)} —{" "}
                      {formatStorageBytes(backup.sizeBytes)}
                    </p>
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
