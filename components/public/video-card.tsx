"use client";

import { useState } from "react";
import { Download, Eye, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VideoModal } from "@/components/media/video-modal";
import { VideoThumbnail } from "@/components/media/video-thumbnail";
import { ContentScoreControl } from "@/components/admin/content-score-control";
import { PublicContentCard } from "@/components/public/public-content-card";
import { useContentScoreAccess } from "@/lib/context/content-score-context";
import type { VideoVersion } from "@/lib/types";
import { downloadMedia, getFilenameFromUrl, resolveDisplayVersion } from "@/lib/media-utils";
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
  category?: string | null;
  topics?: string[];
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
  category,
  topics,
}: VideoCardProps) {
  const { canScore, campaignId: scoreCampaignId } = useContentScoreAccess();
  const [modalOpen, setModalOpen] = useState(false);

  const displayVersion = resolveDisplayVersion(versions);
  if (!displayVersion?.videoUrl?.trim()) return null;

  const handleDownloadVideo = (event: React.MouseEvent) => {
    event.stopPropagation();
    void downloadMedia(
      displayVersion.videoUrl,
      getFilenameFromUrl(displayVersion.videoUrl, `${title}.mp4`)
    );
  };

  return (
    <>
      <PublicContentCard
        scrollId={id}
        onClick={() => setModalOpen(true)}
        title={title}
        date={displayVersion.date ? formatPersianDate(displayVersion.date) : null}
        category={category}
        topics={topics}
        ownerUserId={ownerUserId}
        ownerName={ownerName}
        media={
          <div className="group relative h-full w-full">
            <VideoThumbnail
              videoUrl={displayVersion.videoUrl}
              thumbnailUrl={displayVersion.thumbnailUrl}
              alt={title}
              className="apple-media-zoom object-cover"
            />
            <div className="apple-overlay pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/35">
              <Play className="h-12 w-12 text-white drop-shadow-lg transition-transform duration-[var(--duration-apple)] ease-[var(--ease-apple-spring)] group-hover:scale-110" />
            </div>
          </div>
        }
        score={
          id && (canScore || score != null) ? (
            <ContentScoreControl
              campaignId={campaignId || scoreCampaignId}
              contentType="video"
              contentId={id}
              score={score}
              canScore={canScore}
              compact
            />
          ) : null
        }
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                setModalOpen(true);
              }}
            >
              <Eye className="h-4 w-4" />
              مشاهده
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadVideo}>
              <Download className="h-4 w-4" />
              دانلود
            </Button>
          </>
        }
      />

      {modalOpen && (
        <VideoModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          title={title}
          versions={[displayVersion]}
          initialVersionId={displayVersion.id}
          description={description}
          category={category}
          topics={topics}
          ownerName={ownerName}
        />
      )}
    </>
  );
}
