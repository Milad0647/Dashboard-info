export const PUBLIC_MEDIA_GRID_CLASS =
  "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6";

export const PUBLIC_MEDIA_PAGE_SIZE = 18;
export const PUBLIC_MEDIA_MOBILE_INITIAL = 3;
export const PUBLIC_MEDIA_MOBILE_PAGE_SIZE = 3;
export const PUBLIC_MEDIA_MOBILE_QUERY = "(max-width: 639px)";

export type PublicMediaSort = "default" | "title" | "newest";

export function sortByPublicMediaOrder<T extends { title: string; sortOrder: number }>(
  items: T[],
  sort: PublicMediaSort,
  getLatestDate?: (item: T) => string | undefined
): T[] {
  const copy = [...items];

  if (sort === "title") {
    return copy.sort((a, b) => a.title.localeCompare(b.title, "fa"));
  }

  if (sort === "newest") {
    return copy.sort((a, b) => {
      const dateA = getLatestDate?.(a) ?? "";
      const dateB = getLatestDate?.(b) ?? "";
      return dateB.localeCompare(dateA);
    });
  }

  return copy.sort((a, b) => a.sortOrder - b.sortOrder);
}
