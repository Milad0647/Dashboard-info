"use client";

import { useMemo } from "react";
import Image from "next/image";
import { Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MediaPlaceholder } from "@/components/ui/media-placeholder";
import { downloadMedia, getFilenameFromUrl, resolveDisplayVersion } from "@/lib/media-utils";
import type { PosterVersion } from "@/lib/types";
import { formatPersianDate } from "@/lib/utils";

interface LightboxModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  versions: PosterVersion[];
  initialVersionId: string;
}

export function LightboxModal({
  open,
  onOpenChange,
  title,
  versions,
}: LightboxModalProps) {
  const activeVersion = useMemo(() => {
    return resolveDisplayVersion(versions) ?? versions[0];
  }, [versions]);

  if (!activeVersion) return null;

  const handleDownload = () => {
    void downloadMedia(
      activeVersion.imageUrl,
      getFilenameFromUrl(activeVersion.imageUrl, `${title}.jpg`)
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto p-0">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="relative mx-4 aspect-[3/4] max-h-[55vh] w-auto bg-muted">
          {activeVersion.imageUrl ? (
            <Image
              src={activeVersion.imageUrl}
              alt={title}
              fill
              loading="lazy"
              decoding="async"
              quality={80}
              className="object-contain"
              sizes="(max-width: 768px) 100vw, 768px"
            />
          ) : (
            <MediaPlaceholder kind="poster" className="h-full" />
          )}
        </div>

        <div className="space-y-3 p-4">
          <Button variant="outline" size="sm" onClick={handleDownload} className="gap-2">
            <Download className="h-4 w-4" />
            دانلود تصویر
          </Button>

          {activeVersion.date && (
            <p className="text-sm text-muted-foreground">{formatPersianDate(activeVersion.date)}</p>
          )}
          {activeVersion.notes && <p className="text-sm">{activeVersion.notes}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
