import type { ExternalBillboard } from "@/lib/models/billboard-api";
import { billboardApiRoutes } from "@/lib/routes/billboard-api";
import { fetchAllExternalBillboards } from "@/lib/services/billboard-api";

const BILLBOARD_ASSIGNMENT_TIMEOUT_MS = 120_000;

export interface BillboardActingUser {
  id: string;
  email: string;
  name?: string;
}

export interface BillboardDisplayPeriodInput {
  title?: string;
  startDate: string;
  endDate: string;
  sortOrder: number;
  image?: Blob | null;
  billboardImage?: Blob | null;
}

function getBillboardApiToken(): string {
  const token = process.env.BILLBOARD_API_TOKEN?.trim();
  if (!token) {
    throw new Error("BILLBOARD_API_TOKEN در سرور تنظیم نشده است");
  }
  return token;
}

function buildAuthHeaders(actingUser?: BillboardActingUser | null): HeadersInit {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${getBillboardApiToken()}`,
    Accept: "application/json",
  };

  if (actingUser) {
    headers["X-User-Id"] = actingUser.id;
    headers["X-User-Email"] = actingUser.email;
    if (actingUser.name?.trim()) {
      headers["X-User-Name"] = actingUser.name.trim();
    }
  }

  return headers;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `خطای ${response.status} از سرویس بیلبورد`);
  }
  return response.json() as Promise<T>;
}

function extractId(body: unknown, keys: string[]): string {
  if (!body || typeof body !== "object") {
    throw new Error("پاسخ نامعتبر از سرویس بیلبورد");
  }

  const record = body as Record<string, unknown>;
  const data = record.data;
  const sources = [record, data && typeof data === "object" ? (data as Record<string, unknown>) : null];

  for (const source of sources) {
    if (!source) continue;
    for (const key of keys) {
      const value = source[key];
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
  }

  throw new Error("شناسه مورد انتظار از سرویس بیلبورد دریافت نشد");
}

async function fetchJsonPaginatedBillboards(url: string): Promise<ExternalBillboard[]> {
  const firstResponse = await fetch(url, {
    cache: "no-store",
    headers: buildAuthHeaders(),
    signal: AbortSignal.timeout(BILLBOARD_ASSIGNMENT_TIMEOUT_MS),
  });
  const firstPage = await parseJsonResponse<{
    data?: ExternalBillboard[];
    meta?: { last_page?: number };
  }>(firstResponse);

  const items = [...(firstPage.data ?? [])];
  const lastPage = firstPage.meta?.last_page ?? 1;
  const baseUrl = new URL(url);

  for (let page = 2; page <= lastPage; page += 1) {
    baseUrl.searchParams.set("page", String(page));
    const response = await fetch(baseUrl.toString(), {
      cache: "no-store",
      headers: buildAuthHeaders(),
      signal: AbortSignal.timeout(BILLBOARD_ASSIGNMENT_TIMEOUT_MS),
    });
    const nextPage = await parseJsonResponse<{ data?: ExternalBillboard[] }>(response);
    items.push(...(nextPage.data ?? []));
  }

  return items;
}

export async function fetchAvailableSystemBillboards(
  externalCampaignId: string
): Promise<ExternalBillboard[]> {
  const [allBillboards, attachedBillboards] = await Promise.all([
    fetchJsonPaginatedBillboards(billboardApiRoutes.billboards({ perPage: 100 })),
    fetchAllExternalBillboards(externalCampaignId),
  ]);

  const attachedIds = new Set(attachedBillboards.map((item) => item.id));
  return allBillboards.filter((item) => !attachedIds.has(item.id));
}

export async function createSystemBillboard(params: {
  axis: string;
  address?: string;
  latitude: number;
  longitude: number;
  areaSqm?: number | null;
  province?: string | null;
  city?: string | null;
  actingUser?: BillboardActingUser | null;
}): Promise<string> {
  const formData = new FormData();
  formData.append("axis", params.axis.trim());
  if (params.address?.trim()) formData.append("address", params.address.trim());
  formData.append("latitude", String(params.latitude));
  formData.append("longitude", String(params.longitude));
  if (params.areaSqm != null && Number.isFinite(params.areaSqm)) {
    formData.append("area_sqm", String(params.areaSqm));
  }
  if (params.province?.trim()) formData.append("province", params.province.trim());
  if (params.city?.trim()) formData.append("city", params.city.trim());

  const response = await fetch(billboardApiRoutes.createBillboard(), {
    method: "POST",
    headers: buildAuthHeaders(params.actingUser),
    body: formData,
    signal: AbortSignal.timeout(BILLBOARD_ASSIGNMENT_TIMEOUT_MS),
  });

  const body = await parseJsonResponse<unknown>(response);
  return extractId(body, ["id", "billboard_id"]);
}

export async function attachBillboardToCampaign(params: {
  externalCampaignId: string;
  billboardId: string;
  displayStart?: string | null;
  displayEnd?: string | null;
  notes?: string | null;
  executionImage?: Blob | null;
  actingUser?: BillboardActingUser | null;
}): Promise<string> {
  const formData = new FormData();
  formData.append("billboard_id", params.billboardId);
  if (params.displayStart) formData.append("display_start", params.displayStart);
  if (params.displayEnd) formData.append("display_end", params.displayEnd);
  if (params.notes?.trim()) formData.append("notes", params.notes.trim());
  if (params.executionImage) formData.append("execution_image", params.executionImage);

  const response = await fetch(billboardApiRoutes.campaignBillboards(params.externalCampaignId), {
    method: "POST",
    headers: buildAuthHeaders(params.actingUser),
    body: formData,
    signal: AbortSignal.timeout(BILLBOARD_ASSIGNMENT_TIMEOUT_MS),
  });

  const body = await parseJsonResponse<unknown>(response);
  return extractId(body, ["id", "assignment_id"]);
}

export async function addCampaignBillboardDesign(params: {
  externalCampaignId: string;
  assignmentId: string;
  period: BillboardDisplayPeriodInput;
  actingUser?: BillboardActingUser | null;
}): Promise<void> {
  const formData = new FormData();
  if (params.period.title?.trim()) formData.append("title", params.period.title.trim());
  formData.append("start_date", params.period.startDate);
  formData.append("end_date", params.period.endDate);
  formData.append("sort_order", String(params.period.sortOrder));
  if (params.period.image) formData.append("image", params.period.image);
  if (params.period.billboardImage) {
    formData.append("billboard_image", params.period.billboardImage);
  }

  const response = await fetch(
    billboardApiRoutes.campaignBillboardDesigns(params.externalCampaignId, params.assignmentId),
    {
      method: "POST",
      headers: buildAuthHeaders(params.actingUser),
      body: formData,
      signal: AbortSignal.timeout(BILLBOARD_ASSIGNMENT_TIMEOUT_MS),
    }
  );

  await parseJsonResponse<unknown>(response);
}

export function computeDisplayRangeFromPeriods(
  periods: Pick<BillboardDisplayPeriodInput, "startDate" | "endDate">[]
): { displayStart?: string; displayEnd?: string } {
  const starts = periods.map((period) => period.startDate).filter(Boolean).sort();
  const ends = periods.map((period) => period.endDate).filter(Boolean).sort();
  if (starts.length === 0 || ends.length === 0) return {};
  return {
    displayStart: starts[0],
    displayEnd: ends[ends.length - 1],
  };
}
