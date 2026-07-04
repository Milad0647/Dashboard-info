import { billboardApiRoutes } from "@/lib/routes/billboard-api";
import { fetchCampaignIntegration } from "@/lib/services/billboard-api";
import {
  clearBillboardApiTokenCache,
  formatBillboardApiError,
  resolveBillboardApiToken,
} from "@/lib/services/billboard-api-auth";

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

async function buildAuthHeaders(
  actingUser?: BillboardActingUser | null,
  forceRefresh?: boolean
): Promise<HeadersInit> {
  const token = await resolveBillboardApiToken({ forceRefresh });
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
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
  const raw = await response.text();

  if (!response.ok) {
    throw new Error(await formatBillboardApiError(response, raw));
  }

  if (!raw) {
    return {} as T;
  }

  return JSON.parse(raw) as T;
}

async function billboardApiFetch(
  url: string,
  init: RequestInit,
  actingUser?: BillboardActingUser | null
): Promise<Response> {
  const headers = await buildAuthHeaders(actingUser);
  const response = await fetch(url, {
    ...init,
    headers: {
      ...headers,
      ...(init.headers ?? {}),
    },
    signal: init.signal ?? AbortSignal.timeout(BILLBOARD_ASSIGNMENT_TIMEOUT_MS),
  });

  if (response.status !== 401) {
    return response;
  }

  clearBillboardApiTokenCache();

  try {
    const retryHeaders = await buildAuthHeaders(actingUser, true);
    return fetch(url, {
      ...init,
      headers: {
        ...retryHeaders,
        ...(init.headers ?? {}),
      },
      signal: init.signal ?? AbortSignal.timeout(BILLBOARD_ASSIGNMENT_TIMEOUT_MS),
    });
  } catch {
    return response;
  }
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

  const response = await billboardApiFetch(
    billboardApiRoutes.createBillboard(),
    { method: "POST", body: formData },
    params.actingUser
  );

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

  const response = await billboardApiFetch(
    billboardApiRoutes.campaignBillboards(params.externalCampaignId),
    { method: "POST", body: formData },
    params.actingUser
  );

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

  const response = await billboardApiFetch(
    billboardApiRoutes.campaignBillboardDesigns(params.externalCampaignId, params.assignmentId),
    { method: "POST", body: formData },
    params.actingUser
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

export async function resolveAssignmentIdForBillboard(params: {
  externalCampaignSlug: string;
  assignmentId?: string | null;
  billboardExternalId?: string | null;
}): Promise<string> {
  if (params.assignmentId?.trim()) return params.assignmentId.trim();

  const billboardId = params.billboardExternalId?.trim();
  if (!billboardId) {
    throw new Error("شناسه assignment یا بیلبورد الزامی است");
  }

  const integration = await fetchCampaignIntegration(params.externalCampaignSlug);
  const match = integration.billboards.find((item) => item.billboard_id === billboardId);
  if (!match?.assignment_id) {
    throw new Error("assignment این بیلبورد در API یافت نشد");
  }
  return match.assignment_id;
}
