"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImageFileDropzone } from "@/components/ui/image-file-dropzone";
import { PersianDateInput } from "@/components/ui/persian-date-input";
import { todayISO } from "@/lib/jalali";

export interface DisplayPeriodDraft {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  imageFile: File | null;
  billboardImageFile: File | null;
}

interface BillboardDisplayPeriodsEditorProps {
  periods: DisplayPeriodDraft[];
  onChange: (periods: DisplayPeriodDraft[]) => void;
  requireImages?: boolean;
}

function createPeriod(): DisplayPeriodDraft {
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
  requireImages = false,
}: BillboardDisplayPeriodsEditorProps) {
  const updatePeriod = (id: string, patch: Partial<DisplayPeriodDraft>) => {
    onChange(periods.map((period) => (period.id === id ? { ...period, ...patch } : period)));
  };

  const removePeriod = (id: string) => {
    onChange(periods.filter((period) => period.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label className="text-sm font-semibold">دوره‌های نمایش</Label>
          <p className="text-xs text-muted-foreground">
            {requireImages
              ? "حداقل یک دوره با عکس بیلبورد و تصویر تأییدیه الزامی است."
              : "اختیاری — برای هر دوره می‌توانید تصویر جداگانه ثبت کنید."}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...periods, createPeriod()])}
        >
          <Plus className="h-4 w-4" />
          افزودن دوره
        </Button>
      </div>

      {periods.length === 0 ? (
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          هنوز دوره‌ای اضافه نشده است.
        </div>
      ) : (
        periods.map((period, index) => (
          <div key={period.id} className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">دوره {index + 1}</p>
              <Button type="button" variant="ghost" size="icon" onClick={() => removePeriod(period.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
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
                <Label>شروع نمایش</Label>
                <PersianDateInput
                  value={period.startDate}
                  onChange={(startDate) => updatePeriod(period.id, { startDate })}
                />
              </div>
              <div className="space-y-2">
                <Label>پایان نمایش</Label>
                <PersianDateInput
                  value={period.endDate}
                  onChange={(endDate) => updatePeriod(period.id, { endDate })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ImageFileDropzone
                label="عکس بیلبورد"
                required={requireImages}
                value={period.billboardImageFile}
                onChange={(file) => updatePeriod(period.id, { billboardImageFile: file })}
              />
              <ImageFileDropzone
                label="تصویر تأییدیه"
                required={requireImages}
                optionalHint={requireImages ? undefined : "اختیاری"}
                value={period.imageFile}
                onChange={(file) => updatePeriod(period.id, { imageFile: file })}
              />
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export function buildPeriodsFormPayload(periods: DisplayPeriodDraft[]) {
  return periods.map((period, index) => ({
    title: period.title || undefined,
    startDate: period.startDate,
    endDate: period.endDate,
    sortOrder: index,
    imageKey: `period_image_${period.id}`,
    billboardImageKey: `period_billboard_image_${period.id}`,
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
