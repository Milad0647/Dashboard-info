"use client";

import { Download, Eye, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ImageZoom } from "@/components/ui/image-zoom";
import { ContentScoreControl } from "@/components/admin/content-score-control";
import { BillboardThumbnail } from "@/components/public/billboard-thumbnail";
import { PublicContentCard } from "@/components/public/public-content-card";
import { useContentScoreAccess } from "@/lib/context/content-score-context";
import { resolveBillboardCategoryDisplay } from "@/lib/billboard-categories";
import {
  getBillboardDateLabel,
} from "@/lib/billboards";
import { getBillboardDisplayImage, hasBillboardDisplayImage } from "@/lib/billboard-media";
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
  const province = parseProvinceFromBillboard(billboard) || "نامشخص";
  const city = billboard.city?.trim() || "";
  const showCity = Boolean(city && city !== province);
  const categoryLabel = resolveBillboardCategoryDisplay(billboard);
  const dateLabel = getBillboardDateLabel(billboard);
  const canZoom = hasBillboardDisplayImage(billboard);
  const displayImage = getBillboardDisplayImage(billboard);

  const handleDownload = () => {
    if (!canZoom) return;
    void downloadMedia(displayImage, getFilenameFromUrl(displayImage, `${billboard.title}.jpg`));
  };

  return (
    <PublicContentCard
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
              src={displayImage}
              alt={billboard.title}
              className="absolute inset-0 h-full w-full"
              imgClassName="object-cover transition-transform group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, 320px"
            />
          ) : (
            <BillboardThumbnail
              billboard={billboard}
              alt={billboard.title}
              sizes="(max-width: 768px) 100vw, 320px"
              imageClassName="transition-transform group-hover:scale-105"
            />
          )}
          {showCity && (
            <Badge
              variant="outline"
              className="absolute right-2 top-2 bg-background/90 text-[10px] shadow-sm"
            >
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
