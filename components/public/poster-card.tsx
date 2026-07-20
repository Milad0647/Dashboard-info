"use client";

import { useState } from "react";
import { Download, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LightboxModal } from "@/components/media/lightbox-modal";
import { ImageZoom } from "@/components/ui/image-zoom";
import { ContentScoreControl } from "@/components/admin/content-score-control";
import { PublicContentCard } from "@/components/public/public-content-card";
import { useContentScoreAccess } from "@/lib/context/content-score-context";
import type { PosterVersion } from "@/lib/types";
import { downloadMedia, getFilenameFromUrl, resolveDisplayVersion } from "@/lib/media-utils";
import { formatPersianDate } from "@/lib/utils";

interface PosterCardProps {
  id?: string;
  campaignId?: string;
  title: string;
  description?: string | null;
  versions: PosterVersion[];
  score?: number | null;
  ownerUserId?: string | null;
  ownerName?: string | null;
  category?: string | null;
  topics?: string[];
}

export function PosterCard({
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
}: PosterCardProps) {
  const { canScore, campaignId: scoreCampaignId } = useContentScoreAccess();
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const displayVersion = resolveDisplayVersion(versions);
  if (!displayVersion?.imageUrl?.trim()) return null;

  const handleDownload = (event: React.MouseEvent) => {
    event.stopPropagation();
    void downloadMedia(
      displayVersion.imageUrl,
      getFilenameFromUrl(displayVersion.imageUrl, `${title}.jpg`)
    );
  };

  return (
    <>
      <PublicContentCard
        scrollId={id}
        title={title}
        date={displayVersion.date ? formatPersianDate(displayVersion.date) : null}
        category={category}
        topics={topics}
        ownerUserId={ownerUserId}
        ownerName={ownerName}
        media={
          <div className="group relative h-full w-full">
            <ImageZoom
              src={displayVersion.imageUrl}
              previewSrc={displayVersion.thumbnailUrl}
              alt={title}
              className="absolute inset-0 h-full w-full"
              imgClassName="apple-media-zoom object-cover object-center"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 280px"
            />
          </div>
        }
        score={
          id && (canScore || score != null) ? (
            <ContentScoreControl
              campaignId={campaignId || scoreCampaignId}
              contentType="poster"
              contentId={id}
              score={score}
              canScore={canScore}
              compact
            />
          ) : null
        }
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setLightboxOpen(true)}>
              <Eye className="h-4 w-4" />
              مشاهده
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="h-4 w-4" />
              دانلود
            </Button>
          </>
        }
      />

      {lightboxOpen && (
        <LightboxModal
          open={lightboxOpen}
          onOpenChange={setLightboxOpen}
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
