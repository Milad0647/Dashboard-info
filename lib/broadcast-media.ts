import { isDirectVideoUrl } from "@/lib/media-utils";
import type { BroadcastReport } from "@/lib/types";

export type BroadcastMediaType = "pdf" | "video";

export function resolveBroadcastMediaType(
  report: Pick<BroadcastReport, "pdfUrl" | "fileName" | "summaryData">
): BroadcastMediaType {
  if (report.summaryData.mediaType === "video" || report.summaryData.mediaType === "pdf") {
    return report.summaryData.mediaType;
  }
  if (isDirectVideoUrl(report.pdfUrl)) return "video";
  if (/\.(mp4|webm|mov|ogg)(\?|$)/i.test(report.fileName)) return "video";
  return "pdf";
}
