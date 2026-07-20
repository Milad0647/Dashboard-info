"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  Archive,
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
import { formatPersianDateTime } from "@/lib/utils";

interface StoredBackupItem {
  filename: string;
  campaignSlug: string;
  sizeBytes: number;
  createdAt: string;
}

const BACKUP_FETCH_TIMEOUT_MS = 10 * 60 * 1000;

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

export function BackupsAdmin() {
  const { campaignId, currentCampaign } = useAdminCampaign();
  const [backups, setBackups] = useState<StoredBackupItem[]>([]);
  const [lastDailyBackupDay, setLastDailyBackupDay] = useState<string | null>(null);
  const [tehranDay, setTehranDay] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [restoreUserId, setRestoreUserId] = useState("");
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
        lastDailyBackupDay?: string | null;
        tehranDay?: string;
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
        toast.message("در حال گرفتن پشتیبان کامل…", {
          description:
            "همه کاربران، ویدیوها، پوسترها، فایل‌ها و رسانه‌ها داخل پوشه‌بندی ZIP ذخیره می‌شوند.",
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
          warning?: string;
        };

        if (result.warning) toast.warning(result.warning);
        toast.success("پشتیبان کامل روی سرور ذخیره شد");
        await loadBackups();
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          toast.error("زمان بکاپ تمام شد؛ دوباره تلاش کنید");
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
            بکاپ کامل شامل همه کاربران، همه بخش‌ها (ویدیو، پوستر، بیلبورد، …)، JSONها و فایل‌های
            رسانه است — داخل ZIP به صورت{" "}
            <span dir="ltr">users/کاربر/بخش.json</span>. هر روز ساعت ۱۲ شب به‌وقت تهران خودکار
            گرفته می‌شود. پشتیبان‌ها فقط با حذف دستی ادمین پاک می‌شوند.
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
            گرفتن پشتیبان کامل
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
              هنوز پشتیبانی ذخیره نشده است. دکمه «گرفتن پشتیبان کامل» را بزنید.
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
