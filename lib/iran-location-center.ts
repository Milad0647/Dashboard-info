import { getCitiesForProvince, IRAN_PROVINCES, normalizeImportedProvince } from "@/lib/iran-locations";
import { IRAN_PROVINCES_DATA } from "@/lib/iran-provinces-data";

export const MAP_DEFAULT_CENTER = { lat: 35.6892, lng: 51.389 } as const;

export interface LocationCenter {
  lat: number;
  lng: number;
}

function normalizeLocationName(value: string): string {
  return value
    .trim()
    .replace(/\u200c/g, "")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/\s+/g, " ")
    .replace(/‌/g, "");
}

const CENTER_INDEX = new Map<string, LocationCenter>();

for (const province of IRAN_PROVINCES_DATA) {
  const provinceKey = normalizeLocationName(province.name);
  for (const city of province.cities) {
    const cityKey = normalizeLocationName(city.name);
    CENTER_INDEX.set(`${provinceKey}::${cityKey}`, { lat: city.lat, lng: city.lng });
    if (!CENTER_INDEX.has(cityKey)) {
      CENTER_INDEX.set(cityKey, { lat: city.lat, lng: city.lng });
    }
  }
}

function findProvinceByName(provinceName: string) {
  const normalized = normalizeLocationName(provinceName);
  return IRAN_PROVINCES_DATA.find(
    (item) => normalizeLocationName(item.name) === normalized
  );
}

function findCityInProvince(
  province: (typeof IRAN_PROVINCES_DATA)[number],
  cityName: string
) {
  const normalized = normalizeLocationName(cityName);
  return province.cities.find((item) => normalizeLocationName(item.name) === normalized);
}

export function getLocationCenter(
  provinceName: string,
  cityName?: string | null
): LocationCenter {
  const province = findProvinceByName(normalizeImportedProvince(provinceName) ?? provinceName);
  if (!province) {
    return MAP_DEFAULT_CENTER;
  }

  const provinceKey = normalizeLocationName(province.name);
  const normalizedCity = cityName ? normalizeLocationName(cityName) : "";

  if (normalizedCity) {
    const exact = CENTER_INDEX.get(`${provinceKey}::${normalizedCity}`);
    if (exact) return exact;

    const cityInProvince = findCityInProvince(province, normalizedCity);
    if (cityInProvince) {
      return { lat: cityInProvince.lat, lng: cityInProvince.lng };
    }
  }

  const fallbackCity = province.cities[0];
  if (fallbackCity) {
    return { lat: fallbackCity.lat, lng: fallbackCity.lng };
  }

  return MAP_DEFAULT_CENTER;
}

export function resolveLocationNames(
  provinceName: string,
  cityName: string
): { province: string; city: string } {
  const province = normalizeImportedProvince(provinceName) ?? provinceName.trim();
  if (!province) {
    return { province: "", city: "" };
  }

  const provinceData = findProvinceByName(province);
  const cities = provinceData?.cities.map((item) => item.name) ?? getCitiesForProvince(province);
  const trimmedCity = cityName.trim();

  if (trimmedCity) {
    const match = cities.find((item) => normalizeLocationName(item) === normalizeLocationName(trimmedCity));
    if (match) return { province, city: match };
    return { province, city: trimmedCity };
  }

  return { province, city: cities[0] ?? "" };
}

export function isKnownProvince(value: string): boolean {
  return (IRAN_PROVINCES as readonly string[]).includes(value);
}
