import {
  getBillboardAssignmentTag,
  getExternalBillboardTag,
  type CampaignIntegrationResponse,
  type ExternalBillboard,
  type ExternalBillboardsResponse,
  type ExternalCampaign,
  type ExternalCampaignsResponse,
  type IntegrationBillboard,
} from "@/lib/models/billboard-api";
import { billboardApiRoutes } from "@/lib/routes/billboard-api";
import { IRAN_PROVINCES_DATA } from "@/lib/iran-provinces-data";
import { normalizeImportedProvince } from "@/lib/iran-locations";
import type { AdminUser, Billboard } from "@/lib/types";

const BILLBOARD_API_TIMEOUT_MS = 8_000;

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(BILLBOARD_API_TIMEOUT_MS),
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
  const lastPage = firstPage.meta?.last_page ?? 1;

  for (let page = 2; page <= lastPage; page += 1) {
    const nextPage = await fetchExternalBillboards(campaignId, page, 50);
    items.push(...(nextPage.data ?? []));
  }

  return items;
}

export async function fetchCampaignIntegration(slug: string) {
  const body = await fetchJson<CampaignIntegrationResponse>(
    billboardApiRoutes.campaignIntegration(slug)
  );
  return body.data;
}

interface ResolvedBillboardLocation {
  province: string | null;
  city: string;
}

// Parses province/city from a free-form Iranian address by matching against
// the official province/city dataset. Prefers the longest city match to avoid
// short substrings, and infers the province from the matched city when possible.
function parseLocationFromAddress(address: string): {
  province: string | null;
  city: string | null;
} {
  const trimmed = address.trim();
  if (!trimmed) return { province: null, city: null };

  let matchedProvince: string | null = null;
  let matchedCity: string | null = null;

  for (const province of IRAN_PROVINCES_DATA) {
    const provinceHit = trimmed.includes(province.name);
    if (provinceHit && !matchedProvince) {
      matchedProvince = province.name;
    }

    for (const city of province.cities) {
      if (city.name.length < 3) continue;
      if (!trimmed.includes(city.name)) continue;
      if (!matchedCity || city.name.length > matchedCity.length) {
        matchedCity = city.name;
        if (!provinceHit) matchedProvince = matchedProvince ?? province.name;
        else matchedProvince = province.name;
      }
    }
  }

  return { province: matchedProvince, city: matchedCity };
}

function firstNonEmpty(...values: (string | null | undefined)[]): string | null {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function resolveIntegrationBillboardLocation(
  external: IntegrationBillboard
): ResolvedBillboardLocation {
  const parsed = parseLocationFromAddress(external.address?.trim() ?? "");

  const province = firstNonEmpty(
    external.province,
    external.owner?.province,
    parsed.province
  );
  const city = firstNonEmpty(external.city, external.owner?.city, parsed.city);

  return {
    province: normalizeImportedProvince(province),
    city: city ?? "نامشخص",
  };
}

function resolveExternalBillboardLocation(address: string): ResolvedBillboardLocation {
  const parsed = parseLocationFromAddress(address);
  return {
    province: normalizeImportedProvince(parsed.province),
    city: parsed.city ?? "نامشخص",
  };
}

function buildMapUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}

export interface IntegrationBillboardMappingOptions {
  sortOrder?: number;
  published?: boolean;
  matchedUser?: AdminUser | null;
  source?: Billboard["source"];
}

function resolveIntegrationOwnerFields(
  external: IntegrationBillboard,
  matchedUser: AdminUser | null | undefined
): Pick<Billboard, "ownerUserId" | "ownerName" | "ownerEmail" | "ownerProvince" | "ownerCity"> {
  const owner = external.owner ?? null;

  if (!owner && !matchedUser) {
    return {
      ownerUserId: null,
      ownerName: null,
      ownerEmail: null,
      ownerProvince: null,
      ownerCity: null,
    };
  }

  const ownerEmail = owner?.email?.trim() || owner?.username?.trim() || matchedUser?.email || null;

  return {
    ownerUserId: matchedUser?.id ?? null,
    ownerName: matchedUser?.name ?? owner?.name ?? null,
    ownerEmail,
    ownerProvince:
      owner?.province?.trim() || matchedUser?.province?.trim() || external.province?.trim() || null,
    ownerCity: owner?.city?.trim() || matchedUser?.city?.trim() || external.city?.trim() || null,
  };
}

export function mapIntegrationBillboardToBillboard(
  external: IntegrationBillboard,
  campaignId: string,
  options?: IntegrationBillboardMappingOptions
): Billboard {
  const cardImage = billboardApiRoutes.resolveAssetUrl(
    external.card_image_url ??
      external.execution_thumbnail_url ??
      external.thumbnail_url ??
      external.image_url
  );
  const fullImage = billboardApiRoutes.resolveAssetUrl(
    external.execution_image_url ??
      external.image_url ??
      external.card_image_url ??
      external.thumbnail_url
  );
  const thumbnail = cardImage ?? "";
  const imageUrl = fullImage ?? "";
  const title = external.name?.trim() || external.axis?.trim() || external.code;
  const address = external.address?.trim() ?? "";
  const axis = external.axis?.trim() ?? "";
  const { province, city } = resolveIntegrationBillboardLocation(external);
  const tags = [
    external.quality_tier_label,
    external.billboard_type_label,
    getExternalBillboardTag(external.billboard_id),
    getBillboardAssignmentTag(external.assignment_id),
  ].filter((tag): tag is string => Boolean(tag));
  const now = new Date().toISOString();

  return {
    id: `api-${external.billboard_id}`,
    campaignId,
    title,
    description: address || null,
    province,
    city,
    location: axis || address || title,
    date: external.display_start ?? now.split("T")[0],
    thumbnailUrl: thumbnail,
    imageUrl,
    externalUrl: buildMapUrl(external.latitude, external.longitude),
    latitude: external.latitude,
    longitude: external.longitude,
    source: options?.source ?? "api",
    externalId: external.billboard_id,
    status: "published",
    tags,
    notes: external.notes,
    published: options?.published ?? true,
    sortOrder: options?.sortOrder ?? 0,
    code: external.code,
    displayDateRange: external.display_range_shamsi,
    providerName: external.provider_name,
    qualityTierLabel: external.quality_tier_label,
    billboardTypeLabel: external.billboard_type_label,
    ...resolveIntegrationOwnerFields(external, options?.matchedUser),
    createdAt: now,
    updatedAt: now,
  };
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
  const address = external.address?.trim() ?? "";
  const axis = external.axis?.trim() ?? "";
  const { province, city } = resolveExternalBillboardLocation(address);

  return {
    id: `api-${external.id}`,
    campaignId,
    title: `${external.code} — ${axis}`,
    description: address || null,
    province,
    city,
    location: axis || address,
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

