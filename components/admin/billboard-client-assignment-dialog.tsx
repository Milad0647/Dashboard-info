"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { BillboardLocationMapPicker } from "@/components/admin/billboard-location-map-picker";
import {
  appendPeriodFilesToFormData,
  BillboardDisplayPeriodsEditor,
  buildPeriodsFormPayload,
  type DisplayPeriodDraft,
} from "@/components/admin/billboard-display-periods-editor";
import { getCityCoordinates } from "@/lib/iran-city-coordinates";
import { getCitiesForProvince, IRAN_PROVINCES } from "@/lib/iran-locations";
import { todayISO } from "@/lib/jalali";

interface ContributorProfile {
  province?: string | null;
  city?: string | null;
  email: string;
  name: string;
}

interface BillboardClientAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  externalCampaignId: string;
  contributorProfile: ContributorProfile;
  onAssigned?: () => void;
}

function createInitialPeriod(): DisplayPeriodDraft {
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

export function BillboardClientAssignmentDialog({
  open,
  onOpenChange,
  campaignId,
  externalCampaignId,
  contributorProfile,
  onAssigned,
}: BillboardClientAssignmentDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [province, setProvince] = useState(contributorProfile.province ?? "");
  const [city, setCity] = useState(contributorProfile.city ?? "");
  const [axis, setAxis] = useState("");
  const [areaSqm, setAreaSqm] = useState("");
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState(() => {
    const [latitude, longitude] = getCityCoordinates(contributorProfile.city);
    return { latitude, longitude };
  });
  const [periods, setPeriods] = useState<DisplayPeriodDraft[]>([createInitialPeriod()]);

  useEffect(() => {
    if (!open) return;
    setProvince(contributorProfile.province ?? "");
    setCity(contributorProfile.city ?? "");
    setAxis("");
    setAreaSqm("");
    setAddress("");
    const [latitude, longitude] = getCityCoordinates(contributorProfile.city);
    setCoords({ latitude, longitude });
    setPeriods([createInitialPeriod()]);
  }, [open, contributorProfile]);

  const cities = province ? getCitiesForProvince(province) : [];

  const handleSubmit = () => {
    if (axis.trim().length < 2) {
      toast.error("محور باید حداقل ۲ کاراکتر باشد");
      return;
    }
    if (periods.length === 0) {
      toast.error("حداقل یک دوره نمایش الزامی است");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.append("campaignId", campaignId);
      formData.append("externalCampaignId", externalCampaignId);
      formData.append("axis", axis.trim());
      formData.append("address", address.trim());
      formData.append("area_sqm", areaSqm.trim());
      formData.append("latitude", String(coords.latitude));
      formData.append("longitude", String(coords.longitude));
      formData.append("periods", JSON.stringify(buildPeriodsFormPayload(periods)));
      appendPeriodFilesToFormData(formData, periods);

      const response = await fetch("/api/billboard/client-assign", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      if (!response.ok) {
        toast.error(result.error ?? "ثبت بیلبورد ناموفق بود");
        return;
      }

      toast.success("بیلبورد جدید ثبت و به کمپین وصل شد");
      onOpenChange(false);
      onAssigned?.();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>ثبت بیلبورد جدید</DialogTitle>
          <p className="text-sm text-muted-foreground">
            بیلبورد جدید در map-bilboard ساخته می‌شود و به کمپین متصل می‌گردد. استان و شهر از پروفایل شما
            ({contributorProfile.name}) ارسال می‌شود.
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>استان</Label>
              <Select value={province} onValueChange={setProvince}>
                <SelectTrigger>
                  <SelectValue placeholder="استان" />
                </SelectTrigger>
                <SelectContent>
                  {IRAN_PROVINCES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>شهر</Label>
              <Select value={city} onValueChange={setCity} disabled={!province}>
                <SelectTrigger>
                  <SelectValue placeholder={province ? "شهر" : "ابتدا استان را انتخاب کنید"} />
                </SelectTrigger>
                <SelectContent>
                  {cities.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>محور / خیابان / بزرگراه *</Label>
            <Input value={axis} onChange={(event) => setAxis(event.target.value)} placeholder="مثلاً بزرگراه همت" />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>متراژ (متر مربع)</Label>
              <Input
                type="number"
                min="0"
                step="0.1"
                value={areaSqm}
                onChange={(event) => setAreaSqm(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>آدرس توصیفی</Label>
              <Input value={address} onChange={(event) => setAddress(event.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>موقعیت روی نقشه *</Label>
            <BillboardLocationMapPicker
              latitude={coords.latitude}
              longitude={coords.longitude}
              city={city}
              onChange={setCoords}
            />
          </div>

          <BillboardDisplayPeriodsEditor periods={periods} onChange={setPeriods} requireImages />

          <Button type="button" className="w-full" disabled={isPending} onClick={handleSubmit}>
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                در حال ثبت...
              </>
            ) : (
              "ثبت و اتصال به کمپین"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
