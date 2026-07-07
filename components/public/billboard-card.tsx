"use client";

import { Eye, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { BillboardThumbnail } from "@/components/public/billboard-thumbnail";
import {
  filterPublicBillboardTags,
  getBillboardDateLabel,
  shouldShowBillboardNotes,
  shouldShowBillboardStatus,
} from "@/lib/billboards";
import { formatBillboardLocationLine } from "@/lib/billboard-location";
import type { Billboard } from "@/lib/types";
import { formatPersianDate, getStatusLabel } from "@/lib/utils";

interface BillboardCardProps {
  billboard: Billboard;
  onView: (billboard: Billboard) => void;
}

export function BillboardCard({ billboard, onView }: BillboardCardProps) {
  const displayTags = filterPublicBillboardTags(billboard.tags);
  const showStatus = shouldShowBillboardStatus(billboard);
  const showNotes = shouldShowBillboardNotes(billboard);
  const dateLabel = getBillboardDateLabel(billboard);

  return (
    <Card className="group flex h-full w-full max-w-sm flex-col overflow-hidden">
      <div className="relative aspect-[4/3] shrink-0 overflow-hidden bg-muted">
        <BillboardThumbnail
          billboard={billboard}
          alt={billboard.title}
          sizes="(max-width: 768px) 100vw, 320px"
          imageClassName="transition-transform group-hover:scale-105"
        />
        {billboard.code && (
          <div className="absolute top-3 right-3">
            <Badge variant="outline" className="bg-background/90 text-xs">
              {billboard.code}
            </Badge>
          </div>
        )}
      </div>

      <CardContent className="flex flex-1 flex-col space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 min-h-[2.5rem] font-semibold leading-tight">{billboard.title}</h3>
          {showStatus && <Badge status={billboard.status}>{getStatusLabel(billboard.status)}</Badge>}
        </div>

        <div className="flex items-start gap-1 text-sm text-muted-foreground">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="line-clamp-2 min-h-[2.5rem]">{formatBillboardLocationLine(billboard)}</span>
        </div>

        {dateLabel ? (
          <p className="text-xs text-muted-foreground">{dateLabel}</p>
        ) : (
          <p className="text-xs text-muted-foreground">{formatPersianDate(billboard.date)}</p>
        )}

        {(billboard.providerName || billboard.qualityTierLabel) && (
          <div className="flex flex-wrap gap-1">
            {billboard.providerName && (
              <Badge variant="secondary" className="text-[10px]">
                {billboard.providerName}
              </Badge>
            )}
            {billboard.qualityTierLabel && (
              <Badge variant="outline" className="text-[10px]">
                {billboard.qualityTierLabel}
              </Badge>
            )}
          </div>
        )}

        {showNotes && (
          <p className="line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">{billboard.notes}</p>
        )}

        {displayTags.length > 0 && (
          <div className="flex min-h-[1.75rem] flex-wrap gap-1">
            {displayTags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
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
