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
import type { AdminUser, Billboard } from "@/lib/types";

// Normalizes Persian text the same way the billboard API project does, so
// province/city names coming from the API reliably match our dataset:
// unify Arabic vs Persian yeh/kaf, turn ZWNJ into a space, and collapse spaces.
function normalizeLocationName(value: string): string {
  return value
    .trim()
    .replace(/\u064A/g, "\u06CC")
    .replace(/\u0643/g, "\u06A9")
    .replace(/\u200C/g, " ")
    .replace(/\s+/g, " ");
}

// Non-standard province labels used by the API mapped to official names.
const PROVINCE_ALIASES: Record<string, string> = {
  کهکیلویه: "کهگیلویه و بویراحمد",
  "کهکیلویه و بویراحمد": "کهگیلویه و بویراحمد",
  آذربایجان: "آذربایجان شرقی",
  باختر: "کرمانشاه",
  غرب: "کرمانشاه",
  خراسان: "خراسان رضوی",
};

// Maps every known (normalized) city name to its province for reverse lookup.
// First occurrence wins for the rare cities that share a name across provinces.
const CITY_TO_PROVINCE: Map<string, string> = (() => {
  const map = new Map<string, string>();
  for (const province of IRAN_PROVINCES_DATA) {
    for (const city of province.cities) {
      const key = normalizeLocationName(city.name);
      if (!map.has(key)) map.set(key, province.name);
    }
  }
  return map;
})();

function resolveKnownProvince(value: string): string | null {
  const normalized = normalizeLocationName(value);
  if (!normalized) return null;

  const alias = PROVINCE_ALIASES[normalized];
  if (alias) return alias;

  const exact = IRAN_PROVINCES_DATA.find((province) => province.name === normalized);
  if (exact) return exact.name;

  const fuzzy = IRAN_PROVINCES_DATA.find(
    (province) => province.name.includes(normalized) || normalized.includes(province.name)
  );
  return fuzzy?.name ?? null;
}

function resolveKnownCity(value: string): { city: string; province: string } | null {
  const normalized = normalizeLocationName(value);
  if (!normalized) return null;

  const province = CITY_TO_PROVINCE.get(normalized);
  if (province) return { city: normalized, province };

  return null;
}

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

function hasBoundedLocationMatch(text: string, term: string): boolean {
  const idx = text.indexOf(term);
  if (idx === -1) return false;
  const beforeOk = idx === 0 || /[\s،,.]/.test(text[idx - 1] ?? "");
  const afterIdx = idx + term.length;
  const afterOk = afterIdx >= text.length || /[\s،,.]/.test(text[afterIdx] ?? "");
  return beforeOk && afterOk;
}

// Parses province/city from a free-form Iranian address by matching against
// the official province/city dataset. Checks address tokens first, then falls
// back to bounded substring matches to avoid false hits like "طالقان" in "طالقانی".
function parseLocationFromAddress(address: string): {
  province: string | null;
  city: string | null;
} {
  const trimmed = normalizeLocationName(address);
  if (!trimmed) return { province: null, city: null };

  const tokens = trimmed
    .split(/[،,.]+|\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  for (const token of tokens) {
    const known = resolveKnownCity(token);
    if (known) return known;
  }

  let bestMatch: { province: string; city: string; length: number } | null = null;
  for (const [cityKey, province] of CITY_TO_PROVINCE) {
    if (cityKey.length < 3) continue;
    if (!hasBoundedLocationMatch(trimmed, cityKey)) continue;
    if (!bestMatch || cityKey.length > bestMatch.length) {
      bestMatch = { province, city: cityKey, length: cityKey.length };
    }
  }
  if (bestMatch) {
    return { province: bestMatch.province, city: bestMatch.city };
  }

  for (const province of IRAN_PROVINCES_DATA) {
    if (hasBoundedLocationMatch(trimmed, province.name)) {
      return { province: province.name, city: null };
    }
  }

  return { province: null, city: null };
}

// Resolves the physical province/city of a billboard while defending against
// bad API data: a city field that holds a province name, city equal to province,
// or a non-standard province label. When the provided city is unreliable, the
// concrete city is recovered from the address, and the province is derived from
// the resolved city whenever possible.
function resolveBillboardLocation(input: {
  province?: string | null;
  city?: string | null;
  address?: string | null;
  code?: string | null;
}): ResolvedBillboardLocation {
  const rawProvince = input.province?.trim() ?? "";
  const rawCity = input.city?.trim() ?? "";
  const parsed = parseLocationFromAddress(input.address?.trim() ?? "");

  const knownRawCity = resolveKnownCity(rawCity);
  const rawCityIsReliable =
    knownRawCity !== null &&
    !(
      normalizeLocationName(rawCity) === normalizeLocationName(rawProvince) &&
      parsed.city &&
      parsed.city !== knownRawCity.city
    );

  let city = rawCityIsReliable ? knownRawCity.city : parsed.city ?? "";

  const cityProvince = rawCityIsReliable
    ? knownRawCity.province
    : city
      ? CITY_TO_PROVINCE.get(normalizeLocationName(city)) ?? null
      : null;

  let province: string | null;
  if (cityProvince) {
    province = cityProvince;
  } else if (rawProvince) {
    province = resolveKnownProvince(rawProvince) ?? parsed.province;
  } else {
    province = parsed.province;
  }

  if (!city && /(?:^|[-_])(TH|TEH)(?:$|[-_])/i.test(input.code ?? "")) {
    city = "تهران";
    province = province ?? "تهران";
  }

  return {
    province,
    city: city || "نامشخص",
  };
}

function resolveIntegrationBillboardLocation(
  external: IntegrationBillboard
): ResolvedBillboardLocation {
  return resolveBillboardLocation({
    province: external.province ?? external.owner?.province,
    city: external.city ?? external.owner?.city,
    address: external.address,
    code: external.code,
  });
}

function resolveExternalBillboardLocation(
  address: string,
  code?: string | null
): ResolvedBillboardLocation {
  return resolveBillboardLocation({ address, code });
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
  const { province, city } = resolveExternalBillboardLocation(address, external.code);

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

