"use client";

import { Eye, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { ImageZoom } from "@/components/ui/image-zoom";
import { ContentScoreControl } from "@/components/admin/content-score-control";
import { BillboardThumbnail } from "@/components/public/billboard-thumbnail";
import { useContentScoreAccess } from "@/lib/context/content-score-context";
import { resolveBillboardCategoryDisplay } from "@/lib/billboard-categories";
import {
  getBillboardDateLabel,
  getBillboardDisplayDays,
} from "@/lib/billboards";
import { getBillboardDisplayImage, hasBillboardDisplayImage } from "@/lib/billboard-media";
import { parseProvinceFromBillboard } from "@/lib/billboard-form-utils";
import type { Billboard } from "@/lib/types";
import { formatPersianDate, formatPersianNumber } from "@/lib/utils";

interface BillboardCardProps {
  billboard: Billboard;
  onView: (billboard: Billboard) => void;
}

function resolveBillboardAddress(billboard: Billboard): string {
  const location = billboard.location?.trim() ?? "";
  const description = billboard.description?.trim() ?? "";
  if (location && description && location !== description) {
    return `${location} — ${description}`;
  }
  return location || description || "—";
}

export function BillboardCard({ billboard, onView }: BillboardCardProps) {
  const { canScore, campaignId } = useContentScoreAccess();
  const province = parseProvinceFromBillboard(billboard) || "نامشخص";
  const city = billboard.city?.trim() || "";
  const showCity = Boolean(city && city !== province);
  const categoryLabel = resolveBillboardCategoryDisplay(billboard);
  const address = resolveBillboardAddress(billboard);
  const dateLabel = getBillboardDateLabel(billboard);
  const displayDays = getBillboardDisplayDays(billboard);
  const canZoom = hasBillboardDisplayImage(billboard);

  return (
    <Card className="group flex h-full w-full max-w-sm flex-col overflow-hidden">
      <div className="relative aspect-[4/3] shrink-0 overflow-hidden bg-muted">
        {canZoom ? (
          <ImageZoom
            src={getBillboardDisplayImage(billboard)}
            alt={billboard.title}
            className="absolute inset-0 h-full w-full"
            imgClassName="transition-transform group-hover:scale-105"
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
          <div className="absolute top-1.5 right-1.5 flex max-w-[calc(100%-0.75rem)] flex-wrap gap-1 justify-end">
            <Badge variant="outline" className="bg-background/90 text-[10px] px-1.5 py-0 shadow-sm">
              {city}
            </Badge>
          </div>
        )}
      </div>

      <CardContent className="flex flex-1 flex-col space-y-3 p-4">
        <h3 className="line-clamp-2 min-h-[2.5rem] font-semibold leading-tight">{billboard.title}</h3>

        {categoryLabel && (
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary" className="text-xs">
              {categoryLabel}
            </Badge>
          </div>
        )}

        <div className="space-y-1.5 text-sm text-muted-foreground">
          <div className="flex items-start gap-1">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {province}
              {showCity ? ` — ${city}` : ""}
            </span>
          </div>
          <p className="line-clamp-2 pr-5 text-xs leading-relaxed">{address}</p>
        </div>

        <div className="mt-auto space-y-1 text-xs text-muted-foreground">
          <p>{dateLabel || formatPersianDate(billboard.date)}</p>
          {displayDays != null && displayDays > 0 && (
            <p>{formatPersianNumber(displayDays)} روز نمایش</p>
          )}
        </div>

        {(canScore || billboard.score != null) && (
          <ContentScoreControl
            campaignId={campaignId || billboard.campaignId}
            contentType="billboard"
            contentId={billboard.id}
            score={billboard.score}
            canScore={canScore}
            compact
          />
        )}
      </CardContent>

      <CardFooter className="mt-auto p-4 pt-0">
        <Button variant="outline" size="sm" className="w-full" onClick={() => onView(billboard)}>
          <Eye className="h-4 w-4" />
          مشاهده بیلبورد
        </Button>
      </CardFooter>
    </Card>
  );
}
