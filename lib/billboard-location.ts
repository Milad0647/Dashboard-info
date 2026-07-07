import { parseProvinceFromBillboard } from "@/lib/billboard-form-utils";
import type { Billboard } from "@/lib/types";

function normalizePart(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function isDuplicatePart(part: string, ...others: string[]): boolean {
  const normalized = part.trim();
  if (!normalized) return true;
  return others.some((other) => other.trim() === normalized);
}

export function formatBillboardCityLine(billboard: Billboard): string {
  const province = parseProvinceFromBillboard(billboard);
  const city = normalizePart(billboard.city);
  const showCity = city && !isDuplicatePart(city, province);

  if (province && showCity) return `${province} — ${city}`;
  if (province) return province;
  if (showCity) return city;
  return city || "نامشخص";
}

export function formatBillboardLocationLine(billboard: Billboard): string {
  const cityLine = formatBillboardCityLine(billboard);
  const location = normalizePart(billboard.location);
  const address = normalizePart(billboard.description);

  if (location && !isDuplicatePart(location, cityLine, billboard.city ?? "", provinceFromLine(cityLine))) {
    return `${cityLine} — ${location}`;
  }

  if (address && !isDuplicatePart(address, cityLine, location)) {
    return `${cityLine} — ${address}`;
  }

  return cityLine;
}

function provinceFromLine(cityLine: string): string {
  const [province] = cityLine.split(" — ");
  return province?.trim() ?? "";
}
