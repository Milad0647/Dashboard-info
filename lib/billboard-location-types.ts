export const BILLBOARD_LOCATION_TYPES = [
  { key: "highway", label: "بزرگراه" },
  { key: "boulevard", label: "بلوار" },
  { key: "main_street", label: "خیابان اصلی" },
  { key: "square", label: "میدان" },
  { key: "metro", label: "مترو" },
  { key: "bus_station", label: "ایستگاه اتوبوس" },
  { key: "other", label: "سایر" },
] as const;

export type BillboardLocationTypeKey = (typeof BILLBOARD_LOCATION_TYPES)[number]["key"];

export const BILLBOARD_LOCATION_TYPE_KEYS = BILLBOARD_LOCATION_TYPES.map((item) => item.key);

export function isBillboardLocationTypeKey(value: string): value is BillboardLocationTypeKey {
  return BILLBOARD_LOCATION_TYPE_KEYS.includes(value as BillboardLocationTypeKey);
}

export interface MapPlaceHints {
  osmClass?: string | null;
  osmType?: string | null;
  addresstype?: string | null;
  name?: string | null;
  road?: string | null;
  amenity?: string | null;
  displayName?: string | null;
}

function normalizeFa(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\u064A/g, "\u06CC")
    .replace(/\u0643/g, "\u06A9")
    .replace(/\u200C/g, " ");
}

function combinedText(hints: MapPlaceHints): string {
  return normalizeFa(
    [hints.name, hints.road, hints.amenity, hints.displayName, hints.addresstype]
      .filter(Boolean)
      .join(" ")
  );
}

const MOTORWAY_TYPES = new Set([
  "motorway",
  "motorway_link",
  "trunk",
  "trunk_link",
]);

const MAIN_ROAD_TYPES = new Set([
  "primary",
  "primary_link",
  "secondary",
  "secondary_link",
  "tertiary",
  "tertiary_link",
  "unclassified",
  "residential",
  "living_street",
  "pedestrian",
  "service",
  "road",
]);

export function inferBillboardLocationType(hints: MapPlaceHints): BillboardLocationTypeKey | null {
  const haystack = combinedText(hints);
  const osmClass = normalizeFa(hints.osmClass ?? "");
  const osmType = normalizeFa(hints.osmType ?? "");
  const addresstype = normalizeFa(hints.addresstype ?? "");
  const amenity = normalizeFa(hints.amenity ?? "");

  if (
    haystack.includes("مترو") ||
    haystack.includes("metro") ||
    haystack.includes("subway") ||
    osmClass === "railway" ||
    osmType.includes("subway") ||
    addresstype.includes("subway") ||
    addresstype.includes("metro")
  ) {
    return "metro";
  }

  if (
    haystack.includes("ایستگاه اتوبوس") ||
    haystack.includes("اتوبوس") ||
    haystack.includes("bus station") ||
    haystack.includes("bus_station") ||
    amenity === "bus_station" ||
    osmType === "bus_station" ||
    osmType === "bus_stop" ||
    addresstype === "bus_stop"
  ) {
    return "bus_station";
  }

  if (
    haystack.includes("میدان") ||
    haystack.includes("square") ||
    haystack.includes("plaza") ||
    osmType === "square" ||
    addresstype === "square"
  ) {
    return "square";
  }

  if (
    haystack.includes("بزرگراه") ||
    haystack.includes("ازادراه") ||
    haystack.includes("آزادراه") ||
    haystack.includes("freeway") ||
    haystack.includes("motorway") ||
    haystack.includes("highway") ||
    MOTORWAY_TYPES.has(osmType)
  ) {
    return "highway";
  }

  if (haystack.includes("بلوار") || haystack.includes("boulevard")) {
    return "boulevard";
  }

  if (
    haystack.includes("خیابان") ||
    haystack.includes("كوچه") ||
    haystack.includes("کوچه") ||
    haystack.includes("street") ||
    osmClass === "highway" ||
    addresstype === "road" ||
    MAIN_ROAD_TYPES.has(osmType)
  ) {
    return "main_street";
  }

  return null;
}
