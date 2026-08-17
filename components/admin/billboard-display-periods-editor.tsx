"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImageFileDropzone } from "@/components/ui/image-file-dropzone";
import { PersianDateInput } from "@/components/ui/persian-date-input";
import { isUsableBillboardImageUrl } from "@/lib/billboard-media";
import { todayISO } from "@/lib/jalali";
import { cn } from "@/lib/utils";

export interface DisplayPeriodDraft {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  imageFile: File | null;
  billboardImageFile: File | null;
  existingBillboardImageUrl?: string | null;
  existingConfirmationImageUrl?: string | null;
}

interface BillboardDisplayPeriodsEditorProps {
  periods: DisplayPeriodDraft[];
  onChange: (periods: DisplayPeriodDraft[]) => void;
  singlePeriod?: boolean;
  requireBillboardImage?: boolean;
  requireConfirmationImage?: boolean;
  highlightMedia?: boolean;
}

export function createDisplayPeriod(): DisplayPeriodDraft {
  const today = todayISO();
  return {
    id: crypto.randomUUID(),
    title: "",
    startDate: today,
    endDate: today,
    imageFile: null,
    billboardImageFile: null,
  };
}

export function BillboardDisplayPeriodsEditor({
  periods,
  onChange,
  singlePeriod = false,
  requireBillboardImage = false,
  requireConfirmationImage = false,
  highlightMedia = false,
}: BillboardDisplayPeriodsEditorProps) {
  const updatePeriod = (id: string, patch: Partial<DisplayPeriodDraft>) => {
    onChange(periods.map((period) => (period.id === id ? { ...period, ...patch } : period)));
  };

  const addPeriod = () => {
    onChange([...periods, createDisplayPeriod()]);
  };

  const removePeriod = (id: string) => {
    if (periods.length <= 1) return;
    onChange(periods.filter((period) => period.id !== id));
  };

  const visiblePeriods = singlePeriod ? periods.slice(0, 1) : periods;

  return (
    <div
      className={cn(
        "space-y-4",
        highlightMedia && "rounded-lg border border-destructive bg-destructive/5 p-3"
      )}
    >
      <div>
        <Label className={cn("text-sm font-semibold", highlightMedia && "text-destructive")}>
          دوره نمایش *
        </Label>
        <p className="text-xs text-muted-foreground">
          عکس بیلبورد و تصویر تأییدیه اختیاری هستند؛ بدون عکس هم می‌توانید ثبت کنید.
        </p>
        {highlightMedia && (
          <p className="mt-1 text-xs text-muted-foreground">
            اگر عکس دارید اضافه کنید؛ بدون عکس هم ذخیره می‌شود.
          </p>
        )}
      </div>

      {visiblePeriods.map((period, index) => (
        <div key={period.id} className="space-y-3 rounded-lg border p-4">
          <div className="flex items-center justify-between gap-2">
            {!singlePeriod ? (
              <p className="text-sm font-medium">دوره {index + 1}</p>
            ) : (
              <p className="text-sm font-medium">دوره نمایش</p>
            )}
            {!singlePeriod && periods.length > 1 && (
              <Button type="button" variant="ghost" size="icon" onClick={() => removePeriod(period.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>

          <div className="space-y-2">
            <Label>عنوان (اختیاری)</Label>
            <Input
              value={period.title}
              onChange={(event) => updatePeriod(period.id, { title: event.target.value })}
              placeholder="مثلاً فاز اول"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>شروع نمایش *</Label>
              <PersianDateInput
                value={period.startDate}
                onChange={(startDate) => updatePeriod(period.id, { startDate })}
              />
            </div>
            <div className="space-y-2">
              <Label>پایان نمایش *</Label>
              <PersianDateInput
                value={period.endDate}
                onChange={(endDate) => updatePeriod(period.id, { endDate })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <ImageFileDropzone
                label="عکس بیلبورد"
                required={
                  requireBillboardImage && !isUsableBillboardImageUrl(period.existingBillboardImageUrl)
                }
                optionalHint={requireBillboardImage ? undefined : "اختیاری"}
                value={period.billboardImageFile}
                onChange={(file) => updatePeriod(period.id, { billboardImageFile: file })}
              />
              {!period.billboardImageFile &&
                isUsableBillboardImageUrl(period.existingBillboardImageUrl) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={period.existingBillboardImageUrl ?? ""}
                  alt="عکس فعلی"
                  className="h-24 w-full rounded-md border object-cover"
                />
              )}
            </div>
            <div className="space-y-2">
              <ImageFileDropzone
                label="تصویر تأییدیه"
                required={requireConfirmationImage}
                optionalHint={requireConfirmationImage ? undefined : "اختیاری"}
                value={period.imageFile}
                onChange={(file) => updatePeriod(period.id, { imageFile: file })}
              />
              {!period.imageFile && period.existingConfirmationImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={period.existingConfirmationImageUrl}
                  alt="تأییدیه فعلی"
                  className="h-24 w-full rounded-md border object-cover"
                />
              )}
            </div>
          </div>
        </div>
      ))}

      {!singlePeriod && (
        <Button type="button" variant="outline" className="w-full" onClick={addPeriod}>
          <Plus className="h-4 w-4" />
          افزودن دوره
        </Button>
      )}
    </div>
  );
}

export function buildPeriodsFormPayload(periods: DisplayPeriodDraft[]) {
  return periods.map((period, index) => ({
    id: period.id,
    title: period.title || undefined,
    startDate: period.startDate,
    endDate: period.endDate,
    sortOrder: index,
    imageKey: `period_image_${period.id}`,
    billboardImageKey: `period_billboard_image_${period.id}`,
    billboardImageUrl: period.billboardImageFile
      ? undefined
      : isUsableBillboardImageUrl(period.existingBillboardImageUrl)
        ? period.existingBillboardImageUrl ?? undefined
        : undefined,
    confirmationImageUrl: period.imageFile ? undefined : period.existingConfirmationImageUrl ?? undefined,
  }));
}

export function appendPeriodFilesToFormData(formData: FormData, periods: DisplayPeriodDraft[]) {
  for (const period of periods) {
    if (period.imageFile) {
      formData.append(`period_image_${period.id}`, period.imageFile);
    }
    if (period.billboardImageFile) {
      formData.append(`period_billboard_image_${period.id}`, period.billboardImageFile);
    }
  }
}
