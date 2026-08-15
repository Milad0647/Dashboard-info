import type { Video, VideoContentType } from "@/lib/types";

export const VIDEO_CONTENT_TYPES: VideoContentType[] = [
  "news",
  "news_report",
  "live",
  "news_interview",
  "program_appearance",
  "tv_contest",
];

export const videoContentTypeLabels: Record<VideoContentType, string> = {
  news: "خبر",
  news_report: "گزارش خبری",
  live: "پخش زنده",
  news_interview: "مصاحبه خبری",
  program_appearance: "حضور در برنامه",
  tv_contest: "مسابقه تلویزیونی",
};

const videoContentTypeSet = new Set<string>(VIDEO_CONTENT_TYPES);

export function isVideoContentType(value: string | null | undefined): value is VideoContentType {
  return Boolean(value && videoContentTypeSet.has(value));
}

export function getVideoContentTypeLabel(type: string | null | undefined): string {
  if (!isVideoContentType(type)) return "";
  return videoContentTypeLabels[type];
}

export function resolveVideoContentType(
  value: string | null | undefined
): VideoContentType {
  return isVideoContentType(value) ? value : "news";
}

/** Badge label: content type when set, else media category title. */
export function getVideoCategoryLabel(
  video: Pick<Video, "videoContentType"> & { category?: { title?: string } | null }
): string {
  const contentLabel = getVideoContentTypeLabel(video.videoContentType);
  if (contentLabel) return contentLabel;
  return video.category?.title?.trim() || "";
}
