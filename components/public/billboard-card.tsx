"use client";

import { useState } from "react";
import { Download, Eye, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ImageZoom } from "@/components/ui/image-zoom";
import { ContentScoreControl } from "@/components/admin/content-score-control";
import { BillboardThumbnail } from "@/components/public/billboard-thumbnail";
import { PublicContentCard } from "@/components/public/public-content-card";
import { useContentScoreAccess } from "@/lib/context/content-score-context";
import { resolveBillboardCategoryDisplay } from "@/lib/billboard-categories";
import { getBillboardDateLabel } from "@/lib/billboards";
import { getBillboardCardImage, getBillboardDisplayImage, hasBillboardDisplayImage } from "@/lib/billboard-media";
import { parseProvinceFromBillboard } from "@/lib/billboard-form-utils";
import { downloadMedia, getFilenameFromUrl } from "@/lib/media-utils";
import type { Billboard } from "@/lib/types";
import { formatPersianDate } from "@/lib/utils";

interface BillboardCardProps {
  billboard: Billboard;
  onView: (billboard: Billboard) => void;
}

export function BillboardCard({ billboard, onView }: BillboardCardProps) {
  const { canScore, campaignId } = useContentScoreAccess();
  const [zoomFailed, setZoomFailed] = useState(false);
  const province = parseProvinceFromBillboard(billboard) || "نامشخص";
  const city = billboard.city?.trim() || "";
  const showCity = Boolean(city && city !== province);
  const categoryLabel = resolveBillboardCategoryDisplay(billboard);
  const dateLabel = getBillboardDateLabel(billboard);
  const canZoom = hasBillboardDisplayImage(billboard) && !zoomFailed;
  const fullImage = getBillboardDisplayImage(billboard);
  const cardImage = getBillboardCardImage(billboard);

  const handleDownload = () => {
    if (!canZoom) return;
    void downloadMedia(fullImage, getFilenameFromUrl(fullImage, `${billboard.title}.jpg`));
  };

  return (
    <PublicContentCard
      scrollId={billboard.id}
      title={billboard.title}
      date={dateLabel || formatPersianDate(billboard.date)}
      category={categoryLabel}
      topics={billboard.planLabels ?? (billboard.planLabel ? [billboard.planLabel] : [])}
      ownerUserId={billboard.ownerUserId}
      ownerName={billboard.ownerName}
      media={
        <div className="group relative h-full w-full">
          {canZoom ? (
            <ImageZoom
              src={fullImage}
              previewSrc={cardImage}
              alt={billboard.title}
              className="absolute inset-0 h-full w-full"
              imgClassName="apple-media-zoom object-cover"
              sizes="(max-width: 768px) 100vw, 320px"
              onError={() => setZoomFailed(true)}
            />
          ) : (
            <BillboardThumbnail
              billboard={billboard}
              alt={billboard.title}
              sizes="(max-width: 768px) 100vw, 320px"
              imageClassName="apple-media-zoom"
            />
          )}
          {showCity && (
            <Badge variant="overlay" className="absolute right-2 top-2 text-[10px]">
              <MapPin className="h-3 w-3" />
              {city}
            </Badge>
          )}
        </div>
      }
      score={
        canScore || billboard.score != null ? (
          <ContentScoreControl
            campaignId={campaignId || billboard.campaignId}
            contentType="billboard"
            contentId={billboard.id}
            score={billboard.score}
            canScore={canScore}
            compact
          />
        ) : null
      }
      actions={
        <>
          <Button variant="outline" size="sm" onClick={() => onView(billboard)}>
            <Eye className="h-4 w-4" />
            مشاهده
          </Button>
          {canZoom && (
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="h-4 w-4" />
              دانلود
            </Button>
          )}
        </>
      }
    />
  );
}
