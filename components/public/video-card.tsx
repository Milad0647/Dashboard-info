"use client";

import { useState } from "react";
import { Download, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { VideoModal } from "@/components/media/video-modal";
import { VideoThumbnail } from "@/components/media/video-thumbnail";
import { ContentScoreControl } from "@/components/admin/content-score-control";
import { PublicOwnerTag } from "@/components/public/public-owner-tag";
import { useContentScoreAccess } from "@/lib/context/content-score-context";
import type { VideoVersion } from "@/lib/types";
import { downloadMedia, getFilenameFromUrl, hasDistinctThumbnail, resolveDisplayVersion } from "@/lib/media-utils";
import { formatPersianDate } from "@/lib/utils";

interface VideoCardProps {
  id?: string;
  campaignId?: string;
  title: string;
  description?: string | null;
  versions: VideoVersion[];
  score?: number | null;
  ownerUserId?: string | null;
  ownerName?: string | null;
}

export function VideoCard({
  id,
  campaignId,
  title,
  description,
  versions,
  score,
  ownerUserId,
  ownerName,
}: VideoCardProps) {
  const { canScore, campaignId: scoreCampaignId } = useContentScoreAccess();
  const [modalOpen, setModalOpen] = useState(false);

  const displayVersion = resolveDisplayVersion(versions);
  if (!displayVersion) return null;

  const handleDownloadVideo = (event: React.MouseEvent) => {
    event.stopPropagation();
    void downloadMedia(
      displayVersion.videoUrl,
      getFilenameFromUrl(displayVersion.videoUrl, `${title}.mp4`)
    );
  };

  const handleDownloadCover = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!hasDistinctThumbnail(displayVersion.thumbnailUrl, displayVersion.videoUrl)) return;
    void downloadMedia(
      displayVersion.thumbnailUrl,
      getFilenameFromUrl(displayVersion.thumbnailUrl, `${title}-cover.jpg`)
    );
  };

  return (
    <>
      <Card className="w-full overflow-hidden py-0 gap-0">
        <div
          className="relative aspect-video cursor-pointer overflow-hidden bg-muted group"
          onClick={() => setModalOpen(true)}
        >
          <VideoThumbnail
            videoUrl={displayVersion.videoUrl}
            thumbnailUrl={displayVersion.thumbnailUrl}
            alt={title}
            className="object-contain transition-transform group-hover:scale-105"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors pointer-events-none">
            <Play className="h-12 w-12 text-white" />
          </div>
          <div className="absolute bottom-3 left-3 flex gap-1">
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="h-8 w-8 opacity-90"
              onClick={handleDownloadVideo}
              aria-label="دانلود ویدیو"
            >
              <Download className="h-4 w-4" />
            </Button>
            {hasDistinctThumbnail(displayVersion.thumbnailUrl, displayVersion.videoUrl) && (
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="h-8 w-8 opacity-90"
                onClick={handleDownloadCover}
                aria-label="دانلود کاور"
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <CardContent className="p-4 space-y-3">
          <div>
            <div className="flex flex-wrap items-start gap-1.5">
              <h3 className="font-semibold">{title}</h3>
              <PublicOwnerTag ownerUserId={ownerUserId} ownerName={ownerName} />
            </div>
            {description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{description}</p>
            )}
          </div>
          {(displayVersion.duration || displayVersion.date) && (
            <p className="text-xs text-muted-foreground">
              {[displayVersion.duration, displayVersion.date ? formatPersianDate(displayVersion.date) : null]
                .filter(Boolean)
                .join(" — ")}
            </p>
          )}

          {id && (canScore || score != null) && (
            <ContentScoreControl
              campaignId={campaignId || scoreCampaignId}
              contentType="video"
              contentId={id}
              score={score}
              canScore={canScore}
              compact
            />
          )}
        </CardContent>
      </Card>

      {modalOpen && (
        <VideoModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          title={title}
          versions={[displayVersion]}
          initialVersionId={displayVersion.id}
        />
      )}
    </>
  );
}
