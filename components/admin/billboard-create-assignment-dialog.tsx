"use client";

import { useEffect, useState, useTransition } from "react";
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
import { BillboardLocationMapPicker } from "@/components/admin/billboard-location-map-picker";
import { ProvinceCityFields } from "@/components/admin/province-city-fields";
import {
  appendPeriodFilesToFormData,
  BillboardDisplayPeriodsEditor,
  buildPeriodsFormPayload,
  createDisplayPeriod,
  type DisplayPeriodDraft,
} from "@/components/admin/billboard-display-periods-editor";
import { getLocationCenter, resolveLocationNames } from "@/lib/iran-location-center";

interface ContributorProfile {
  province?: string | null;
  city?: string | null;
  email: string;
  name: string;
}

interface BillboardCreateAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  mode: "admin" | "client";
  contributorProfile?: ContributorProfile | null;
  onCreated?: () => void;
}

export function BillboardCreateAssignmentDialog({
  open,
  onOpenChange,
  campaignId,
  mode,
  contributorProfile = null,
  onCreated,
}: BillboardCreateAssignmentDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [axis, setAxis] = useState("");
  const [areaSqm, setAreaSqm] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [coords, setCoords] = useState({ latitude: 35.6892, longitude: 51.389 });
  const [mapCenter, setMapCenter] = useState<{
    lat: number;
    lng: number;
    revision?: number;
  } | null>(null);
  const [periods, setPeriods] = useState<DisplayPeriodDraft[]>([createDisplayPeriod()]);

  useEffect(() => {
    if (!open) return;

    const profileProvince = contributorProfile?.province ?? "";
    const profileCity = contributorProfile?.city ?? "";
    const resolved = resolveLocationNames(profileProvince, profileCity);
    const center = getLocationCenter(resolved.province, resolved.city);

    setProvince(resolved.province);
    setCity(resolved.city);
    setAxis("");
    setAreaSqm("");
    setAddress("");
    setNotes("");
    setCoords({ latitude: center.lat, longitude: center.lng });
    setMapCenter({ lat: center.lat, lng: center.lng, revision: Date.now() });
    setPeriods([createDisplayPeriod()]);
  }, [open, contributorProfile]);

  const handleLocationCenterChange = (center: { lat: number; lng: number }) => {
    setMapCenter({ lat: center.lat, lng: center.lng, revision: Date.now() });
    setCoords({ latitude: center.lat, longitude: center.lng });
  };

  const handleSubmit = () => {
    if (axis.trim().length < 2) {
      toast.error("محور باید حداقل ۲ کاراکتر باشد");
      return;
    }

    const period = periods[0];
    if (!period?.startDate || !period.endDate) {
      toast.error("تاریخ شروع و پایان دوره نمایش الزامی است");
      return;
    }
    if (!period.billboardImageFile) {
      toast.error("عکس بیلبورد در دوره نمایش الزامی است");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.append("campaignId", campaignId);
      formData.append("axis", axis.trim());
      formData.append("address", address.trim());
      formData.append("area_sqm", areaSqm.trim());
      formData.append("latitude", String(coords.latitude));
      formData.append("longitude", String(coords.longitude));

      const resolvedProvince =
        province || contributorProfile?.province?.trim() || "";
      const resolvedCity = city || contributorProfile?.city?.trim() || "";
      if (resolvedProvince) formData.append("province", resolvedProvince);
      if (resolvedCity) formData.append("city", resolvedCity);
      if (notes.trim()) formData.append("notes", notes.trim());
      if (period.imageFile) formData.append("execution_image", period.imageFile);

      const periodsToSubmit = [period];
      formData.append("periods", JSON.stringify(buildPeriodsFormPayload(periodsToSubmit)));
      appendPeriodFilesToFormData(formData, periodsToSubmit);

      const response = await fetch("/api/billboard/create", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      if (!response.ok) {
        toast.error(result.error ?? "ثبت بیلبورد ناموفق بود");
        return;
      }

      toast.success("بیلبورد جدید ثبت شد");
      onOpenChange(false);
      onCreated?.();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>ثبت بیلبورد جدید</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {contributorProfile?.province && contributorProfile?.city
              ? `استان و شهر از پروفایل ${contributorProfile.name} پر شده‌اند.`
              : "استان و شهر را انتخاب کنید تا نقشه به همان موقعیت برود."}
            {" "}یک دوره نمایش با عکس بیلبورد الزامی است.
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <ProvinceCityFields
            province={province}
            city={city}
            onProvinceChange={setProvince}
            onCityChange={setCity}
            onLocationCenterChange={handleLocationCenterChange}
          />

          <div className="space-y-2">
            <Label>محور / خیابان / بزرگراه *</Label>
            <Input value={axis} onChange={(event) => setAxis(event.target.value)} />
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
              mapCenter={mapCenter}
              onChange={setCoords}
            />
          </div>

          {mode === "admin" && (
            <div className="space-y-2">
              <Label>یادداشت داخلی</Label>
              <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} />
            </div>
          )}

          <BillboardDisplayPeriodsEditor
            periods={periods}
            onChange={setPeriods}
            singlePeriod
            requireBillboardImage
          />

          <Button type="button" className="w-full" disabled={isPending} onClick={handleSubmit}>
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                در حال ثبت...
              </>
            ) : (
              "ثبت بیلبورد"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
