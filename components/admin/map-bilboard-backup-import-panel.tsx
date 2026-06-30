"use client";

import { useRef, useState, useTransition } from "react";
import { FileArchive, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface MapBilboardBackupImportPanelProps {
  campaignId: string;
  externalCampaignSlug?: string | null;
  onImported?: () => void;
}

export function MapBilboardBackupImportPanel({
  campaignId,
  externalCampaignSlug,
  onImported,
}: MapBilboardBackupImportPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [lastResult, setLastResult] = useState<string | null>(null);

  const handleUpload = (file: File) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("campaignId", campaignId);

      const response = await fetch("/api/billboard/restore", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      if (!response.ok) {
        toast.error(result.error ?? "ورود پشتیبان ناموفق بود");
        return;
      }

      const summary = [
        `${result.imported} بیلبورد به کمپین وصل شد`,
        result.matchedUsers ? `${result.matchedUsers} مورد به کاربران متصل شد` : null,
        result.forwarded ? "پشتیبان به سرویس بیلبورد هم ارسال شد" : null,
        result.forwardError ? `ارسال به سرویس بیلبورد: ${result.forwardError}` : null,
        result.unmatchedProviders?.length
          ? `${result.unmatchedProviders.length} شرکت بدون کاربر متناظر`
          : null,
      ]
        .filter(Boolean)
        .join(" — ");

      setLastResult(summary);
      toast.success("ورود پشتیبان انجام شد");
      onImported?.();
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">ورود پشتیبان map-bilboard</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          فایل ZIP خروجی map-bilboard را آپلود کنید. بیلبوردهای ثبت‌شده در کمپین
          {externalCampaignSlug ? ` «${externalCampaignSlug}»` : ""} وارد می‌شوند و در صورت تطابق نام
          شرکت با کاربران، به حساب همان کاربر وصل می‌شوند.
        </p>

        <Button
          variant="outline"
          disabled={isPending}
          onClick={() => inputRef.current?.click()}
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          آپلود ZIP پشتیبان
        </Button>

        <input
          ref={inputRef}
          type="file"
          accept=".zip,application/zip"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) handleUpload(file);
            event.target.value = "";
          }}
        />

        {lastResult && (
          <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
            <div className="mb-1 flex items-center gap-2 font-medium text-foreground">
              <FileArchive className="h-4 w-4" />
              نتیجه آخرین ورود
            </div>
            {lastResult}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
