"use client";

import { useMemo, useState } from "react";
import { Download, Eye, FileText, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ImageZoom } from "@/components/ui/image-zoom";
import { VideoModal } from "@/components/media/video-modal";
import { VideoThumbnail } from "@/components/media/video-thumbnail";
import { resolveBroadcastMediaType } from "@/lib/broadcast-media";
import { downloadMedia, getFilenameFromUrl } from "@/lib/media-utils";
import type { BroadcastReport, RawMediaUpload, VideoVersion } from "@/lib/types";
import { formatPersianDateTime } from "@/lib/utils";

type DownloadableItem =
  | { kind: "raw_media"; item: RawMediaUpload }
  | { kind: "broadcast"; item: BroadcastReport };

interface SectionDownloadableContentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  sectionLabel: string;
  items: DownloadableItem[];
}

function toBroadcastVideoVersion(report: BroadcastReport): VideoVersion {
  const cover = report.summaryData.coverImageUrl?.trim();
  return {
    id: report.id,
    videoId: report.id,
    versionNumber: 1,
    videoUrl: report.pdfUrl,
    thumbnailUrl: cover || report.pdfUrl,
    status: "final",
    isFinal: true,
    date: report.reportDate,
    createdAt: report.createdAt,
  };
}

function getItemTitle(entry: DownloadableItem): string {
  return entry.item.title;
}

function getItemThumbnail(entry: DownloadableItem): string | null {
  if (entry.kind === "raw_media") {
    return entry.item.mediaKind === "image" ? entry.item.fileUrl : null;
  }
  if (resolveBroadcastMediaType(entry.item) === "video") {
    return entry.item.summaryData.coverImageUrl?.trim() || null;
  }
  return null;
}

function getItemBadge(entry: DownloadableItem): string {
  if (entry.kind === "raw_media") {
    return entry.item.mediaKind === "video" ? "ویدیو خام" : "تصویر خام";
  }
  return resolveBroadcastMediaType(entry.item) === "video" ? "ویدیو پخش" : "گزارش PDF";
}

export function SectionDownloadableContentModal({
  open,
  onOpenChange,
  title,
  sectionLabel,
  items,
}: SectionDownloadableContentModalProps) {
  const [selected, setSelected] = useState<DownloadableItem | null>(null);

  const sortedItems = useMemo(
    () =>
      [...items].sort((a, b) => getItemTitle(a).localeCompare(getItemTitle(b), "fa")),
    [items]
  );

  const selectedBroadcastVideo =
    selected?.kind === "broadcast" && resolveBroadcastMediaType(selected.item) === "video"
      ? selected.item
      : null;

  const selectedRawImage =
    selected?.kind === "raw_media" && selected.item.mediaKind === "image" ? selected.item : null;

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) setSelected(null);
          onOpenChange(next);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle className="break-words">
              {sectionLabel} — {title}
            </DialogTitle>
          </DialogHeader>

          {sortedItems.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              موردی برای نمایش یافت نشد.
            </p>
          ) : (
            <ul className="space-y-3">
              {sortedItems.map((entry) => {
                const itemTitle = getItemTitle(entry);
                const thumbnailUrl = getItemThumbnail(entry);
                const isBroadcastVideo =
                  entry.kind === "broadcast" &&
                  resolveBroadcastMediaType(entry.item) === "video";
                const isRawVideo =
                  entry.kind === "raw_media" && entry.item.mediaKind === "video";

                return (
                  <li key={`${entry.kind}-${entry.item.id}`}>
                    <button
                      type="button"
                      className="apple-press flex w-full max-w-full items-center gap-3 rounded-lg border p-3 text-right hover:border-primary/50 hover:bg-muted/40 hover:shadow-sm"
                      onClick={() => {
                        if (entry.kind === "raw_media" && entry.item.mediaKind === "video") {
                          window.open(entry.item.fileUrl, "_blank", "noopener,noreferrer");
                          return;
                        }
                        if (
                          entry.kind === "broadcast" &&
                          resolveBroadcastMediaType(entry.item) === "pdf"
                        ) {
                          window.open(entry.item.pdfUrl, "_blank", "noopener,noreferrer");
                          return;
                        }
                        setSelected(entry);
                      }}
                    >
                      {thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumbnailUrl}
                          alt={itemTitle}
                          className="h-14 w-14 shrink-0 rounded-md object-cover"
                        />
                      ) : isBroadcastVideo || isRawVideo ? (
                        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
                          <VideoThumbnail
                            videoUrl={
                              entry.kind === "broadcast"
                                ? entry.item.pdfUrl
                                : entry.item.fileUrl
                            }
                            thumbnailUrl={
                              entry.kind === "broadcast"
                                ? entry.item.summaryData.coverImageUrl
                                : undefined
                            }
                            alt={itemTitle}
                            className="h-full w-full object-cover"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                            <Play className="h-4 w-4 text-white" />
                          </div>
                        </div>
                      ) : (
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                          <FileText className="h-5 w-5" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="break-words text-sm font-medium">{itemTitle}</p>
                        <Badge variant="outline" className="text-[10px]">
                          {getItemBadge(entry)}
                        </Badge>
                        {entry.item.createdAt ? (
                          <p className="text-[10px] text-muted-foreground">
                            ثبت: {formatPersianDateTime(entry.item.createdAt)}
                          </p>
                        ) : null}
                      </div>
                      <Eye className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      {selectedRawImage && (
        <Dialog open onOpenChange={(next) => !next && setSelected(null)}>
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto overflow-x-hidden">
            <DialogHeader>
              <DialogTitle className="break-words">{selectedRawImage.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <ImageZoom
                src={selectedRawImage.fileUrl}
                alt={selectedRawImage.title}
                className="w-full rounded-lg bg-muted"
                imgClassName="max-h-[70vh] w-full object-contain"
              />
              {selectedRawImage.createdAt ? (
                <p className="text-xs text-muted-foreground">
                  ثبت: {formatPersianDateTime(selectedRawImage.createdAt)}
                </p>
              ) : null}
              <Button
                type="button"
                className="w-full"
                onClick={() => {
                  void downloadMedia(
                    selectedRawImage.fileUrl,
                    getFilenameFromUrl(selectedRawImage.fileUrl, selectedRawImage.fileName)
                  );
                }}
              >
                <Download className="h-4 w-4" />
                دانلود فایل
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {selectedBroadcastVideo && (
        <VideoModal
          open
          onOpenChange={(next) => {
            if (!next) setSelected(null);
          }}
          title={selectedBroadcastVideo.title}
          versions={[toBroadcastVideoVersion(selectedBroadcastVideo)]}
          initialVersionId={selectedBroadcastVideo.id}
          ownerName={selectedBroadcastVideo.ownerName}
          createdAt={selectedBroadcastVideo.createdAt}
        />
      )}
    </>
  );
}
