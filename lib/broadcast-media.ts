import { isDirectAudioUrl, isDirectImageUrl, isDirectVideoUrl } from "@/lib/media-utils";
import type { BroadcastReport } from "@/lib/types";

/** Top-level report slot: PDF document vs media file (image / video / audio). */
export type BroadcastMediaType = "pdf" | "media";

/** Concrete file kind when mediaType is media. */
export type BroadcastFileKind = "video" | "image" | "audio";

const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogg)(\?|$)/i;
const AUDIO_EXT = /\.(mp3|wav|m4a|aac|mpeg|oga)(\?|$)/i;
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif)(\?|$)/i;

function looksLikeMediaUrl(url: string, fileName: string): boolean {
  if (isDirectVideoUrl(url) || isDirectAudioUrl(url) || isDirectImageUrl(url)) return true;
  return VIDEO_EXT.test(fileName) || AUDIO_EXT.test(fileName) || IMAGE_EXT.test(fileName);
}

/**
 * Resolves PDF vs media. Legacy `summaryData.mediaType === "video"` maps to `"media"`.
 */
export function resolveBroadcastMediaType(
  report: Pick<BroadcastReport, "pdfUrl" | "fileName" | "summaryData">
): BroadcastMediaType {
  const stored = report.summaryData.mediaType;
  if (stored === "media" || stored === "video") return "media";
  if (stored === "pdf") return "pdf";
  if (looksLikeMediaUrl(report.pdfUrl, report.fileName)) return "media";
  return "pdf";
}

/** Detects image / video / audio for a media report; null for PDF. */
export function resolveBroadcastFileKind(
  report: Pick<BroadcastReport, "pdfUrl" | "fileName" | "summaryData">
): BroadcastFileKind | null {
  if (resolveBroadcastMediaType(report) === "pdf") return null;

  const url = report.pdfUrl;
  const name = report.fileName;

  if (isDirectVideoUrl(url) || VIDEO_EXT.test(name)) return "video";
  if (isDirectAudioUrl(url) || AUDIO_EXT.test(name)) return "audio";
  if (isDirectImageUrl(url) || IMAGE_EXT.test(name)) return "image";

  // Legacy mediaType "video" without a clear extension
  if (report.summaryData.mediaType === "video") return "video";
  return "video";
}

export function broadcastMediaCategoryLabel(
  report: Pick<BroadcastReport, "pdfUrl" | "fileName" | "summaryData">
): string {
  const type = resolveBroadcastMediaType(report);
  if (type === "pdf") return "گزارش PDF";
  const kind = resolveBroadcastFileKind(report);
  if (kind === "image") return "تصویر پخش";
  if (kind === "audio") return "صوت پخش";
  return "ویدیو پخش";
}
