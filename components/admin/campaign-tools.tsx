"use client";

import { useRef, useTransition } from "react";
import { Camera, FileArchive, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminCampaign } from "@/components/admin/admin-campaign-provider";

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
    startTransition(async () => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("campaignId", campaignId);

      const response = await fetch("/api/campaign/import", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      if (!response.ok) {
        toast.error(result.error ?? "خطا در import");
        return;
      }

      toast.success("کمپین با موفقیت import شد");
      window.location.reload();
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
          دانلود ZIP پشتیبان
        </Button>

        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => importRef.current?.click()}
        >
          <Upload className="h-4 w-4" />
          Import از ZIP
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
