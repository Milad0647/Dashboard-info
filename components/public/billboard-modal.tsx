"use client";

import Image from "next/image";
import { Download, ExternalLink, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getBillboardDisplayImage } from "@/lib/billboards";
import { downloadMedia, getFilenameFromUrl } from "@/lib/media-utils";
import type { Billboard } from "@/lib/types";
import { formatPersianDate, getStatusLabel, isValidUrl } from "@/lib/utils";

interface BillboardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  billboard: Billboard | null;
}

export function BillboardModal({ open, onOpenChange, billboard }: BillboardModalProps) {
  if (!billboard) return null;

  const imageUrl = getBillboardDisplayImage(billboard);

  const handleDownload = () => {
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
            <Badge status={billboard.status}>{getStatusLabel(billboard.status)}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="relative aspect-[4/3] w-full bg-muted">
          <Image
            src={imageUrl}
            alt={billboard.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 768px"
          />
        </div>

        <div className="p-4 space-y-3 border-t">
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span>{billboard.city} — {billboard.location}</span>
          </div>

          {billboard.description && (
            <p className="text-sm text-muted-foreground">{billboard.description}</p>
          )}

          <p className="text-sm text-muted-foreground">{formatPersianDate(billboard.date)}</p>

          {billboard.notes && <p className="text-sm">{billboard.notes}</p>}

          {billboard.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {billboard.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleDownload} className="gap-2">
              <Download className="h-4 w-4" />
              دانلود تصویر
            </Button>
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
