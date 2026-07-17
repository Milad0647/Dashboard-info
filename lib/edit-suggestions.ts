import type { Poster, PosterVersion, Video, VideoVersion } from "@/lib/types";

export type EditSuggestionContentType = "poster" | "video";
export type EditSuggestionMissingField = "title" | "description" | "media";

export interface EditSuggestionItem {
  id: string;
  contentType: EditSuggestionContentType;
  title: string;
  ownerName?: string | null;
  missingFields: EditSuggestionMissingField[];
  editHref: string;
}

const MISSING_FIELD_VALUES = new Set<EditSuggestionMissingField>([
  "title",
  "description",
  "media",
]);

export function buildEditSuggestionHref(
  contentType: EditSuggestionContentType,
  campaignId: string,
  id: string,
  missingFields: EditSuggestionMissingField[]
): string {
  const basePath = contentType === "poster" ? "/admin/posters" : "/admin/videos";
  const params = new URLSearchParams({
    campaign: campaignId,
    edit: id,
  });
  if (missingFields.length > 0) {
    params.set("missing", missingFields.join(","));
  }
  return `${basePath}?${params.toString()}`;
}

export function parseEditSuggestionMissingFields(
  value: string | null | undefined
): EditSuggestionMissingField[] {
  if (!value?.trim()) return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part): part is EditSuggestionMissingField =>
      MISSING_FIELD_VALUES.has(part as EditSuggestionMissingField)
    );
}

interface BuildEditSuggestionsInput {
  campaignId: string;
  ownerUserId: string;
  posters: Poster[];
  posterVersions: PosterVersion[];
  videos: Video[];
  videoVersions: VideoVersion[];
}

const DEFAULT_POSTER_TITLE_PATTERN = /^پوستر\s+\d+$/;
const DEFAULT_VIDEO_TITLE_PATTERN = /^ویدیو\s+\d+$/;

export const editSuggestionFieldLabels: Record<EditSuggestionMissingField, string> = {
  title: "عنوان اختصاصی",
  description: "توضیحات",
  media: "رسانه",
};

export const editSuggestionContentTypeLabels: Record<EditSuggestionContentType, string> = {
  poster: "پوستر",
  video: "ویدیو",
};

export function isDefaultPosterTitle(title: string): boolean {
  return DEFAULT_POSTER_TITLE_PATTERN.test(title.trim());
}

export function isDefaultVideoTitle(title: string): boolean {
  return DEFAULT_VIDEO_TITLE_PATTERN.test(title.trim());
}

function groupVersionsByContentId<T extends { posterId?: string; videoId?: string }>(
  versions: T[],
  getContentId: (version: T) => string
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const version of versions) {
    const contentId = getContentId(version);
    const list = map.get(contentId) ?? [];
    list.push(version);
    map.set(contentId, list);
  }
  return map;
}

function hasPosterMedia(versions: PosterVersion[]): boolean {
  return versions.some((version) => Boolean(version.imageUrl?.trim()));
}

function hasVideoMedia(versions: VideoVersion[]): boolean {
  return versions.some((version) => Boolean(version.videoUrl?.trim()));
}

function getPosterMissingFields(poster: Poster, versions: PosterVersion[]): EditSuggestionMissingField[] {
  const fields: EditSuggestionMissingField[] = [];

  if (isDefaultPosterTitle(poster.title)) fields.push("title");
  if (!poster.description?.trim()) fields.push("description");
  if (!hasPosterMedia(versions)) fields.push("media");

  return fields;
}

function getVideoMissingFields(video: Video, versions: VideoVersion[]): EditSuggestionMissingField[] {
  const fields: EditSuggestionMissingField[] = [];

  if (isDefaultVideoTitle(video.title)) fields.push("title");
  if (!video.description?.trim()) fields.push("description");
  if (!hasVideoMedia(versions)) fields.push("media");

  return fields;
}

export function buildEditSuggestions({
  campaignId,
  ownerUserId,
  posters,
  posterVersions,
  videos,
  videoVersions,
}: BuildEditSuggestionsInput): EditSuggestionItem[] {
  const posterVersionsByPosterId = groupVersionsByContentId(
    posterVersions,
    (version) => version.posterId
  );
  const videoVersionsByVideoId = groupVersionsByContentId(videoVersions, (version) => version.videoId);

  const posterSuggestions = posters
    .filter((poster) => poster.ownerUserId === ownerUserId)
    .map((poster) => {
      const missingFields = getPosterMissingFields(
        poster,
        posterVersionsByPosterId.get(poster.id) ?? []
      );
      return {
        id: poster.id,
        contentType: "poster" as const,
        title: poster.title,
        ownerName: poster.ownerName,
        missingFields,
        editHref: buildEditSuggestionHref("poster", campaignId, poster.id, missingFields),
      };
    })
    .filter((suggestion) => suggestion.missingFields.length > 0);

  const videoSuggestions = videos
    .filter((video) => video.ownerUserId === ownerUserId)
    .map((video) => {
      const missingFields = getVideoMissingFields(
        video,
        videoVersionsByVideoId.get(video.id) ?? []
      );
      return {
        id: video.id,
        contentType: "video" as const,
        title: video.title,
        ownerName: video.ownerName,
        missingFields,
        editHref: buildEditSuggestionHref("video", campaignId, video.id, missingFields),
      };
    })
    .filter((suggestion) => suggestion.missingFields.length > 0);

  return [...posterSuggestions, ...videoSuggestions];
}
