"use client";

import { Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { downloadMedia, getFilenameFromUrl, hasDistinctThumbnail, isDirectVideoUrl, resolveVideoEmbedUrl } from "@/lib/media-utils";
import { formatPersianDate, getStatusLabel, isValidUrl } from "@/lib/utils";

interface VideoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoUrl: string;
  thumbnailUrl?: string | null;
  title: string;
  versionNumber?: number;
  date?: string;
  notes?: string | null;
  status?: string;
  isFinal?: boolean;
  duration?: string | null;
}

function isDirectVideo(url: string): boolean {
  return isDirectVideoUrl(url);
}

export function VideoModal({
  open,
  onOpenChange,
  videoUrl,
  thumbnailUrl,
  title,
  versionNumber,
  date,
  notes,
  status,
  isFinal,
  duration,
}: VideoModalProps) {
  const validUrl = isValidUrl(videoUrl);
  const embedUrl = validUrl ? resolveVideoEmbedUrl(videoUrl) : "";
  const suffix = versionNumber ? `-v${versionNumber}` : "";
  const showCoverDownload = hasDistinctThumbnail(thumbnailUrl, videoUrl);

  const handleDownloadVideo = () => {
    void downloadMedia(videoUrl, getFilenameFromUrl(videoUrl, `${title}${suffix}.mp4`));
  };

  const handleDownloadCover = () => {
    if (!thumbnailUrl) return;
    void downloadMedia(thumbnailUrl, getFilenameFromUrl(thumbnailUrl, `${title}${suffix}-cover.jpg`));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            {title}
            {versionNumber && (
              <span className="text-sm font-normal text-muted-foreground">
                — نسخه {versionNumber}
              </span>
            )}
            {isFinal && <Badge status="final">نسخه نهایی</Badge>}
            {status && <Badge status={status}>{getStatusLabel(status)}</Badge>}
            {duration && (
              <span className="text-sm font-normal text-muted-foreground">({duration})</span>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="relative aspect-video w-full bg-black">
          {validUrl ? (
            isDirectVideo(embedUrl) ? (
              <video src={embedUrl} controls className="h-full w-full" playsInline />
            ) : (
              <iframe
                src={embedUrl}
                title={title}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            )
          ) : (
            <div className="flex h-full items-center justify-center text-white">
              لینک ویدیو نامعتبر است
            </div>
          )}
        </div>
        <div className="p-4 space-y-3 border-t">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleDownloadVideo} className="gap-2" disabled={!validUrl}>
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
          {date && (
            <p className="text-sm text-muted-foreground">{formatPersianDate(date)}</p>
          )}
          {notes && <p className="text-sm">{notes}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
