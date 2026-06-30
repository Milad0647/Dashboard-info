"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PersianDateInput } from "@/components/ui/persian-date-input";
import {
  appendPeriodFilesToFormData,
  BillboardDisplayPeriodsEditor,
  buildPeriodsFormPayload,
  type DisplayPeriodDraft,
} from "@/components/admin/billboard-display-periods-editor";
import type { ExternalBillboard } from "@/lib/models/billboard-api";

interface BillboardAdminAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  externalCampaignId: string;
  onAssigned?: () => void;
}

export function BillboardAdminAssignmentDialog({
  open,
  onOpenChange,
  campaignId,
  externalCampaignId,
  onAssigned,
}: BillboardAdminAssignmentDialogProps) {
  const [billboards, setBillboards] = useState<ExternalBillboard[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [billboardId, setBillboardId] = useState("");
  const [displayStart, setDisplayStart] = useState("");
  const [displayEnd, setDisplayEnd] = useState("");
  const [notes, setNotes] = useState("");
  const [executionImage, setExecutionImage] = useState<File | null>(null);
  const [periods, setPeriods] = useState<DisplayPeriodDraft[]>([]);

  const loadBillboards = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/billboard/available?campaignId=${encodeURIComponent(campaignId)}&externalCampaignId=${encodeURIComponent(externalCampaignId)}`
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error ?? "دریافت بیلبوردها ناموفق بود");
      }
      setBillboards(result.billboards ?? []);
      setBillboardId((current) => current || result.billboards?.[0]?.id || "");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "دریافت بیلبوردها ناموفق بود");
      setBillboards([]);
    } finally {
      setLoading(false);
    }
  }, [campaignId, externalCampaignId]);

  useEffect(() => {
    if (!open) return;
    void loadBillboards();
  }, [open, loadBillboards]);

  const resetForm = () => {
    setBillboardId("");
    setDisplayStart("");
    setDisplayEnd("");
    setNotes("");
    setExecutionImage(null);
    setPeriods([]);
  };

  const handleSubmit = () => {
    if (!billboardId) {
      toast.error("بیلبورد را انتخاب کنید");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.append("campaignId", campaignId);
      formData.append("externalCampaignId", externalCampaignId);
      formData.append("billboard_id", billboardId);
      if (displayStart) formData.append("display_start", displayStart);
      if (displayEnd) formData.append("display_end", displayEnd);
      if (notes.trim()) formData.append("notes", notes.trim());
      if (executionImage) formData.append("execution_image", executionImage);
      if (periods.length > 0) {
        formData.append("periods", JSON.stringify(buildPeriodsFormPayload(periods)));
        appendPeriodFilesToFormData(formData, periods);
      }

      const response = await fetch("/api/billboard/assign", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      if (!response.ok) {
        toast.error(result.error ?? "اتصال بیلبورد ناموفق بود");
        return;
      }

      toast.success("بیلبورد به کمپین وصل شد");
      resetForm();
      onOpenChange(false);
      onAssigned?.();
    });
  };

  const selectedBillboard = billboards.find((item) => item.id === billboardId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>اتصال بیلبورد موجود به کمپین</DialogTitle>
          <p className="text-sm text-muted-foreground">
            بیلبورد را از سامانه map-bilboard انتخاب کنید و به کمپین متصل کنید.
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>بیلبورد *</Label>
            <Select value={billboardId} onValueChange={setBillboardId} disabled={loading || billboards.length === 0}>
              <SelectTrigger>
                <SelectValue placeholder={loading ? "در حال بارگذاری..." : "انتخاب بیلبورد"} />
              </SelectTrigger>
              <SelectContent>
                {billboards.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.code} — {item.axis}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedBillboard && (
              <p className="text-xs text-muted-foreground line-clamp-2">{selectedBillboard.address}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>شروع نمایش کلی</Label>
              <PersianDateInput value={displayStart} onChange={setDisplayStart} />
            </div>
            <div className="space-y-2">
              <Label>پایان نمایش کلی</Label>
              <PersianDateInput value={displayEnd} onChange={setDisplayEnd} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>یادداشت داخلی</Label>
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
          </div>

          <div className="space-y-2">
            <Label>تصویر تأییدیه اجرا</Label>
            <Input
              type="file"
              accept="image/*"
              onChange={(event) => setExecutionImage(event.target.files?.[0] ?? null)}
            />
          </div>

          <BillboardDisplayPeriodsEditor periods={periods} onChange={setPeriods} />

          <Button type="button" className="w-full" disabled={isPending || loading} onClick={handleSubmit}>
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                در حال ثبت...
              </>
            ) : (
              "اتصال به کمپین"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
