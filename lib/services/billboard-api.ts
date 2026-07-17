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
import { matchBillboardCategoryKey } from "@/lib/billboard-categories";
import { resolveBillboardLocation } from "@/lib/billboard-location-resolver";
import { billboardApiRoutes } from "@/lib/routes/billboard-api";
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

function buildMapUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}

function toCoordinate(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

function firstDesignImage(external: IntegrationBillboard): string | null {
  const designs = [...(external.designs ?? [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  );
  for (const design of designs) {
    const url = design.thumbnail_url ?? design.image_url;
    if (url?.trim()) return url;
  }
  return null;
}

function firstGalleryImage(external: IntegrationBillboard): string | null {
  for (const image of external.images ?? []) {
    const url = image.thumbnail_url ?? image.image_url;
    if (url?.trim()) return url;
  }
  return null;
}

function resolveIntegrationDisplayImages(external: IntegrationBillboard): {
  thumbnailUrl: string;
  imageUrl: string;
} {
  const nestedFallback = firstDesignImage(external) ?? firstGalleryImage(external);

  const cardImage = billboardApiRoutes.resolveAssetUrl(
    external.card_image_url ??
      external.execution_thumbnail_url ??
      external.execution_image_url ??
      external.thumbnail_url ??
      external.image_url ??
      nestedFallback
  );
  const fullImage = billboardApiRoutes.resolveAssetUrl(
    external.execution_image_url ??
      external.image_url ??
      external.card_image_url ??
      external.thumbnail_url ??
      nestedFallback
  );

  const thumbnailUrl = cardImage ?? fullImage ?? "";
  const imageUrl = fullImage ?? cardImage ?? "";
  return { thumbnailUrl, imageUrl };
}

export function mapIntegrationBillboardToBillboard(
  external: IntegrationBillboard,
  campaignId: string,
  options?: IntegrationBillboardMappingOptions
): Billboard {
  const { thumbnailUrl: thumbnail, imageUrl } = resolveIntegrationDisplayImages(external);
  const title = external.name?.trim() || external.axis?.trim() || external.code;
  const address = external.address?.trim() ?? "";
  const fullAddress = external.full_address?.trim() ?? address;
  const axis = external.axis?.trim() ?? "";
  const { province, city } = resolveBillboardLocation({
    province: external.province,
    city: external.city,
    address,
    fullAddress,
    code: external.code,
  });
  const latitude = toCoordinate(external.latitude);
  const longitude = toCoordinate(external.longitude);
  const tags = [
    province ? `province:${province}` : null,
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
    description: fullAddress || address || null,
    province,
    city,
    location: axis || address || fullAddress || title,
    date: external.display_start ?? now.split("T")[0],
    thumbnailUrl: thumbnail,
    imageUrl,
    externalUrl:
      latitude !== null && longitude !== null
        ? buildMapUrl(latitude, longitude)
        : "",
    latitude,
    longitude,
    source: options?.source ?? "api",
    externalId: external.billboard_id,
    category:
      matchBillboardCategoryKey(external.billboard_type) ??
      matchBillboardCategoryKey(external.billboard_type_label),
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
  const mapped = mapExternalBillboardToBillboard(external, campaignId, options);
  // Drop ephemeral api-* id so Postgres generates a UUID; keep externalId + map tags.
  const { id: _ephemeralId, ...rest } = mapped;
  void _ephemeralId;
  return {
    ...rest,
    source: "manual",
  };
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
  const fullAddress = external.full_address?.trim() ?? address;
  const axis = external.axis?.trim() ?? "";
  const { province, city } = resolveBillboardLocation({
    province: external.province,
    city: external.city,
    address,
    fullAddress,
    code: external.code,
  });
  const latitude = toCoordinate(external.latitude);
  const longitude = toCoordinate(external.longitude);

  return {
    id: `api-${external.id}`,
    campaignId,
    title: `${external.code} — ${axis}`,
    description: fullAddress || address || null,
    province,
    city,
    location: axis || address,
    date: options?.date ?? now.split("T")[0],
    thumbnailUrl: thumbnail,
    imageUrl,
    externalUrl:
      latitude !== null && longitude !== null
        ? buildMapUrl(latitude, longitude)
        : "",
    latitude,
    longitude,
    source: "api",
    externalId: external.id,
    category: matchBillboardCategoryKey(external.billboard_type),
    status: external.status === "active" ? "published" : "draft",
    tags,
    notes: `کد: ${external.code} | محور: ${external.axis}`,
    published: options?.published ?? external.status === "active",
    sortOrder: options?.sortOrder ?? 0,
    createdAt: now,
    updatedAt: now,
  };
}

