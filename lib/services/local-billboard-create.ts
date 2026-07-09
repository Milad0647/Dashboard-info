import { saveBillboard } from "@/lib/data-access/admin";
import { pgReplaceBillboardPeriods } from "@/lib/db/repository";
import { saveUploadedImageFile } from "@/lib/services/save-uploaded-file";
import type { BillboardDisplayPeriodInput } from "@/lib/services/billboard-assignment-api";
import { generateId, formatPersianDateShort } from "@/lib/utils";
import type { BillboardCategory } from "@/lib/billboard-categories";

export interface CreateLocalBillboardInput {
  campaignId: string;
  billboardId?: string;
  axis: string;
  address?: string;
  latitude: number;
  longitude: number;
  areaSqm?: number | null;
  province?: string | null;
  city?: string | null;
  category?: BillboardCategory | string | null;
  notes?: string | null;
  published?: boolean;
  status?: string;
  planLabel?: string | null;
  periods: BillboardDisplayPeriodInput[];
  ownerUserId?: string | null;
}

function buildMapsUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}

function buildDisplayDateRangeLabel(startDate: string, endDate: string): string {
  return `${formatPersianDateShort(startDate)} تا ${formatPersianDateShort(endDate)}`;
}

function buildNotes(params: {
  notes?: string | null;
  areaSqm?: number | null;
  confirmationImageUrl?: string | null;
  periodTitle?: string | null;
}): string | null {
  const parts: string[] = [];

  if (params.areaSqm != null && Number.isFinite(params.areaSqm)) {
    parts.push(`متراژ: ${params.areaSqm} m²`);
  }
  if (params.periodTitle?.trim()) {
    parts.push(`دوره: ${params.periodTitle.trim()}`);
  }
  if (params.confirmationImageUrl) {
    parts.push(`تأییدیه: ${params.confirmationImageUrl}`);
  }
  if (params.notes?.trim()) {
    parts.push(params.notes.trim());
  }

  return parts.length > 0 ? parts.join("\n") : null;
}

async function resolvePeriodImage(
  period: BillboardDisplayPeriodInput,
  existingUrl?: string | null
): Promise<string> {
  if (period.billboardImage instanceof File && period.billboardImage.size > 0) {
    return saveUploadedImageFile(period.billboardImage);
  }
  if (typeof period.billboardImageUrl === "string" && period.billboardImageUrl.trim()) {
    return period.billboardImageUrl.trim();
  }
  if (existingUrl?.trim()) return existingUrl.trim();
  throw new Error("عکس بیلبورد در دوره نمایش الزامی است");
}

async function resolveConfirmationImage(
  period: BillboardDisplayPeriodInput,
  existingUrl?: string | null
): Promise<string | null> {
  if (period.image instanceof File && period.image.size > 0) {
    return saveUploadedImageFile(period.image);
  }
  if (typeof period.confirmationImageUrl === "string" && period.confirmationImageUrl.trim()) {
    return period.confirmationImageUrl.trim();
  }
  return existingUrl ?? null;
}

export async function saveLocalBillboard(params: CreateLocalBillboardInput): Promise<string> {
  if (params.periods.length === 0) {
    throw new Error("حداقل یک دوره نمایش الزامی است");
  }

  const savedPeriods: Array<{
    id?: string;
    title?: string | null;
    startDate: string;
    endDate: string;
    billboardImageUrl: string;
    confirmationImageUrl?: string | null;
    sortOrder: number;
  }> = [];

  for (const [index, period] of params.periods.entries()) {
    if (!period.startDate || !period.endDate) {
      throw new Error("تاریخ شروع و پایان دوره نمایش الزامی است");
    }

    const billboardImageUrl = await resolvePeriodImage(period, period.billboardImageUrl);
    const confirmationImageUrl = await resolveConfirmationImage(period, period.confirmationImageUrl);

    savedPeriods.push({
      id: period.id,
      title: period.title ?? null,
      startDate: period.startDate,
      endDate: period.endDate,
      billboardImageUrl,
      confirmationImageUrl,
      sortOrder: period.sortOrder ?? index,
    });
  }

  const primaryPeriod = savedPeriods[0];
  const lastPeriod = savedPeriods[savedPeriods.length - 1];
  const city = params.city?.trim() || "نامشخص";
  const axis = params.axis.trim();
  const location = params.address?.trim() || axis;
  const displayRange = buildDisplayDateRangeLabel(primaryPeriod.startDate, lastPeriod.endDate);
  const tags = [
    `display-range:${displayRange}`,
    params.province?.trim() ? `province:${params.province.trim()}` : null,
  ].filter((tag): tag is string => Boolean(tag));

  const id = params.billboardId ?? generateId();

  const result = await saveBillboard({
    id,
    campaignId: params.campaignId,
    title: axis,
    description: params.address?.trim() || null,
    province: params.province?.trim() || null,
    city,
    location,
    date: primaryPeriod.startDate,
    thumbnailUrl: primaryPeriod.billboardImageUrl,
    imageUrl: primaryPeriod.billboardImageUrl,
    externalUrl: buildMapsUrl(params.latitude, params.longitude),
    latitude: params.latitude,
    longitude: params.longitude,
    category: params.category ?? null,
    areaSqm: params.areaSqm ?? null,
    source: "manual",
    status: (params.status as "draft" | "published" | "completed") ?? "draft",
    tags,
    notes: buildNotes({
      notes: params.notes,
      areaSqm: params.areaSqm,
      confirmationImageUrl: primaryPeriod.confirmationImageUrl,
      periodTitle: primaryPeriod.title,
    }),
    published: params.published ?? false,
    planLabel: params.planLabel ?? null,
    ownerUserId: params.ownerUserId ?? null,
  });

  if (!result.success) {
    throw new Error("ذخیره تبلیغات محیطی ناموفق بود");
  }

  await pgReplaceBillboardPeriods(id, savedPeriods);

  return id;
}

export async function createLocalBillboard(params: CreateLocalBillboardInput): Promise<string> {
  return saveLocalBillboard(params);
}
