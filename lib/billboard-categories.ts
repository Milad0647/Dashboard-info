export const BILLBOARD_CATEGORIES = [
  "billboard",
  "straboard",
  "bridge",
  "urban_tv",
  "bus_metro",
  "lamp_post",
  "scaffolding",
  "fence_wall_banner",
  "stand",
  "other",
] as const;

export type BillboardCategory = (typeof BILLBOARD_CATEGORIES)[number];

export const billboardCategoryLabels: Record<BillboardCategory, string> = {
  billboard: "بیلبورد",
  straboard: "استرابورد",
  bridge: "عرشه پل",
  urban_tv: "تلویزیون شهری",
  bus_metro: "ایستگاه اتوبوس و مترو",
  lamp_post: "لم پوست",
  scaffolding: "داربست و اسپیس",
  fence_wall_banner: "بنر روی نرده و دیوار",
  stand: "استند",
  other: "سایر",
};

/**
 * Legacy DB / import keys remapped to the current taxonomy.
 * Keep in sync with the UPDATE in database/schema.sql.
 */
const legacyBillboardCategoryMap: Record<string, BillboardCategory> = {
  banner: "fence_wall_banner",
  lightbox: "other",
  monitor: "urban_tv",
  bus_shelter: "bus_metro",
  darbast: "scaffolding",
  narde: "fence_wall_banner",
  sakhteman: "fence_wall_banner",
};

export function getBillboardCategoryLabel(value: string | null | undefined): string {
  if (!value) return "نامشخص";
  const matched = matchBillboardCategoryKey(value);
  return matched ? billboardCategoryLabels[matched] : value;
}

const billboardCategoryLookup = new Map<string, BillboardCategory>(
  BILLBOARD_CATEGORIES.flatMap((key) => [
    [key, key],
    [billboardCategoryLabels[key], key],
  ])
);

/** Extra aliases seen in imports / free text (Latin + Persian variants). */
const billboardCategoryAliases: Record<string, BillboardCategory> = {
  ...legacyBillboardCategoryMap,
  "estra board": "straboard",
  estraboard: "straboard",
  "estra-board": "straboard",
  "استرا بورد": "straboard",
  استرابرد: "straboard",
  "bill board": "billboard",
  "بیلبورد شهری": "billboard",
  "light box": "other",
  "لایت باکس": "other",
  لایت‌باکس: "other",
  مانیتور: "urban_tv",
  "تلویزیون شهری": "urban_tv",
  "پل عابرپیاده": "bridge",
  "پل عابر پیاده": "bridge",
  "عرشه پل": "bridge",
  "ایستگاه اتوبوس": "bus_metro",
  "ایستگاه مترو": "bus_metro",
  مترو: "bus_metro",
  بنر: "fence_wall_banner",
  نرده: "fence_wall_banner",
  ساختمان: "fence_wall_banner",
  داربست: "scaffolding",
  اسپیس: "scaffolding",
  "داربست و اسپیس": "scaffolding",
  لمپوست: "lamp_post",
  "lamp post": "lamp_post",
  lampost: "lamp_post",
  استند: "stand",
};

export function matchBillboardCategoryKey(
  value: string | null | undefined
): BillboardCategory | null {
  const normalized = value?.trim();
  if (!normalized) return null;

  const slug = normalized.toLowerCase().replace(/-/g, "_");
  if (BILLBOARD_CATEGORIES.includes(slug as BillboardCategory)) {
    return slug as BillboardCategory;
  }

  if (legacyBillboardCategoryMap[slug]) {
    return legacyBillboardCategoryMap[slug];
  }

  const aliasKey = normalized.toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ").trim();
  if (billboardCategoryAliases[aliasKey]) {
    return billboardCategoryAliases[aliasKey];
  }
  if (billboardCategoryAliases[slug]) {
    return billboardCategoryAliases[slug];
  }
  if (billboardCategoryAliases[normalized]) {
    return billboardCategoryAliases[normalized];
  }

  return (
    billboardCategoryLookup.get(normalized) ??
    billboardCategoryLookup.get(slug) ??
    billboardCategoryLookup.get(aliasKey) ??
    null
  );
}

function findCategoryLabelInTags(tags: string[]): string | null {
  const knownLabels = new Set(Object.values(billboardCategoryLabels));

  for (const tag of tags) {
    const trimmed = tag.trim();
    if (!trimmed || trimmed.startsWith("map:") || trimmed.startsWith("assignment:")) continue;
    if (knownLabels.has(trimmed)) return trimmed;

    const matched = matchBillboardCategoryKey(trimmed);
    if (matched) return billboardCategoryLabels[matched];
  }

  return null;
}

export function resolveBillboardCategoryDisplay(billboard: {
  category?: string | null;
  billboardTypeLabel?: string | null;
  tags?: string[];
}): string | null {
  const categoryKey = matchBillboardCategoryKey(billboard.category);
  if (categoryKey) return billboardCategoryLabels[categoryKey];

  const typeLabel = billboard.billboardTypeLabel?.trim();
  if (typeLabel) {
    const fromLabel = matchBillboardCategoryKey(typeLabel);
    return fromLabel ? billboardCategoryLabels[fromLabel] : typeLabel;
  }

  if (billboard.tags?.length) {
    return findCategoryLabelInTags(billboard.tags);
  }

  return null;
}

export function resolveBillboardCategoryLabel(billboard: {
  category?: string | null;
  billboardTypeLabel?: string | null;
  tags?: string[];
}): string {
  return resolveBillboardCategoryDisplay(billboard) ?? "نامشخص";
}
