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

export function BackupsAdmin() {
  const { campaignId, currentCampaign } = useAdminCampaign();
  const [backups, setBackups] = useState<StoredBackupItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const loadBackups = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/backups");
      const result = (await response.json()) as {
        backups?: StoredBackupItem[];
        error?: string;
      };
      if (!response.ok) {
        toast.error(result.error ?? "خطا در دریافت لیست پشتیبان‌ها");
        return;
      }
      setBackups(result.backups ?? []);
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
      try {
        const response = await fetch("/api/backups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ campaignId }),
        });
        const result = (await response.json()) as {
          error?: string;
          backup?: StoredBackupItem;
        };
        if (!response.ok) {
          toast.error(result.error ?? "گرفتن پشتیبان ناموفق بود");
          return;
        }
        toast.success("پشتیبان روی سرور ذخیره شد");
        await loadBackups();
      } catch {
        toast.error("گرفتن پشتیبان ناموفق بود");
      }
    });
  };

  const deleteBackup = (filename: string) => {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/backups/${encodeURIComponent(filename)}`, {
          method: "DELETE",
        });
        const result = (await response.json()) as { error?: string };
        if (!response.ok) {
          toast.error(result.error ?? "حذف پشتیبان ناموفق بود");
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
            فایل ZIP پشتیبان روی خود سرور ذخیره می‌شود. هر روز ساعت ۱۲ (زمان سرور) به‌صورت خودکار
            گرفته می‌شود؛ می‌توانید دستی هم بگیرید و از همین صفحه دانلود کنید.
          </p>
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
