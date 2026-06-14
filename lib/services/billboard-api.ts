import {
  getExternalBillboardTag,
  type ExternalBillboard,
  type ExternalBillboardsResponse,
  type ExternalCampaign,
  type ExternalCampaignsResponse,
} from "@/lib/models/billboard-api";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { billboardApiRoutes } from "@/lib/routes/billboard-api";
import type { Billboard } from "@/lib/types";

const BILLBOARD_FETCH_TIMEOUT_MS = 8_000;
const MAX_BILLBOARD_PAGES = 10;

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetchWithTimeout(url, {
    cache: "no-store",
    timeoutMs: BILLBOARD_FETCH_TIMEOUT_MS,
  });
  if (!response.ok) {
    throw new Error(`Billboard API request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchExternalCampaigns(): Promise<ExternalCampaign[]> {
  const body = await fetchJson<ExternalCampaignsResponse>(billboardApiRoutes.campaigns());
  return body.data ?? [];
}

export async function fetchExternalBillboards(
  campaignId: string,
  page = 1,
  perPage = 50
): Promise<ExternalBillboardsResponse> {
  return fetchJson<ExternalBillboardsResponse>(
    billboardApiRoutes.billboards({ campaignId, page, perPage })
  );
}

export async function fetchAllExternalBillboards(campaignId: string): Promise<ExternalBillboard[]> {
  const firstPage = await fetchExternalBillboards(campaignId, 1, 50);
  const items = [...(firstPage.data ?? [])];
  const lastPage = Math.min(firstPage.meta?.last_page ?? 1, MAX_BILLBOARD_PAGES);

  for (let page = 2; page <= lastPage; page += 1) {
    const nextPage = await fetchExternalBillboards(campaignId, page, 50);
    items.push(...(nextPage.data ?? []));
  }

  return items;
}

function resolveCity(address: string): string {
  if (address.includes("تهران")) return "تهران";
  if (address.includes("مشهد")) return "مشهد";
  if (address.includes("اصفهان")) return "اصفهان";
  if (address.includes("شیراز")) return "شیراز";
  if (address.includes("تبریز")) return "تبریز";
  return "تهران";
}

function buildMapUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}

export function mapExternalBillboardToLocal(
  external: ExternalBillboard,
  campaignId: string,
  options?: { date?: string; sortOrder?: number; published?: boolean }
): Partial<Billboard> & { campaignId: string } {
  return mapExternalBillboardToBillboard(external, campaignId, options);
}

export function mapExternalBillboardToBillboard(
  external: ExternalBillboard,
  campaignId: string,
  options?: { date?: string; sortOrder?: number; published?: boolean }
): Billboard {
  const resolvedThumbnail = billboardApiRoutes.resolveAssetUrl(
    external.thumbnail_url ?? external.image_url
  );
  const resolvedImage = billboardApiRoutes.resolveAssetUrl(
    external.image_url ?? external.thumbnail_url
  );
  const thumbnail = resolvedThumbnail ?? "";
  const imageUrl = resolvedImage ?? "";

  const tags = [external.code, external.axis, getExternalBillboardTag(external.id)].filter(Boolean);
  const now = new Date().toISOString();

  return {
    id: `api-${external.id}`,
    campaignId,
    title: `${external.code} — ${external.axis}`,
    description: external.address,
    city: resolveCity(external.address),
    location: external.address,
    date: options?.date ?? now.split("T")[0],
    thumbnailUrl: thumbnail,
    imageUrl,
    externalUrl: buildMapUrl(external.latitude, external.longitude),
    latitude: external.latitude,
    longitude: external.longitude,
    source: "api",
    externalId: external.id,
    status: external.status === "active" ? "published" : "draft",
    tags,
    notes: `کد: ${external.code} | محور: ${external.axis}`,
    published: options?.published ?? external.status === "active",
    sortOrder: options?.sortOrder ?? 0,
    createdAt: now,
    updatedAt: now,
  };
}

