"use client";

import { Download, ExternalLink, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BillboardThumbnail } from "@/components/public/billboard-thumbnail";
import {
  filterPublicBillboardTags,
  getBillboardDateLabel,
  getBillboardDisplayImage,
  hasBillboardDisplayImage,
  shouldShowBillboardNotes,
  shouldShowBillboardStatus,
} from "@/lib/billboards";
import { downloadMedia, getFilenameFromUrl } from "@/lib/media-utils";
import { formatBillboardLocationLine } from "@/lib/billboard-location";
import type { Billboard } from "@/lib/types";
import { formatPersianDate, getStatusLabel, isValidUrl } from "@/lib/utils";

interface BillboardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  billboard: Billboard | null;
}

export function BillboardModal({ open, onOpenChange, billboard }: BillboardModalProps) {
  if (!billboard) return null;

  const displayTags = filterPublicBillboardTags(billboard.tags);
  const showStatus = shouldShowBillboardStatus(billboard);
  const showNotes = shouldShowBillboardNotes(billboard);
  const canDownload = hasBillboardDisplayImage(billboard);
  const dateLabel = getBillboardDateLabel(billboard);

  const handleDownload = () => {
    if (!canDownload) return;
    const imageUrl = getBillboardDisplayImage(billboard);
    void downloadMedia(imageUrl, getFilenameFromUrl(imageUrl, `${billboard.title}.jpg`));
  };

  const handleOpenMap = () => {
    if (isValidUrl(billboard.externalUrl)) {
      window.open(billboard.externalUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            {billboard.title}
            {billboard.code && <Badge variant="outline">{billboard.code}</Badge>}
            {showStatus && <Badge status={billboard.status}>{getStatusLabel(billboard.status)}</Badge>}
          </DialogTitle>
        </DialogHeader>

        <div className="relative aspect-[4/3] w-full bg-muted">
          <BillboardThumbnail
            billboard={billboard}
            alt={billboard.title}
            sizes="(max-width: 768px) 100vw, 768px"
          />
        </div>

        <div className="p-4 space-y-3 border-t">
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span>{formatBillboardLocationLine(billboard)}</span>
          </div>

          {billboard.description && (
            <p className="text-sm text-muted-foreground">{billboard.description}</p>
          )}

          {dateLabel ? (
            <p className="text-sm text-muted-foreground">{dateLabel}</p>
          ) : (
            <p className="text-sm text-muted-foreground">{formatPersianDate(billboard.date)}</p>
          )}

          {(billboard.providerName || billboard.qualityTierLabel || billboard.billboardTypeLabel) && (
            <div className="flex flex-wrap gap-1">
              {billboard.providerName && <Badge variant="secondary">{billboard.providerName}</Badge>}
              {billboard.qualityTierLabel && <Badge variant="outline">{billboard.qualityTierLabel}</Badge>}
              {billboard.billboardTypeLabel && <Badge variant="outline">{billboard.billboardTypeLabel}</Badge>}
            </div>
          )}

          {showNotes && <p className="text-sm">{billboard.notes}</p>}

          {displayTags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {displayTags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {canDownload && (
              <Button variant="outline" size="sm" onClick={handleDownload} className="gap-2">
                <Download className="h-4 w-4" />
                دانلود تصویر
              </Button>
            )}
            {isValidUrl(billboard.externalUrl) && (
              <Button variant="outline" size="sm" onClick={handleOpenMap} className="gap-2">
                <ExternalLink className="h-4 w-4" />
                مشاهده در نقشه
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
