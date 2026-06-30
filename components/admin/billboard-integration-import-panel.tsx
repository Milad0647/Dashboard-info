"use client";

import { useState, useTransition } from "react";
import { CloudDownload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Billboard } from "@/lib/types";

interface BillboardIntegrationImportPanelProps {
  campaignId: string;
  externalCampaignSlug?: string | null;
  existingBillboards: Billboard[];
  onImported?: () => void;
}

export function BillboardIntegrationImportPanel({
  campaignId,
  externalCampaignSlug,
  existingBillboards,
  onImported,
}: BillboardIntegrationImportPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [lastResult, setLastResult] = useState<string | null>(null);

  const handleImport = () => {
    if (!externalCampaignSlug) {
      toast.error("ابتدا اسلاگ کمپین map-bilboard را در تنظیمات کمپین تنظیم کنید");
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/billboard/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, existingBillboards }),
      });

      const result = await response.json();
      if (!response.ok) {
        toast.error(result.error ?? "واردات از API ناموفق بود");
        return;
      }

      const summary = [
        `${result.imported} بیلبورد وارد شد`,
        result.matchedUsers ? `${result.matchedUsers} مورد به کاربران متصل شد` : null,
        result.skipped ? `${result.skipped} مورد تکراری رد شد` : null,
        result.skippedAdmin ? `${result.skippedAdmin} مورد ثبت‌شده توسط ادمین نادیده گرفته شد` : null,
        result.unmatchedOwners?.length
          ? `${result.unmatchedOwners.length} مالک بدون کاربر متناظر`
          : null,
      ]
        .filter(Boolean)
        .join(" — ");

      setLastResult(summary);
      toast.success("واردات از API انجام شد");
      onImported?.();
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">واردات بیلبورد از API integration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          بیلبوردها از endpoint integration دریافت می‌شوند. تطابق کاربر با{" "}
          <code className="text-xs">owner.username</code> /{" "}
          <code className="text-xs">owner.email</code> انجام می‌شود. بیلبوردهای ثبت‌شده توسط
          ادمین (<code className="text-xs">owner: null</code>) وارد نمی‌شوند.
          {externalCampaignSlug ? (
            <>
              {" "}
              اسلاگ فعلی: <span className="font-medium text-foreground">{externalCampaignSlug}</span>
            </>
          ) : null}
        </p>

        <Button variant="outline" disabled={isPending || !externalCampaignSlug} onClick={handleImport}>
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CloudDownload className="h-4 w-4" />
          )}
          دریافت و واردات از API
        </Button>

        {lastResult && (
          <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
            {lastResult}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
