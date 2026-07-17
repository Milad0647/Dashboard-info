"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LightboxModal } from "@/components/media/lightbox-modal";
import { MediaPlaceholder } from "@/components/ui/media-placeholder";
import { ImageZoom } from "@/components/ui/image-zoom";
import { ContentScoreControl } from "@/components/admin/content-score-control";
import { PublicOwnerTag } from "@/components/public/public-owner-tag";
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
}: PosterCardProps) {
  const { canScore, campaignId: scoreCampaignId } = useContentScoreAccess();
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const displayVersion = resolveDisplayVersion(versions);
  if (!displayVersion) return null;

  const handleDownload = (event: React.MouseEvent) => {
    event.stopPropagation();
    void downloadMedia(
      displayVersion.imageUrl,
      getFilenameFromUrl(displayVersion.imageUrl, `${title}.jpg`)
    );
  };

  return (
    <>
      <Card className="overflow-hidden w-full py-0 gap-0">
        <div className="relative w-full aspect-[3/4] overflow-hidden bg-muted group">
          {displayVersion.imageUrl ? (
            <ImageZoom
              src={displayVersion.imageUrl}
              alt={title}
              className="absolute inset-0 h-full w-full"
              imgClassName="object-contain object-center transition-transform group-hover:scale-105"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 220px"
            />
          ) : (
            <MediaPlaceholder kind="poster" className="h-full" />
          )}
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute bottom-3 left-3 h-8 w-8 opacity-90 z-10"
            onClick={handleDownload}
            aria-label="دانلود تصویر"
          >
            <Download className="h-4 w-4" />
          </Button>
          <button
            type="button"
            className="absolute inset-0 z-[1]"
            onClick={() => setLightboxOpen(true)}
            aria-label={`مشاهده ${title}`}
          />
        </div>

        <CardContent className="p-4 pt-4 space-y-3">
          <div>
            <div className="flex flex-wrap items-start gap-1.5">
              <h3 className="font-semibold">{title}</h3>
              <PublicOwnerTag ownerUserId={ownerUserId} ownerName={ownerName} />
            </div>
            {description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{description}</p>
            )}
          </div>

          {displayVersion.date && (
            <p className="text-xs text-muted-foreground">{formatPersianDate(displayVersion.date)}</p>
          )}

          {id && (canScore || score != null) && (
            <ContentScoreControl
              campaignId={campaignId || scoreCampaignId}
              contentType="poster"
              contentId={id}
              score={score}
              canScore={canScore}
              compact
            />
          )}
        </CardContent>
      </Card>

      {lightboxOpen && (
        <LightboxModal
          open={lightboxOpen}
          onOpenChange={setLightboxOpen}
          title={title}
          versions={[displayVersion]}
          initialVersionId={displayVersion.id}
        />
      )}
    </>
  );
}
