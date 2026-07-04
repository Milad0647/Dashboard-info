import { saveBillboard } from "@/lib/data-access/admin";
import { saveUploadedImageFile } from "@/lib/services/save-uploaded-file";
import type { BillboardDisplayPeriodInput } from "@/lib/services/billboard-assignment-api";
import { generateId, formatPersianDateShort } from "@/lib/utils";

export interface CreateLocalBillboardInput {
  campaignId: string;
  axis: string;
  address?: string;
  latitude: number;
  longitude: number;
  areaSqm?: number | null;
  province?: string | null;
  city?: string | null;
  notes?: string | null;
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
  province?: string | null;
  confirmationImageUrl?: string | null;
  periodTitle?: string | null;
}): string | null {
  const parts: string[] = [];

  if (params.province?.trim()) {
    parts.push(`استان: ${params.province.trim()}`);
  }
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

export async function createLocalBillboard(params: CreateLocalBillboardInput): Promise<string> {
  const period = params.periods[0];
  if (!period?.startDate || !period.endDate) {
    throw new Error("دوره نمایش الزامی است");
  }

  if (!period.billboardImage) {
    throw new Error("عکس بیلبورد در دوره نمایش الزامی است");
  }

  const billboardImageUrl = await saveUploadedImageFile(period.billboardImage as File);
  let confirmationImageUrl: string | null = null;
  if (period.image) {
    confirmationImageUrl = await saveUploadedImageFile(period.image as File);
  }

  const city = params.city?.trim() || "نامشخص";
  const axis = params.axis.trim();
  const location = params.address?.trim() || axis;
  const displayRange = buildDisplayDateRangeLabel(period.startDate, period.endDate);
  const tags = [
    `display-range:${displayRange}`,
    params.province?.trim() ? `province:${params.province.trim()}` : null,
  ].filter((tag): tag is string => Boolean(tag));

  const id = generateId();

  const result = await saveBillboard({
    id,
    campaignId: params.campaignId,
    title: axis,
    description: params.address?.trim() || null,
    city,
    location,
    date: period.startDate,
    thumbnailUrl: billboardImageUrl,
    imageUrl: billboardImageUrl,
    externalUrl: buildMapsUrl(params.latitude, params.longitude),
    latitude: params.latitude,
    longitude: params.longitude,
    source: "manual",
    status: "draft",
    tags,
    notes: buildNotes({
      notes: params.notes,
      areaSqm: params.areaSqm,
      province: params.province,
      confirmationImageUrl,
      periodTitle: period.title,
    }),
    published: false,
    ownerUserId: params.ownerUserId ?? null,
  });

  if (!result.success) {
    throw new Error("ذخیره بیلبورد ناموفق بود");
  }

  return id;
}
