"use client";

import Link from "next/link";
import { useRef, useTransition } from "react";
import { Archive, Camera, FileArchive, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminCampaign } from "@/components/admin/admin-campaign-provider";
import { startAndWaitForBackup } from "@/lib/client/backup-job";
import { adminHref } from "@/lib/utils";

interface CampaignToolsProps {
  isFullAdmin: boolean;
}

export function CampaignTools({ isFullAdmin }: CampaignToolsProps) {
  const { campaignId, currentCampaign } = useAdminCampaign();
  const [isPending, startTransition] = useTransition();
  const importRef = useRef<HTMLInputElement>(null);

  const download = (url: string, fallbackName: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = fallbackName;
    link.click();
  };

  const handleImport = (file: File) => {
    if (!campaignId) {
      toast.error("کمپینی انتخاب نشده است");
      return;
    }
    const ok = window.confirm(
      "هشدار: همه داده‌های فعلی این کمپین پاک می‌شود و کامل با بکاپ جایگزین می‌گردد. ادامه می‌دهید؟"
    );
    if (!ok) return;

    startTransition(async () => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("campaignId", campaignId);
      formData.append("mode", "full");

      const response = await fetch("/api/backups/restore", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      if (!response.ok) {
        toast.error(result.error ?? "خطا در بازیابی");
        return;
      }

      toast.success("بازیابی کامل انجام شد");
      window.location.reload();
    });
  };

  const createStoredBackup = () => {
    if (!campaignId) {
      toast.error("کمپینی انتخاب نشده است");
      return;
    }

    startTransition(async () => {
      try {
        toast.message("بکاپ در پس‌زمینه شروع شد…", {
          description: "برای حجم زیاد ممکن است چند دقیقه طول بکشد.",
        });
        const job = await startAndWaitForBackup({
          campaignId,
          includeUploads: true,
        });
        if (job.warning) toast.warning(job.warning);
        toast.success("پشتیبان روی سرور ذخیره شد — از صفحه پشتیبان‌گیری دانلود کنید");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "گرفتن پشتیبان ناموفق بود");
      }
    });
  };

  // Backup + full report export are admin-only
  if (!isFullAdmin || !currentCampaign) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">خروجی و پشتیبان‌گیری</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => {
            window.open(
              `/campaign/${currentCampaign.slug}?export=screenshot`,
              "_blank",
              "noopener,noreferrer"
            );
          }}
        >
          <Camera className="h-4 w-4" />
          دانلود PDF گزارش کامل
        </Button>

        <Button variant="outline" size="sm" disabled={isPending} onClick={createStoredBackup}>
          <Archive className="h-4 w-4" />
          گرفتن پشتیبان روی سرور
        </Button>

        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() =>
            download(
              `/api/campaign/backup?campaignId=${encodeURIComponent(campaignId)}`,
              `backup-${currentCampaign.slug}.zip`
            )
          }
        >
          <FileArchive className="h-4 w-4" />
          دانلود فوری ZIP
        </Button>

        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => importRef.current?.click()}
        >
          <Upload className="h-4 w-4" />
          بازیابی کامل از ZIP
        </Button>

        <Button variant="outline" size="sm" asChild>
          <Link href={adminHref("/admin/backups", campaignId)}>
            <Archive className="h-4 w-4" />
            مدیریت پشتیبان‌ها
          </Link>
        </Button>

        <input
          ref={importRef}
          type="file"
          accept=".zip,application/zip"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) handleImport(file);
            event.target.value = "";
          }}
        />

        <Button variant="ghost" size="sm" asChild>
          <a href={`/campaign/${currentCampaign.slug}`} target="_blank" rel="noreferrer">
            مشاهده گزارش زنده
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
