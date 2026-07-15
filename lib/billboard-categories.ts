export const BILLBOARD_CATEGORIES = [
  "straboard",
  "banner",
  "billboard",
  "lightbox",
  "monitor",
  "bridge",
  "bus_shelter",
  "darbast",
  "narde",
  "sakhteman",
  "other",
] as const;

export type BillboardCategory = (typeof BILLBOARD_CATEGORIES)[number];

export const billboardCategoryLabels: Record<BillboardCategory, string> = {
  straboard: "استرابورد",
  banner: "بنر",
  billboard: "بیلبورد",
  lightbox: "لایت‌باکس",
  monitor: "مانیتور",
  bridge: "پل عابرپیاده",
  bus_shelter: "ایستگاه اتوبوس",
  darbast: "داربست",
  narde: "نرده",
  sakhteman: "ساختمان",
  other: "سایر",
};

export function getBillboardCategoryLabel(value: string | null | undefined): string {
  if (!value) return "نامشخص";
  return billboardCategoryLabels[value as BillboardCategory] ?? value;
}

const billboardCategoryLookup = new Map<string, BillboardCategory>(
  BILLBOARD_CATEGORIES.flatMap((key) => [
    [key, key],
    [billboardCategoryLabels[key], key],
  ])
);

/** Extra aliases seen in imports / free text (Latin + Persian variants). */
const billboardCategoryAliases: Record<string, BillboardCategory> = {
  "estra board": "straboard",
  estraboard: "straboard",
  "estra-board": "straboard",
  "استرا بورد": "straboard",
  استرابرد: "straboard",
  "bill board": "billboard",
  "بیلبورد شهری": "billboard",
  "light box": "lightbox",
  "لایت باکس": "lightbox",
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

  const aliasKey = normalized.toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ").trim();
  if (billboardCategoryAliases[aliasKey]) {
    return billboardCategoryAliases[aliasKey];
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
