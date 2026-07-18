export const PUBLIC_MEDIA_GRID_CLASS =
  "grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

export const PUBLIC_MEDIA_MAX_ROWS = 3;

/** Initial / load-more page size: 3 rows × 4 cards on desktop. */
export const PUBLIC_MEDIA_PAGE_SIZE = 12;

export function getPublicMediaColumnCount(width: number): number {
  if (width >= 1280) return 4;
  if (width >= 1024) return 3;
  if (width >= 640) return 2;
  return 1;
}

export function getPublicMediaPageSize(): number {
  return PUBLIC_MEDIA_PAGE_SIZE;
}

export const PUBLIC_MEDIA_MOBILE_INITIAL = PUBLIC_MEDIA_PAGE_SIZE;
export const PUBLIC_MEDIA_MOBILE_PAGE_SIZE = PUBLIC_MEDIA_PAGE_SIZE;
export const SOCIAL_ANALYTICS_PAGE_SIZE = PUBLIC_MEDIA_PAGE_SIZE;
export const PUBLIC_MEDIA_MOBILE_QUERY = "(max-width: 639px)";

export function posterHasDisplayContent(poster: { versions: { imageUrl?: string | null }[] }): boolean {
  return poster.versions.some((version) => Boolean(version.imageUrl?.trim()));
}

export function videoHasDisplayContent(video: { versions: { videoUrl?: string | null }[] }): boolean {
  return video.versions.some((version) => Boolean(version.videoUrl?.trim()));
}

export function billboardHasDisplayContent(billboard: {
  thumbnailUrl?: string | null;
  imageUrl?: string | null;
  location?: string | null;
  description?: string | null;
}): boolean {
  const hasAddress = Boolean(billboard.location?.trim() || billboard.description?.trim());
  const imageUrl = billboard.imageUrl?.trim() ?? "";
  const thumbnailUrl = billboard.thumbnailUrl?.trim() ?? "";
  const candidate = imageUrl || thumbnailUrl;
  const hasImage =
    Boolean(candidate) &&
    !candidate.includes("placeholder") &&
    candidate !== "/images/billboard-placeholder.svg";

  return hasAddress || hasImage;
}

export function activityHasDisplayContent(activity: {
  imageUrl?: string | null;
  videoUrl?: string | null;
  mediaItems?: { url: string }[];
  attachments?: { fileUrl: string }[];
}): boolean {
  if (activity.mediaItems?.some((item) => item.url.trim())) return true;
  if (activity.attachments?.some((item) => item.fileUrl.trim())) return true;
  return Boolean(activity.imageUrl?.trim() || activity.videoUrl?.trim());
}

/** Press / newspaper cards need an image or an external link. */
export function pressPublicationHasDisplayContent(activity: {
  imageUrl?: string | null;
  link?: string | null;
  mediaItems?: { type?: string; url: string }[];
}): boolean {
  if (activity.link?.trim()) return true;
  if (activity.imageUrl?.trim()) return true;
  return Boolean(
    activity.mediaItems?.some((item) => item.type === "image" && item.url.trim())
  );
}

export function socialPostHasDisplayContent(post: { link?: string | null }): boolean {
  return Boolean(post.link?.trim());
}

export function meetingHasDisplayContent(meeting: { imageUrl?: string | null }): boolean {
  return Boolean(meeting.imageUrl?.trim());
}

export function fileHasDisplayContent(file: { fileUrl?: string | null }): boolean {
  return Boolean(file.fileUrl?.trim());
}

export function broadcastHasDisplayContent(report: { pdfUrl?: string | null }): boolean {
  return Boolean(report.pdfUrl?.trim());
}

import type { DataOwnerGroup } from "@/lib/types";

export function filterGroupsByDisplayContent<T>(
  groups: DataOwnerGroup<T>[],
  hasContent: (item: T) => boolean
): DataOwnerGroup<T>[] {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter(hasContent),
    }))
    .filter((group) => group.items.length > 0);
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
