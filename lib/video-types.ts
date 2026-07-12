import type { MediaCategory } from "@/lib/types";

export const VIDEO_TYPE_TITLES = ["تیزر", "انیمیشن", "موشن‌گرافیک"] as const;

export type VideoTypeTitle = (typeof VIDEO_TYPE_TITLES)[number];

export function isVideoTypeTitle(value: string): value is VideoTypeTitle {
  return (VIDEO_TYPE_TITLES as readonly string[]).includes(value);
}

export function findVideoTypeCategory(
  categories: MediaCategory[],
  title: string
): MediaCategory | undefined {
  const normalized = title.trim();
  return categories.find((category) => category.title.trim() === normalized);
}

export function pickDefaultVideoCategoryId(categories: MediaCategory[]): string {
  for (const title of VIDEO_TYPE_TITLES) {
    const match = findVideoTypeCategory(categories, title);
    if (match) return match.id;
  }
  return categories[0]?.id ?? "";
}

export function videoTypeSelectOptions(categories: MediaCategory[]): MediaCategory[] {
  const preferred = VIDEO_TYPE_TITLES.map((title) => findVideoTypeCategory(categories, title)).filter(
    (category): category is MediaCategory => Boolean(category)
  );
  if (preferred.length > 0) return preferred;
  return [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
}
