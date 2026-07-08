import { IRAN_PROVINCES_DATA } from "@/lib/iran-provinces-data";

export interface ResolvedBillboardLocation {
  province: string | null;
  city: string;
}

// Keep normalization aligned with Map-Bilboard (frontend/src/lib/iranLocations.ts).
export function normalizeLocationName(value: string): string {
  return value
    .trim()
    .replace(/\u064A/g, "\u06CC")
    .replace(/\u0643/g, "\u06A9")
    .replace(/\u200C/g, " ")
    .replace(/\s+/g, " ");
}

const PROVINCE_ALIASES: Record<string, string> = {
  کهکیلویه: "کهگیلویه و بویراحمد",
  "کهکیلویه و بویراحمد": "کهگیلویه و بویراحمد",
  آذربایجان: "آذربایجان شرقی",
  باختر: "کرمانشاه",
  غرب: "کرمانشاه",
  خراسان: "خراسان رضوی",
};

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

export function resolveKnownProvince(value: string): string | null {
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

export function resolveKnownCity(value: string): { city: string; province: string } | null {
  const normalized = normalizeLocationName(value);
  if (!normalized) return null;

  const province = CITY_TO_PROVINCE.get(normalized);
  if (!province) return null;

  return { city: normalized, province };
}

function hasBoundedLocationMatch(text: string, term: string): boolean {
  const idx = text.indexOf(term);
  if (idx === -1) return false;
  const beforeOk = idx === 0 || /[\s،,.]/.test(text[idx - 1] ?? "");
  const afterIdx = idx + term.length;
  const afterOk = afterIdx >= text.length || /[\s،,.]/.test(text[afterIdx] ?? "");
  return beforeOk && afterOk;
}

export function parseLocationFromAddress(address: string): {
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

function parseLocationFromFullAddress(fullAddress: string): {
  province: string | null;
  city: string | null;
} {
  const parts = fullAddress
    .split(/\s*—\s*/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) return { province: null, city: null };

  const firstProvince = resolveKnownProvince(parts[0] ?? "");
  if (firstProvince) {
    // Map-Bilboard formats `full_address` as:
    // - effectiveProvince
    // - optionalCity (only when city != effectiveProvince)
    // - detail
    // So when the city part is not present, the 2nd segment is detail, not city.
    if (parts.length <= 2) {
      return { province: firstProvince, city: firstProvince };
    }

    const cityPart = parts[1] ?? "";
    const knownCity = resolveKnownCity(cityPart);
    if (knownCity) {
      return {
        province: knownCity.province,
        city: knownCity.city,
      };
    }

    const fallback = parseLocationFromAddress(cityPart);
    return {
      province: fallback.province ?? firstProvince,
      city: fallback.city,
    };
  }

  const firstCity = resolveKnownCity(parts[0] ?? "");
  if (firstCity) {
    return {
      province: firstCity.province,
      city: firstCity.city,
    };
  }

  return parseLocationFromAddress(fullAddress);
}

function isTehranBillboardCode(code: string | null | undefined): boolean {
  return /(?:^|[-_])(TH|TEH)(?:$|[-_])/i.test(code ?? "");
}

export function resolveBillboardLocation(input: {
  province?: string | null;
  city?: string | null;
  address?: string | null;
  fullAddress?: string | null;
  code?: string | null;
}): ResolvedBillboardLocation {
  const rawProvince = input.province?.trim() ?? "";
  const rawCity = input.city?.trim() ?? "";
  const parsedFromFull = input.fullAddress?.trim()
    ? parseLocationFromFullAddress(input.fullAddress)
    : { province: null, city: null };
  const parsedFromAddress = parseLocationFromAddress(input.address?.trim() ?? "");

  const knownRawCity = resolveKnownCity(rawCity);
  const rawCityIsReliable =
    knownRawCity !== null &&
    !(
      normalizeLocationName(rawCity) === normalizeLocationName(rawProvince) &&
      (parsedFromFull.city ?? parsedFromAddress.city) &&
      (parsedFromFull.city ?? parsedFromAddress.city) !== knownRawCity.city
    );

  let city = rawCityIsReliable
    ? knownRawCity.city
    : parsedFromFull.city ?? parsedFromAddress.city ?? "";

  let province: string | null = null;
  if (rawCityIsReliable) {
    province = knownRawCity.province;
  } else if (city) {
    province = CITY_TO_PROVINCE.get(normalizeLocationName(city)) ?? null;
  }

  if (!province && rawProvince) {
    province = resolveKnownProvince(rawProvince);
  }
  if (!province) {
    province = parsedFromFull.province ?? parsedFromAddress.province;
  }
  if (!province && city) {
    province = CITY_TO_PROVINCE.get(normalizeLocationName(city)) ?? null;
  }

  if (!city && isTehranBillboardCode(input.code)) {
    city = "تهران";
    province = province ?? "تهران";
  }

  return {
    province,
    city: city || "نامشخص",
  };
}
