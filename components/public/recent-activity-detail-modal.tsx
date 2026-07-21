"use client";

import { useMemo } from "react";
import { Download, ExternalLink, FileText } from "lucide-react";
import { LightboxModal } from "@/components/media/lightbox-modal";
import { VideoModal } from "@/components/media/video-modal";
import { ActivityMediaDialog } from "@/components/public/activity-media-dialog";
import { BillboardModal } from "@/components/public/billboard-modal";
import { MeetingDetailDialog } from "@/components/public/meeting-detail-dialog";
import { PublicContentDetailDialog } from "@/components/public/public-content-detail-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ImageZoom } from "@/components/ui/image-zoom";
import {
  broadcastMediaCategoryLabel,
  resolveBroadcastFileKind,
  resolveBroadcastMediaType,
} from "@/lib/broadcast-media";
import type { RecentActivityItem } from "@/lib/campaign-overview-insights";
import { downloadMedia, getFilenameFromUrl, resolveDisplayVersion } from "@/lib/media-utils";
import type {
  BroadcastReport,
  CampaignActivity,
  CampaignFile,
  MeetingPublicPreview,
  PosterWithVersions,
  PublicCampaignData,
  SocialMediaPost,
  VideoVersion,
  VideoWithVersions,
} from "@/lib/types";
import { formatPersianDate, formatPersianNumber } from "@/lib/utils";

interface RecentActivityDetailModalProps {
  item: RecentActivityItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: PublicCampaignData;
}

function findById<T extends { id: string }>(items: T[], id: string | undefined): T | null {
  if (!id) return null;
  return items.find((entry) => entry.id === id) ?? null;
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

function SocialOrSiteMedia({ post }: { post: SocialMediaPost }) {
  const imageUrl = post.coverImageUrl?.trim() || post.mediaUrl?.trim() || "";
  if (!imageUrl) {
    return (
      <div className="flex aspect-square items-center justify-center bg-muted text-sm text-muted-foreground">
        رسانه‌ای ثبت نشده است
      </div>
    );
  }

  return (
    <div className="relative aspect-square w-full overflow-hidden">
      <ImageZoom
        src={imageUrl}
        alt={post.title}
        className="h-full w-full"
        imgClassName="object-cover"
      />
    </div>
  );
}

function PosterDetail({
  poster,
  open,
  onOpenChange,
}: {
  poster: PosterWithVersions;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const displayVersion = resolveDisplayVersion(poster.versions);
  if (!displayVersion?.imageUrl?.trim()) return null;

  return (
    <LightboxModal
      open={open}
      onOpenChange={onOpenChange}
      title={poster.title}
      versions={poster.versions}
      initialVersionId={displayVersion.id}
      description={poster.description}
      category={poster.category?.title ?? null}
      topics={poster.planLabels ?? (poster.planLabel ? [poster.planLabel] : [])}
      ownerName={poster.ownerName}
      createdAt={poster.createdAt}
    />
  );
}

function VideoDetail({
  video,
  open,
  onOpenChange,
}: {
  video: VideoWithVersions;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const displayVersion = resolveDisplayVersion(video.versions);
  if (!displayVersion) return null;

  return (
    <VideoModal
      open={open}
      onOpenChange={onOpenChange}
      title={video.title}
      versions={video.versions}
      initialVersionId={displayVersion.id}
      description={video.description}
      category={video.category?.title ?? null}
      topics={video.planLabels ?? (video.planLabel ? [video.planLabel] : [])}
      ownerName={video.ownerName}
      createdAt={video.createdAt}
    />
  );
}

function SocialOrSiteDetail({
  post,
  open,
  onOpenChange,
  category,
}: {
  post: SocialMediaPost;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: string;
}) {
  return (
    <PublicContentDetailDialog
      open={open}
      onOpenChange={onOpenChange}
      title={post.title}
      category={category}
      topics={post.planLabels ?? (post.planLabel ? [post.planLabel] : [])}
      date={post.publishedDate ? formatPersianDate(post.publishedDate) : null}
      ownerName={post.ownerName}
      description={post.description}
      media={<SocialOrSiteMedia post={post} />}
      extras={
        <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
          <span>بازدید: {formatPersianNumber(post.views)}</span>
          <span>لایک: {formatPersianNumber(post.likes)}</span>
          <span>کامنت: {formatPersianNumber(post.comments)}</span>
          <span>اشتراک: {formatPersianNumber(post.shares)}</span>
        </div>
      }
      actions={
        post.link ? (
          <Button variant="outline" size="sm" asChild>
            <a href={post.link} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" />
              باز کردن لینک
            </a>
          </Button>
        ) : undefined
      }
    />
  );
}

function BroadcastDetail({
  report,
  open,
  onOpenChange,
}: {
  report: BroadcastReport;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const mediaType = resolveBroadcastMediaType(report);
  const fileKind = resolveBroadcastFileKind(report);
  const category = broadcastMediaCategoryLabel(report);

  if (fileKind === "video") {
    const videoVersion = toBroadcastVideoVersion(report);
    return (
      <VideoModal
        open={open}
        onOpenChange={onOpenChange}
        title={report.title}
        versions={[videoVersion]}
        initialVersionId={videoVersion.id}
        description={report.summaryData.notes}
        category={category}
        topics={report.planLabels ?? (report.planLabel ? [report.planLabel] : [])}
        ownerName={report.ownerName}
        createdAt={report.createdAt}
      />
    );
  }

  if (fileKind === "image") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle className="break-words">{report.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {report.summaryData.notes?.trim() && (
              <p className="text-sm text-muted-foreground">{report.summaryData.notes}</p>
            )}
            <ImageZoom
              src={report.pdfUrl}
              alt={report.title}
              className="w-full rounded-lg bg-muted"
              imgClassName="max-h-[70vh] w-full object-contain"
            />
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                void downloadMedia(
                  report.pdfUrl,
                  getFilenameFromUrl(report.pdfUrl, report.fileName || `${report.title}.jpg`)
                );
              }}
            >
              <Download className="h-4 w-4" />
              دانلود
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (fileKind === "audio") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle className="break-words">{report.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {report.summaryData.notes?.trim() && (
              <p className="text-sm text-muted-foreground">{report.summaryData.notes}</p>
            )}
            <audio src={report.pdfUrl} controls className="w-full" preload="metadata" />
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                void downloadMedia(
                  report.pdfUrl,
                  getFilenameFromUrl(report.pdfUrl, report.fileName || `${report.title}.mp3`)
                );
              }}
            >
              <Download className="h-4 w-4" />
              دانلود
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="break-words">{report.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {report.summaryData.notes?.trim() && (
            <p className="text-sm text-muted-foreground">{report.summaryData.notes}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={report.pdfUrl} target="_blank" rel="noreferrer">
                <FileText className="h-4 w-4" />
                {mediaType === "media" ? "مشاهده" : "مشاهده PDF"}
              </a>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void downloadMedia(
                  report.pdfUrl,
                  getFilenameFromUrl(report.pdfUrl, report.fileName || `${report.title}.pdf`)
                );
              }}
            >
              <Download className="h-4 w-4" />
              دانلود
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FileDetail({
  file,
  open,
  onOpenChange,
}: {
  file: CampaignFile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="break-words">{file.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {file.description?.trim() && (
            <p className="text-sm text-muted-foreground">{file.description}</p>
          )}
          <p className="break-all text-xs text-muted-foreground">{file.fileName}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={file.fileUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
                مشاهده
              </a>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void downloadMedia(file.fileUrl, getFilenameFromUrl(file.fileUrl, file.fileName));
              }}
            >
              <Download className="h-4 w-4" />
              دانلود
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MeetingDetail({
  meeting,
  open,
  onOpenChange,
  meetingsHasPassword,
}: {
  meeting: MeetingPublicPreview;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meetingsHasPassword: boolean;
}) {
  return (
    <MeetingDetailDialog
      preview={meeting}
      open={open}
      onOpenChange={onOpenChange}
      meetingsHasPassword={meetingsHasPassword}
      isUnlocked={!meetingsHasPassword}
    />
  );
}

function ActivityDetail({
  activity,
  open,
  onOpenChange,
}: {
  activity: CampaignActivity;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return <ActivityMediaDialog activity={activity} open={open} onOpenChange={onOpenChange} />;
}

export function RecentActivityDetailModal({
  item,
  open,
  onOpenChange,
  data,
}: RecentActivityDetailModalProps) {
  const resolved = useMemo(() => {
    if (!item?.contentType || !item.contentId) return null;

    switch (item.contentType) {
      case "billboard":
        return { kind: "billboard" as const, value: findById(data.billboards, item.contentId) };
      case "poster":
        return { kind: "poster" as const, value: findById(data.posters, item.contentId) };
      case "video":
        return { kind: "video" as const, value: findById(data.videos, item.contentId) };
      case "social_post":
        return { kind: "social_post" as const, value: findById(data.socialPosts, item.contentId) };
      case "site_publication":
        return {
          kind: "site_publication" as const,
          value: findById(data.sitePublications, item.contentId),
        };
      case "activity":
        return { kind: "activity" as const, value: findById(data.activities, item.contentId) };
      case "press_publication":
        return {
          kind: "press_publication" as const,
          value: findById(data.pressPublications, item.contentId),
        };
      case "broadcast":
        return {
          kind: "broadcast" as const,
          value: findById(data.broadcastReports, item.contentId),
        };
      case "meeting":
        return { kind: "meeting" as const, value: findById(data.meetings, item.contentId) };
      case "file":
        return { kind: "file" as const, value: findById(data.files, item.contentId) };
      default:
        return null;
    }
  }, [data, item]);

  if (!item || !resolved?.value) return null;

  switch (resolved.kind) {
    case "billboard":
      return (
        <BillboardModal open={open} onOpenChange={onOpenChange} billboard={resolved.value} />
      );
    case "poster":
      return <PosterDetail poster={resolved.value} open={open} onOpenChange={onOpenChange} />;
    case "video":
      return <VideoDetail video={resolved.value} open={open} onOpenChange={onOpenChange} />;
    case "social_post":
      return (
        <SocialOrSiteDetail
          post={resolved.value}
          open={open}
          onOpenChange={onOpenChange}
          category="پست اجتماعی"
        />
      );
    case "site_publication":
      return (
        <SocialOrSiteDetail
          post={resolved.value}
          open={open}
          onOpenChange={onOpenChange}
          category="انتشار در سایت"
        />
      );
    case "activity":
    case "press_publication":
      return (
        <ActivityDetail activity={resolved.value} open={open} onOpenChange={onOpenChange} />
      );
    case "broadcast":
      return <BroadcastDetail report={resolved.value} open={open} onOpenChange={onOpenChange} />;
    case "meeting":
      return (
        <MeetingDetail
          meeting={resolved.value}
          open={open}
          onOpenChange={onOpenChange}
          meetingsHasPassword={data.meetingsHasPassword}
        />
      );
    case "file":
      return <FileDetail file={resolved.value} open={open} onOpenChange={onOpenChange} />;
    default:
      return null;
  }
}
