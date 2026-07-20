"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PlanLabelSelect } from "@/components/admin/plan-label-select";
import { ContentOwnerSelect } from "@/components/admin/content-owner-select";
import { ContentScoreControl } from "@/components/admin/content-score-control";
import { BillboardLocationMapPicker } from "@/components/admin/billboard-location-map-picker";
import { ProvinceCityFields } from "@/components/admin/province-city-fields";
import {
  appendPeriodFilesToFormData,
  BillboardDisplayPeriodsEditor,
  buildPeriodsFormPayload,
  createDisplayPeriod,
  type DisplayPeriodDraft,
} from "@/components/admin/billboard-display-periods-editor";
import {
  BILLBOARD_CATEGORIES,
  billboardCategoryLabels,
  matchBillboardCategoryKey,
  type BillboardCategory,
} from "@/lib/billboard-categories";
import {
  parseAddressFromBillboard,
  parseAreaSqmFromBillboard,
  parseProvinceFromBillboard,
} from "@/lib/billboard-form-utils";
import { normalizePlanLabels, type ContentTopic } from "@/lib/content-topics";
import {
  isDefaultBillboardTitle,
  isPlaceholderBillboardImage,
  type EditSuggestionMissingField,
} from "@/lib/edit-suggestions";
import { getLocationCenter, resolveLocationNames } from "@/lib/iran-location-center";
import type { AdminUser, Billboard, BillboardDisplayPeriod } from "@/lib/types";
import { cn } from "@/lib/utils";

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
  contentPlans?: string[];
  contentTopics?: ContentTopic[];
  canScore?: boolean;
  canTransferOwnership?: boolean;
  users?: AdminUser[];
  mode: "admin" | "client";
  contributorProfile?: ContributorProfile | null;
  editingBillboard?: Billboard | null;
  highlightFields?: EditSuggestionMissingField[];
  onCreated?: () => void;
}

function periodsToDrafts(periods: BillboardDisplayPeriod[]): DisplayPeriodDraft[] {
  if (periods.length === 0) return [createDisplayPeriod()];

  return periods.map((period) => ({
    id: period.id,
    title: period.title ?? "",
    startDate: period.startDate,
    endDate: period.endDate,
    imageFile: null,
    billboardImageFile: null,
    existingBillboardImageUrl: period.billboardImageUrl,
    existingConfirmationImageUrl: period.confirmationImageUrl ?? null,
  }));
}

function fallbackDraftFromBillboard(billboard: Billboard): DisplayPeriodDraft[] {
  return [
    {
      id: crypto.randomUUID(),
      title: "",
      startDate: billboard.date,
      endDate: billboard.date,
      imageFile: null,
      billboardImageFile: null,
      existingBillboardImageUrl: billboard.thumbnailUrl,
      existingConfirmationImageUrl: null,
    },
  ];
}

export function BillboardCreateAssignmentDialog({
  open,
  onOpenChange,
  campaignId,
  contentPlans = [],
  contentTopics = [],
  canScore = false,
  canTransferOwnership = false,
  users = [],
  mode,
  contributorProfile = null,
  editingBillboard = null,
  highlightFields = [],
  onCreated,
}: BillboardCreateAssignmentDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [category, setCategory] = useState<BillboardCategory>("billboard");
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
  const [planLabels, setPlanLabels] = useState<string[]>([]);
  const [editScore, setEditScore] = useState<number | null | undefined>(null);
  const [editOwnerUserId, setEditOwnerUserId] = useState<string | null>(null);

  const isEditing = Boolean(editingBillboard);

  const hasPeriodMedia = periods.some(
    (period) =>
      Boolean(period.billboardImageFile) ||
      Boolean(period.existingBillboardImageUrl?.trim() && !isPlaceholderBillboardImage(period.existingBillboardImageUrl))
  );
  const highlightTitle =
    highlightFields.includes("title") &&
    (!axis.trim() || isDefaultBillboardTitle(axis));
  const highlightCity = highlightFields.includes("city") && !city.trim();
  const highlightLocation = highlightFields.includes("location") && !address.trim();
  const highlightDescription = highlightFields.includes("description") && !address.trim();
  const highlightMedia = highlightFields.includes("media") && !hasPeriodMedia;

  useEffect(() => {
    if (!open) return;

    const loadForm = async () => {
      if (editingBillboard) {
        const resolvedProvince = parseProvinceFromBillboard(editingBillboard);
        const resolvedCity = editingBillboard.city;
        const center = getLocationCenter(resolvedProvince, resolvedCity);

        setProvince(resolvedProvince);
        setCity(resolvedCity);
        setCategory(matchBillboardCategoryKey(editingBillboard.category) ?? "billboard");
        setAxis(editingBillboard.title);
        setAreaSqm(parseAreaSqmFromBillboard(editingBillboard));
        setAddress(parseAddressFromBillboard(editingBillboard));
        setNotes(editingBillboard.notes ?? "");
        setPlanLabels(normalizePlanLabels(editingBillboard.planLabels, editingBillboard.planLabel));
        setEditScore(editingBillboard.score);
        setEditOwnerUserId(editingBillboard.ownerUserId ?? null);
        setCoords({
          latitude: editingBillboard.latitude ?? center.lat,
          longitude: editingBillboard.longitude ?? center.lng,
        });
        setMapCenter({
          lat: editingBillboard.latitude ?? center.lat,
          lng: editingBillboard.longitude ?? center.lng,
          revision: Date.now(),
        });

        try {
          const response = await fetch(
            `/api/billboard/periods?billboardId=${encodeURIComponent(editingBillboard.id)}`
          );
          const data = (await response.json()) as { periods?: BillboardDisplayPeriod[] };
          setPeriods(
            data.periods && data.periods.length > 0
              ? periodsToDrafts(data.periods)
              : fallbackDraftFromBillboard(editingBillboard)
          );
        } catch {
          setPeriods(fallbackDraftFromBillboard(editingBillboard));
        }
        return;
      }

      const profileProvince = contributorProfile?.province ?? "";
      const profileCity = contributorProfile?.city ?? "";
      const resolved = resolveLocationNames(profileProvince, profileCity);
      const center = getLocationCenter(resolved.province, resolved.city);

      setProvince(resolved.province);
      setCity(resolved.city);
      setCategory("billboard");
      setAxis("");
      setAreaSqm("");
      setAddress("");
      setNotes("");
      setPlanLabels([]);
      setEditScore(null);
      setEditOwnerUserId(null);
      setCoords({ latitude: center.lat, longitude: center.lng });
      setMapCenter({ lat: center.lat, lng: center.lng, revision: Date.now() });
      setPeriods([createDisplayPeriod()]);
    };

    void loadForm();
  }, [open, contributorProfile, editingBillboard]);

  const handleLocationCenterChange = (center: { lat: number; lng: number }) => {
    setMapCenter({ lat: center.lat, lng: center.lng, revision: Date.now() });
    setCoords({ latitude: center.lat, longitude: center.lng });
  };

  const handleSubmit = () => {
    if (axis.trim().length < 2) {
      toast.error("محور باید حداقل ۲ کاراکتر باشد");
      return;
    }
    if (planLabels.length === 0) {
      toast.error("انتخاب موضوع الزامی است");
      return;
    }

    for (const [index, period] of periods.entries()) {
      if (!period.startDate || !period.endDate) {
        toast.error(`تاریخ دوره ${index + 1} الزامی است`);
        return;
      }
      const hasBillboardImage =
        Boolean(period.billboardImageFile) || Boolean(period.existingBillboardImageUrl?.trim());
      if (!hasBillboardImage) {
        toast.error(`عکس بیلبورد در دوره ${index + 1} الزامی است`);
        return;
      }
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.append("campaignId", campaignId);
      if (editingBillboard?.id) formData.append("billboardId", editingBillboard.id);
      formData.append("category", category);
      formData.append("axis", axis.trim());
      formData.append("address", address.trim());
      formData.append("area_sqm", areaSqm.trim());
      formData.append("latitude", String(coords.latitude));
      formData.append("longitude", String(coords.longitude));

      const resolvedProvince = province || contributorProfile?.province?.trim() || "";
      const resolvedCity = city || contributorProfile?.city?.trim() || "";
      if (resolvedProvince) formData.append("province", resolvedProvince);
      if (resolvedCity) formData.append("city", resolvedCity);
      if (notes.trim()) formData.append("notes", notes.trim());
      formData.append("published", "true");
      formData.append("status", "published");
      for (const label of planLabels) {
        formData.append("planLabels", label);
      }
      if (planLabels[0]) formData.append("planLabel", planLabels[0]);
      if (canTransferOwnership && editOwnerUserId) {
        formData.append("ownerUserId", editOwnerUserId);
      }

      formData.append("periods", JSON.stringify(buildPeriodsFormPayload(periods)));
      appendPeriodFilesToFormData(formData, periods);

      const response = await fetch("/api/billboard/create", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      if (!response.ok) {
        toast.error(result.error ?? "ثبت تبلیغات محیطی ناموفق بود");
        return;
      }

      toast.success(isEditing ? "تبلیغات محیطی ویرایش شد" : "تبلیغات محیطی جدید ثبت شد");
      onOpenChange(false);
      onCreated?.();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "ویرایش تبلیغات محیطی" : "ثبت تبلیغات محیطی جدید"}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {contributorProfile?.province && contributorProfile?.city && !isEditing
              ? `استان و شهر از پروفایل ${contributorProfile.name} پر شده‌اند.`
              : "استان و شهر را انتخاب کنید تا نقشه به همان موقعیت برود."}
            {" "}می‌توانید چند دوره نمایش اضافه کنید.
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>دسته‌بندی *</Label>
            <Select value={category} onValueChange={(value) => setCategory(value as BillboardCategory)}>
              <SelectTrigger>
                <SelectValue placeholder="انتخاب دسته" />
              </SelectTrigger>
              <SelectContent>
                {BILLBOARD_CATEGORIES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {billboardCategoryLabels[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div
            className={cn(
              highlightCity && "rounded-lg border border-destructive bg-destructive/5 p-3"
            )}
          >
            <ProvinceCityFields
              province={province}
              city={city}
              onProvinceChange={setProvince}
              onCityChange={setCity}
              onLocationCenterChange={handleLocationCenterChange}
            />
            {highlightCity && (
              <p className="mt-2 text-xs text-destructive">شهر انتخاب نشده است؛ لطفاً تکمیل کنید.</p>
            )}
          </div>

          <div className="space-y-2">
            <Label className={cn(highlightTitle && "text-destructive")}>محور / خیابان / بزرگراه *</Label>
            <Input
              value={axis}
              onChange={(event) => setAxis(event.target.value)}
              className={cn(highlightTitle && "border-destructive focus-visible:ring-destructive")}
            />
            {highlightTitle && (
              <p className="text-xs text-destructive">عنوان پیش‌فرض یا خالی است؛ یک عنوان اختصاصی وارد کنید.</p>
            )}
          </div>

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
            <Label
              className={cn(
                highlightLocation && "text-destructive",
                !highlightLocation && highlightDescription && "text-amber-700 dark:text-amber-300"
              )}
            >
              توضیحات
            </Label>
            <Textarea
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              rows={2}
              placeholder="توضیحات یا آدرس توصیفی موقعیت (اختیاری)"
              className={cn(
                highlightLocation && "border-destructive focus-visible:ring-destructive",
                !highlightLocation &&
                  highlightDescription &&
                  "border-amber-500 focus-visible:ring-amber-500"
              )}
            />
            {highlightLocation && (
              <p className="text-xs text-destructive">آدرس/موقعیت خالی است؛ بهتر است تکمیل شود.</p>
            )}
            {highlightDescription && !highlightLocation && (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                توضیحات خالی است؛ بهتر است تکمیل شود.
              </p>
            )}
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

          <PlanLabelSelect
            topics={contentTopics}
            plans={contentPlans}
            values={planLabels}
            onChangeMultiple={setPlanLabels}
            optional={false}
          />

          {isEditing && editingBillboard && (
            <ContentScoreControl
              campaignId={campaignId}
              contentType="billboard"
              contentId={editingBillboard.id}
              score={editScore}
              autoScore={editingBillboard.autoScore}
              manualScore={editingBillboard.manualScore}
              canScore={canScore}
              onScoreSaved={setEditScore}
            />
          )}

          {canTransferOwnership && (
            <ContentOwnerSelect
              users={users}
              value={editOwnerUserId}
              onChange={setEditOwnerUserId}
            />
          )}

          <BillboardDisplayPeriodsEditor
            periods={periods}
            onChange={setPeriods}
            requireBillboardImage
            highlightMedia={highlightMedia}
          />

          <Button type="button" className="w-full" disabled={isPending} onClick={handleSubmit}>
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                در حال ذخیره...
              </>
            ) : isEditing ? (
              "ذخیره تغییرات"
            ) : (
              "ثبت تبلیغات محیطی"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
