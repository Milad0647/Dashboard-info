"use client";

import { useMemo, useState } from "react";
import { Download, FileText } from "lucide-react";
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
import {
  getLeaderboardContentThumbnail,
  getLeaderboardContentTitle,
  type LeaderboardContentListItem,
  type LeaderboardMetricLabel,
} from "@/lib/city-leaderboard";
import { downloadMedia, getFilenameFromUrl } from "@/lib/media-utils";
import { formatPersianDateTime } from "@/lib/utils";

interface LeaderboardContentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metricLabel: LeaderboardMetricLabel;
  title: string;
  items: LeaderboardContentListItem[];
}

type SelectedContent =
  | { kind: "poster"; item: LeaderboardContentListItem & { kind: "poster" } }
  | { kind: "video"; item: LeaderboardContentListItem & { kind: "video" } }
  | { kind: "image"; title: string; imageUrl: string; description?: string | null }
  | { kind: "file"; item: LeaderboardContentListItem & { kind: "file" } };

function getListItemKey(item: LeaderboardContentListItem): string {
  return `${item.kind}-${item.item.id}`;
}

export function LeaderboardContentModal({
  open,
  onOpenChange,
  metricLabel,
  title,
  items,
}: LeaderboardContentModalProps) {
  const [selected, setSelected] = useState<SelectedContent | null>(null);

  const sortedItems = useMemo(
    () =>
      [...items].sort((a, b) =>
        getLeaderboardContentTitle(a).localeCompare(getLeaderboardContentTitle(b), "fa")
      ),
    [items]
  );

  const handleSelect = (item: LeaderboardContentListItem) => {
    switch (item.kind) {
      case "poster":
        setSelected({ kind: "poster", item });
        return;
      case "video":
        setSelected({ kind: "video", item });
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
            <DialogTitle className="break-words">
              {metricLabel} — {title}
            </DialogTitle>
          </DialogHeader>

          {sortedItems.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              موردی برای نمایش یافت نشد.
            </p>
          ) : (
            <ul className="space-y-3">
              {sortedItems.map((item) => {
                const thumbnailUrl = getLeaderboardContentThumbnail(item);
                const itemTitle = getLeaderboardContentTitle(item);

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
                          alt={itemTitle}
                          className="h-14 w-14 shrink-0 rounded-md object-cover"
                        />
                      ) : (
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                          {item.kind === "file" ? (
                            <FileText className="h-5 w-5" />
                          ) : (
                            <span className="text-[10px]">{metricLabel}</span>
                          )}
                        </div>
                      )}
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="break-words text-sm font-medium">{itemTitle}</p>
                        <Badge variant="outline" className="text-[10px]">
                          {metricLabel}
                        </Badge>
                        {item.item.createdAt ? (
                          <p className="text-[10px] text-muted-foreground">
                            ثبت: {formatPersianDateTime(item.item.createdAt)}
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
