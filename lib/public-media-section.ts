export const PUBLIC_MEDIA_GRID_CLASS =
  "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6";

export const PUBLIC_MEDIA_MAX_ROWS = 2;

export function getPublicMediaColumnCount(width: number): number {
  if (width >= 1280) return 6;
  if (width >= 1024) return 5;
  if (width >= 768) return 4;
  if (width >= 640) return 3;
  return 2;
}

export function getPublicMediaPageSize(width: number): number {
  return getPublicMediaColumnCount(width) * PUBLIC_MEDIA_MAX_ROWS;
}

/** @deprecated Use getPublicMediaPageSize(width) for viewport-aware sizing */
export const PUBLIC_MEDIA_PAGE_SIZE = 18;

export const PUBLIC_MEDIA_MOBILE_INITIAL = 6;
export const PUBLIC_MEDIA_MOBILE_PAGE_SIZE = 6;
export const SOCIAL_ANALYTICS_PAGE_SIZE = 6;
export const PUBLIC_MEDIA_MOBILE_QUERY = "(max-width: 639px)";

export function posterHasDisplayContent(poster: { versions: { imageUrl?: string | null }[] }): boolean {
  return poster.versions.some((version) => Boolean(version.imageUrl?.trim()));
}

export function videoHasDisplayContent(video: { versions: { videoUrl?: string | null }[] }): boolean {
  return video.versions.some((version) => Boolean(version.videoUrl?.trim()));
}

export function billboardHasDisplayContent(billboard: { thumbnailUrl?: string | null }): boolean {
  const url = billboard.thumbnailUrl?.trim() ?? "";
  if (!url) return false;
  return !url.includes("placeholder");
}

export function activityHasDisplayContent(activity: {
  imageUrl?: string | null;
  videoUrl?: string | null;
  mediaItems?: { url: string }[];
}): boolean {
  if (activity.mediaItems?.some((item) => item.url.trim())) return true;
  return Boolean(activity.imageUrl?.trim() || activity.videoUrl?.trim());
}

export type PublicMediaSort = "default" | "title" | "newest" | "oldest" | "top_scored";

export function resolvePublicMediaSort(
  globalSort: string,
  localSort: PublicMediaSort
): PublicMediaSort {
  if (globalSort === "newest" || globalSort === "oldest" || globalSort === "top_scored") {
    return globalSort;
  }
  return localSort;
}

export function sortByPublicMediaOrder<T extends { title: string; sortOrder: number; score?: number | null }>(
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

  if (sort === "oldest") {
    return copy.sort((a, b) => {
      const dateA = getLatestDate?.(a) ?? "";
      const dateB = getLatestDate?.(b) ?? "";
      return dateA.localeCompare(dateB);
    });
  }

  if (sort === "top_scored") {
    return copy
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
      .slice(0, 5);
  }

  return copy.sort((a, b) => a.sortOrder - b.sortOrder);
}
