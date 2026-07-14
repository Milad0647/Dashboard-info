"use client";

import { Download, MapPin, Music } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ImageZoom } from "@/components/ui/image-zoom";
import { getActivityTypeLabel } from "@/lib/activity-types";
import {
  downloadMedia,
  getFilenameFromUrl,
  isAparatVideoInput,
  isDirectVideoUrl,
  isEmbeddableVideoUrl,
  resolveAbsoluteMediaUrl,
  resolveVideoEmbedUrl,
} from "@/lib/media-utils";
import type { CampaignActivity } from "@/lib/types";
import { formatPersianDate } from "@/lib/utils";

interface ActivityMediaDialogProps {
  activity: CampaignActivity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ActivityMediaDialog({ activity, open, onOpenChange }: ActivityMediaDialogProps) {
  if (!activity) return null;

  const hasVideo = Boolean(activity.videoUrl?.trim());
  const hasImage = Boolean(activity.imageUrl?.trim());
  const canPlayVideo = hasVideo && isEmbeddableVideoUrl(activity.videoUrl!);
  const videoSrc = canPlayVideo ? resolveAbsoluteMediaUrl(resolveVideoEmbedUrl(activity.videoUrl!)) : "";
  const isDirectVideo = canPlayVideo && isDirectVideoUrl(videoSrc);
  const galleryImages =
    activity.mediaItems?.filter((item) => item.url?.trim() && item.type === "image").map((item) => item.url) ??
    [];
  const audioItems =
    activity.mediaItems?.filter((item) => item.url?.trim() && item.type === "audio") ?? [];

  const handleDownloadImage = () => {
    if (!activity.imageUrl) return;
    void downloadMedia(
      activity.imageUrl,
      getFilenameFromUrl(activity.imageUrl, `${activity.title}.jpg`)
    );
  };

  const handleDownloadVideo = () => {
    if (!activity.videoUrl) return;
    void downloadMedia(
      activity.videoUrl,
      getFilenameFromUrl(activity.videoUrl, `${activity.title}.mp4`)
    );
  };

  const handleDownloadAudio = (url: string, index: number) => {
    void downloadMedia(url, getFilenameFromUrl(url, `${activity.title}-${index + 1}.mp3`));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto overflow-x-hidden p-0">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="flex flex-wrap items-center gap-2 text-base">
            {activity.title}
            <Badge variant="outline">{getActivityTypeLabel(activity.activityType)}</Badge>
          </DialogTitle>
        </DialogHeader>

        {hasVideo && (
          <div className="relative aspect-video w-full bg-black">
            {canPlayVideo ? (
              isDirectVideo ? (
                <video
                  key={activity.id}
                  src={videoSrc}
                  controls
                  playsInline
                  preload="metadata"
                  className="h-full w-full bg-black"
                />
              ) : (
                <iframe
                  key={activity.id}
                  src={videoSrc}
                  title={activity.title}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  allowFullScreen
                />
              )
            ) : (
              <div className="flex h-full items-center justify-center px-4 text-center text-sm text-white">
                پیش‌نمایش ویدیو در دسترس نیست
              </div>
            )}
          </div>
        )}

        {!hasVideo && hasImage && (
          <div className="p-4 pt-2">
            <ImageZoom
              src={activity.imageUrl!}
              alt={activity.title}
              className="w-full rounded-lg bg-muted"
              imgClassName="max-h-[60vh] w-full object-contain"
            />
          </div>
        )}

        {!hasVideo && !hasImage && galleryImages.length > 0 && (
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            {galleryImages.map((url) => (
              <ImageZoom
                key={url}
                src={url}
                alt={activity.title}
                className="w-full rounded-lg bg-muted"
                imgClassName="max-h-64 w-full object-contain"
              />
            ))}
          </div>
        )}

        {audioItems.length > 0 && (
          <div className="space-y-3 px-4 pt-2">
            {audioItems.map((item, index) => (
              <div
                key={item.id}
                className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3 sm:flex-row sm:items-center"
              >
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Music className="h-4 w-4 shrink-0" />
                  <span>فایل صوتی {audioItems.length > 1 ? index + 1 : ""}</span>
                </div>
                <audio
                  src={resolveAbsoluteMediaUrl(item.url)}
                  controls
                  preload="metadata"
                  className="w-full flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownloadAudio(item.url, index)}
                  className="gap-2 shrink-0"
                >
                  <Download className="h-4 w-4" />
                  دانلود
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3 p-4">
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            <span>{formatPersianDate(activity.activityDate)}</span>
            {activity.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                {activity.location}
              </span>
            )}
          </div>

          {activity.description && (
            <p className="text-sm leading-relaxed text-muted-foreground">{activity.description}</p>
          )}

          <div className="flex flex-wrap gap-2">
            {hasImage && (
              <Button variant="outline" size="sm" onClick={handleDownloadImage} className="gap-2">
                <Download className="h-4 w-4" />
                دانلود تصویر
              </Button>
            )}
            {hasVideo && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadVideo}
                className="gap-2"
                disabled={!canPlayVideo || isAparatVideoInput(activity.videoUrl!)}
              >
                <Download className="h-4 w-4" />
                دانلود ویدیو
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
