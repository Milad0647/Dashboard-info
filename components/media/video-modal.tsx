"use client";

import { useMemo } from "react";
import { Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PublicContentDetailFields } from "@/components/public/public-content-detail-fields";
import {
  downloadMedia,
  getFilenameFromUrl,
  hasDistinctThumbnail,
  isDirectVideoUrl,
  isAparatVideoInput,
  isEmbeddableVideoUrl,
  resolveAbsoluteMediaUrl,
  resolveDisplayVersion,
  resolveVideoEmbedUrl,
  resolveVideoThumbnail,
} from "@/lib/media-utils";
import type { VideoVersion } from "@/lib/types";
import { formatPersianDate } from "@/lib/utils";

interface VideoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  versions: VideoVersion[];
  initialVersionId: string;
  description?: string | null;
  category?: string | null;
  topics?: string[];
  ownerName?: string | null;
}

export function VideoModal({
  open,
  onOpenChange,
  title,
  versions,
  description,
  category,
  topics,
  ownerName,
}: VideoModalProps) {
  const activeVersion = useMemo(() => {
    return resolveDisplayVersion(versions) ?? versions[0];
  }, [versions]);

  if (!activeVersion) return null;

  const canPlay = isEmbeddableVideoUrl(activeVersion.videoUrl);
  const embedUrl = canPlay ? resolveVideoEmbedUrl(activeVersion.videoUrl) : "";
  const videoSrc = resolveAbsoluteMediaUrl(embedUrl);
  const playAsFile = isDirectVideoUrl(activeVersion.videoUrl) || isDirectVideoUrl(videoSrc);
  const coverUrl = resolveVideoThumbnail(activeVersion.videoUrl, activeVersion.thumbnailUrl);
  const showCoverDownload = Boolean(coverUrl && hasDistinctThumbnail(coverUrl, activeVersion.videoUrl));

  const handleDownloadVideo = () => {
    void downloadMedia(
      activeVersion.videoUrl,
      getFilenameFromUrl(activeVersion.videoUrl, `${title}.mp4`)
    );
  };

  const handleDownloadCover = () => {
    if (!coverUrl) return;
    void downloadMedia(coverUrl, getFilenameFromUrl(coverUrl, `${title}-cover.jpg`));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto p-0">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="flex flex-wrap items-center gap-2 break-words">
            {title}
            {activeVersion.duration && (
              <span className="text-sm font-normal text-muted-foreground">
                ({activeVersion.duration})
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="relative aspect-video w-full bg-black">
          {canPlay ? (
            playAsFile ? (
              <video
                src={videoSrc}
                controls
                playsInline
                preload="none"
                className="h-full w-full bg-black"
              />
            ) : (
              <iframe
                src={videoSrc}
                title={title}
                className="h-full w-full"
                allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
              />
            )
          ) : (
            <div className="flex h-full items-center justify-center text-white">
              لینک ویدیو نامعتبر است
            </div>
          )}
        </div>

        <div className="space-y-4 p-4">
          <PublicContentDetailFields
            category={category}
            topics={topics}
            date={activeVersion.date ? formatPersianDate(activeVersion.date) : null}
            ownerName={ownerName}
            description={description}
            extras={
              activeVersion.notes ? <p className="text-sm text-muted-foreground">{activeVersion.notes}</p> : null
            }
          />

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadVideo}
              className="gap-2"
              disabled={!canPlay || isAparatVideoInput(activeVersion.videoUrl)}
            >
              <Download className="h-4 w-4" />
              دانلود ویدیو
            </Button>
            {showCoverDownload && (
              <Button variant="outline" size="sm" onClick={handleDownloadCover} className="gap-2">
                <Download className="h-4 w-4" />
                دانلود کاور
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
