"use client";

import { useState } from "react";
import { Download, FileText, Radio } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ImageZoom } from "@/components/ui/image-zoom";
import { LightboxModal } from "@/components/media/lightbox-modal";
import { VideoModal } from "@/components/media/video-modal";
import { BillboardModal } from "@/components/public/billboard-modal";
import { BillboardThumbnail } from "@/components/public/billboard-thumbnail";
import {
  getBillboardCardImage,
  hasBillboardDisplayImage,
} from "@/lib/billboards";
import { downloadMedia, getFilenameFromUrl, resolveDisplayVersion, resolveVideoThumbnail } from "@/lib/media-utils";
import {
  getTodayUploadCreatedAt,
  getTodayUploadTitle,
  type TodayUploadListItem,
} from "@/lib/upload-activity-stats";
import { formatPersianDateTime, formatPersianNumber } from "@/lib/utils";

interface TodayUploadsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: TodayUploadListItem[];
}

type SelectedContent =
  | { kind: "poster"; item: Extract<TodayUploadListItem, { kind: "poster" }> }
  | { kind: "video"; item: Extract<TodayUploadListItem, { kind: "video" }> }
  | { kind: "billboard"; item: Extract<TodayUploadListItem, { kind: "billboard" }> }
  | { kind: "image"; title: string; imageUrl: string; description?: string | null }
  | { kind: "broadcast"; item: Extract<TodayUploadListItem, { kind: "broadcast" }> }
  | { kind: "meeting"; item: Extract<TodayUploadListItem, { kind: "meeting" }> }
  | { kind: "file"; item: Extract<TodayUploadListItem, { kind: "file" }> };

function getListItemKey(item: TodayUploadListItem): string {
  return `${item.kind}-${item.item.id}`;
}

function getThumbnailUrl(item: TodayUploadListItem): string | null {
  switch (item.kind) {
    case "poster": {
      const version = resolveDisplayVersion(item.item.versions);
      return version?.thumbnailUrl?.trim() || version?.imageUrl?.trim() || null;
    }
    case "video": {
      const version = resolveDisplayVersion(item.item.versions);
      if (!version) return null;
      return resolveVideoThumbnail(version.videoUrl, version.thumbnailUrl);
    }
    case "billboard":
      return hasBillboardDisplayImage(item.item) ? getBillboardCardImage(item.item) : null;
    case "social_post":
    case "site_publication":
      return item.item.coverImageUrl?.trim() || item.item.mediaUrl?.trim() || null;
    case "activity":
      return item.item.imageUrl?.trim() || item.item.mediaItems[0]?.url?.trim() || null;
    case "broadcast":
      return item.item.summaryData.coverImageUrl?.trim() || null;
    case "meeting":
      return item.item.imageUrl?.trim() || null;
    case "file":
      return null;
  }
}

export function TodayUploadsModal({ open, onOpenChange, items }: TodayUploadsModalProps) {
  const [selected, setSelected] = useState<SelectedContent | null>(null);

  const handleSelect = (item: TodayUploadListItem) => {
    switch (item.kind) {
      case "poster":
        setSelected({ kind: "poster", item });
        return;
      case "video":
        setSelected({ kind: "video", item });
        return;
      case "billboard":
        setSelected({ kind: "billboard", item });
        return;
      case "social_post":
      case "site_publication":
        setSelected({
          kind: "image",
          title: item.item.title,
          imageUrl: item.item.coverImageUrl?.trim() || item.item.mediaUrl?.trim() || "",
          description: item.item.description,
        });
        return;
      case "activity":
        setSelected({
          kind: "image",
          title: item.item.title,
          imageUrl:
            item.item.imageUrl?.trim() ||
            item.item.mediaItems.find((media) => media.type === "image")?.url?.trim() ||
            "",
          description: item.item.description,
        });
        return;
      case "broadcast":
        setSelected({ kind: "broadcast", item });
        return;
      case "meeting":
        setSelected({ kind: "meeting", item });
        return;
      case "file":
        setSelected({ kind: "file", item });
    }
  };

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
            <DialogTitle>
              آپلودهای امروز ({formatPersianNumber(items.length)})
            </DialogTitle>
          </DialogHeader>

          {items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              امروز هنوز محتوایی آپلود نشده است.
            </p>
          ) : (
            <ul className="space-y-3">
              {items.map((item) => {
                const thumbnailUrl = getThumbnailUrl(item);
                const title = getTodayUploadTitle(item);
                const createdAt = getTodayUploadCreatedAt(item);

                return (
                  <li key={getListItemKey(item)}>
                    <button
                      type="button"
                      className="apple-press flex w-full max-w-full items-center gap-3 rounded-lg border p-3 text-right hover:border-primary/50 hover:bg-muted/40 hover:shadow-sm"
                      onClick={() => handleSelect(item)}
                    >
                      {thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumbnailUrl}
                          alt={title}
                          className="h-14 w-14 shrink-0 rounded-md object-cover"
                        />
                      ) : item.kind === "billboard" ? (
                        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
                          <BillboardThumbnail
                            billboard={item.item}
                            alt={title}
                            sizes="56px"
                          />
                        </div>
                      ) : (
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                          {item.kind === "file" ? (
                            <FileText className="h-5 w-5" />
                          ) : item.kind === "broadcast" ? (
                            <Radio className="h-5 w-5" />
                          ) : (
                            <span className="text-[10px]">{item.label}</span>
                          )}
                        </div>
                      )}
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="break-words text-sm font-medium">{title}</p>
                        <Badge variant="outline" className="text-[10px]">
                          {item.label}
                        </Badge>
                        {createdAt ? (
                          <p className="text-[10px] text-muted-foreground">
                            ثبت: {formatPersianDateTime(createdAt)}
                          </p>
                        ) : null}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      {selected?.kind === "poster" && (
        <LightboxModal
          open
          onOpenChange={(next) => {
            if (!next) setSelected(null);
          }}
          title={selected.item.item.title}
          versions={selected.item.item.versions}
          initialVersionId={selected.item.item.versions[0]?.id ?? ""}
          description={selected.item.item.description}
          category={selected.item.item.category?.title ?? null}
          ownerName={selected.item.item.ownerName}
          createdAt={selected.item.item.createdAt}
        />
      )}

      {selected?.kind === "video" && (
        <VideoModal
          open
          onOpenChange={(next) => {
            if (!next) setSelected(null);
          }}
          title={selected.item.item.title}
          versions={selected.item.item.versions}
          initialVersionId={selected.item.item.versions[0]?.id ?? ""}
          description={selected.item.item.description}
          category={selected.item.item.category?.title ?? null}
          ownerName={selected.item.item.ownerName}
          createdAt={selected.item.item.createdAt}
        />
      )}

      {selected?.kind === "billboard" && (
        <BillboardModal
          open
          onOpenChange={(next) => {
            if (!next) setSelected(null);
          }}
          billboard={selected.item.item}
        />
      )}

      {selected?.kind === "image" && (
        <Dialog open onOpenChange={(next) => !next && setSelected(null)}>
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto overflow-x-hidden">
            <DialogHeader>
              <DialogTitle className="break-words">{selected.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {selected.imageUrl ? (
                <ImageZoom
                  src={selected.imageUrl}
                  alt={selected.title}
                  className="w-full rounded-lg bg-muted"
                  imgClassName="max-h-[70vh] w-full object-contain"
                />
              ) : (
                <div className="flex h-40 items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
                  تصویری برای این محتوا ثبت نشده است
                </div>
              )}
              {selected.description?.trim() && (
                <p className="text-sm text-muted-foreground">{selected.description}</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {selected?.kind === "broadcast" && (
        <Dialog open onOpenChange={(next) => !next && setSelected(null)}>
          <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto overflow-x-hidden">
            <DialogHeader>
              <DialogTitle className="break-words">{selected.item.item.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                تاریخ گزارش: {formatPersianDateTime(selected.item.item.reportDate)}
              </p>
              {selected.item.item.pdfUrl ? (
                <Button
                  type="button"
                  className="w-full"
                  onClick={() => {
                    void downloadMedia(
                      selected.item.item.pdfUrl,
                      getFilenameFromUrl(
                        selected.item.item.pdfUrl,
                        selected.item.item.fileName
                      )
                    );
                  }}
                >
                  <Download className="h-4 w-4" />
                  دانلود گزارش
                </Button>
              ) : null}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {selected?.kind === "meeting" && (
        <Dialog open onOpenChange={(next) => !next && setSelected(null)}>
          <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto overflow-x-hidden">
            <DialogHeader>
              <DialogTitle className="break-words">{selected.item.item.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {selected.item.item.imageUrl ? (
                <ImageZoom
                  src={selected.item.item.imageUrl}
                  alt={selected.item.item.title}
                  className="w-full rounded-lg bg-muted"
                  imgClassName="max-h-[50vh] w-full object-contain"
                />
              ) : null}
              <p className="text-sm text-muted-foreground">
                تاریخ جلسه: {formatPersianDateTime(selected.item.item.meetingDate)}
              </p>
              {selected.item.item.summaryPreview?.trim() ? (
                <p className="text-sm text-muted-foreground">
                  {selected.item.item.summaryPreview}
                </p>
              ) : null}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {selected?.kind === "file" && (
        <Dialog open onOpenChange={(next) => !next && setSelected(null)}>
          <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto overflow-x-hidden">
            <DialogHeader>
              <DialogTitle className="break-words">{selected.item.item.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {selected.item.item.description?.trim() && (
                <p className="text-sm text-muted-foreground">{selected.item.item.description}</p>
              )}
              <Button
                type="button"
                className="w-full"
                onClick={() => {
                  void downloadMedia(
                    selected.item.item.fileUrl,
                    getFilenameFromUrl(selected.item.item.fileUrl, selected.item.item.fileName)
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
    </>
  );
}
