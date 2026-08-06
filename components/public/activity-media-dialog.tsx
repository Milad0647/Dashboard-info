"use client";

import { Download, FileSpreadsheet, FileText, ImageIcon, Music, Video } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ImageZoom } from "@/components/ui/image-zoom";
import { PublicContentDetailFields } from "@/components/public/public-content-detail-fields";
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
import type { ActivityAttachment, ActivityMediaItem, CampaignActivity } from "@/lib/types";
import { formatPersianDate, formatPersianNumber } from "@/lib/utils";

interface ActivityMediaDialogProps {
  activity: CampaignActivity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${formatPersianNumber(bytes)} B`;
  if (bytes < 1024 * 1024) return `${formatPersianNumber(Math.round(bytes / 1024))} KB`;
  return `${formatPersianNumber(Math.round(bytes / (1024 * 1024)))} MB`;
}

function attachmentIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return ImageIcon;
  if (mimeType.startsWith("video/")) return Video;
  if (mimeType.includes("sheet") || mimeType.includes("excel")) return FileSpreadsheet;
  return FileText;
}

function uniqueUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const url of urls) {
    const trimmed = url.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

/** Collect every uploaded media item, with legacy imageUrl/videoUrl as fallbacks. */
export function resolveActivityDisplayMedia(activity: CampaignActivity): {
  images: string[];
  videos: string[];
  audioItems: ActivityMediaItem[];
  attachments: ActivityAttachment[];
} {
  const filled = (activity.mediaItems ?? []).filter((item) => item.url?.trim());
  const images = uniqueUrls([
    ...filled.filter((item) => item.type === "image").map((item) => item.url),
    activity.imageUrl ?? "",
  ]);
  const videos = uniqueUrls([
    ...filled.filter((item) => item.type === "video").map((item) => item.url),
    activity.videoUrl ?? "",
  ]);
  const audioItems = filled.filter((item) => item.type === "audio");
  const attachments = (activity.attachments ?? []).filter(
    (item) => item.fileUrl?.trim() && item.title?.trim()
  );
  return { images, videos, audioItems, attachments };
}

function ActivityVideoPlayer({
  videoUrl,
  title,
  activityId,
}: {
  videoUrl: string;
  title: string;
  activityId: string;
}) {
  const canPlay = isEmbeddableVideoUrl(videoUrl);
  const videoSrc = canPlay ? resolveAbsoluteMediaUrl(resolveVideoEmbedUrl(videoUrl)) : "";
  const isDirect = canPlay && isDirectVideoUrl(videoSrc);

  return (
    <div className="relative aspect-video w-full bg-black">
      {canPlay ? (
        isDirect ? (
          <video
            key={`${activityId}-${videoUrl}`}
            src={videoSrc}
            controls
            playsInline
            preload="none"
            className="h-full w-full bg-black"
          />
        ) : (
          <iframe
            key={`${activityId}-${videoUrl}`}
            src={videoSrc}
            title={title}
            className="h-full w-full"
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
          />
        )
      ) : (
        <div className="flex h-full items-center justify-center px-4 text-center text-sm text-white">
          پیش‌نمایش ویدیو در دسترس نیست
        </div>
      )}
    </div>
  );
}

/** Renders all uploaded activity media (videos, images, audio, attachments). */
export function ActivityMediaGallery({
  activity,
  className,
}: {
  activity: CampaignActivity;
  className?: string;
}) {
  const { images, videos, audioItems, attachments } = resolveActivityDisplayMedia(activity);

  const handleDownloadImage = (url: string, index: number) => {
    void downloadMedia(url, getFilenameFromUrl(url, `${activity.title}-${index + 1}.jpg`));
  };

  const handleDownloadVideo = (url: string, index: number) => {
    void downloadMedia(url, getFilenameFromUrl(url, `${activity.title}-${index + 1}.mp4`));
  };

  const handleDownloadAudio = (url: string, index: number) => {
    void downloadMedia(url, getFilenameFromUrl(url, `${activity.title}-${index + 1}.mp3`));
  };

  const handleDownloadAttachment = (fileUrl: string, fileName: string, title: string) => {
    void downloadMedia(fileUrl, fileName || `${title}.pdf`);
  };

  if (videos.length === 0 && images.length === 0 && audioItems.length === 0 && attachments.length === 0) {
    return (
      <div
        className={`flex aspect-[4/3] items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground ${className ?? ""}`}
      >
        رسانه‌ای ثبت نشده است
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className ?? ""}`}>
      {videos.map((url, index) => (
        <div key={`video-${url}`} className="space-y-2">
          <ActivityVideoPlayer videoUrl={url} title={activity.title} activityId={activity.id} />
          <div className="flex justify-end px-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDownloadVideo(url, index)}
              className="gap-2"
              disabled={!isEmbeddableVideoUrl(url) || isAparatVideoInput(url)}
            >
              <Download className="h-4 w-4" />
              {videos.length > 1 ? `دانلود ویدیو ${index + 1}` : "دانلود ویدیو"}
            </Button>
          </div>
        </div>
      ))}

      {images.length === 1 ? (
        <div className="space-y-2">
          <div className="w-full overflow-hidden rounded-lg bg-muted">
            <ImageZoom
              src={images[0]}
              alt={activity.title}
              className="w-full"
              imgClassName="max-h-[65vh] w-full object-contain"
              sizes="(max-width: 768px) 100vw, 768px"
            />
          </div>
          <div className="flex justify-end px-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDownloadImage(images[0], 0)}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              دانلود تصویر
            </Button>
          </div>
        </div>
      ) : images.length > 1 ? (
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            {images.map((url, index) => (
              <div key={`image-${url}`} className="space-y-2 overflow-hidden rounded-lg bg-muted">
                <ImageZoom
                  src={url}
                  alt={`${activity.title} — ${index + 1}`}
                  className="w-full"
                  imgClassName="max-h-72 w-full object-contain"
                  sizes="(max-width: 640px) 100vw, 384px"
                />
                <div className="flex justify-end p-2 pt-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadImage(url, index)}
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    دانلود {index + 1}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {audioItems.length > 0 && (
        <div className="space-y-3">
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
                preload="none"
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

      {attachments.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium">فایل‌های قابل دانلود</p>
          {attachments.map((item) => {
            const Icon = attachmentIcon(item.mimeType);
            return (
              <div
                key={item.id}
                className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-2">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.fileName}
                      {item.fileSize > 0 ? ` · ${formatFileSize(item.fileSize)}` : ""}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownloadAttachment(item.fileUrl, item.fileName, item.title)}
                  className="gap-2 shrink-0"
                >
                  <Download className="h-4 w-4" />
                  دانلود
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ActivityMediaDialog({ activity, open, onOpenChange }: ActivityMediaDialogProps) {
  if (!activity) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl gap-0 overflow-y-auto overflow-x-hidden p-0">
        <DialogHeader className="p-4 pb-3 pe-12">
          <DialogTitle className="flex flex-wrap items-center gap-2 text-base">
            {activity.title}
            <Badge variant="outline">{getActivityTypeLabel(activity.activityType)}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 px-4 pb-2">
          <ActivityMediaGallery activity={activity} />
        </div>

        <div className="space-y-3 border-t p-4">
          <PublicContentDetailFields
            category={getActivityTypeLabel(activity.activityType)}
            topics={activity.planLabels ?? (activity.planLabel ? [activity.planLabel] : [])}
            date={formatPersianDate(activity.activityDate)}
            ownerName={activity.ownerName}
            description={
              [activity.location ? `موقعیت: ${activity.location}` : null, activity.description]
                .filter(Boolean)
                .join("\n")
            }
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
