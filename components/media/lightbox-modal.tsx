"use client";

import { useMemo } from "react";
import Image from "next/image";
import { Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MediaPlaceholder } from "@/components/ui/media-placeholder";
import { PublicContentDetailFields } from "@/components/public/public-content-detail-fields";
import { downloadMedia, getFilenameFromUrl, resolveDisplayVersion } from "@/lib/media-utils";
import type { PosterVersion } from "@/lib/types";
import { formatPersianDate } from "@/lib/utils";

interface LightboxModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  versions: PosterVersion[];
  initialVersionId: string;
  description?: string | null;
  category?: string | null;
  topics?: string[];
  ownerName?: string | null;
}

export function LightboxModal({
  open,
  onOpenChange,
  title,
  versions,
  description,
  category,
  topics,
  ownerName,
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
      <DialogContent className="max-h-[92vh] max-w-3xl gap-0 overflow-y-auto overflow-x-hidden p-0">
        <DialogHeader className="p-4 pb-3 pe-12">
          <DialogTitle className="break-words text-base">{title}</DialogTitle>
        </DialogHeader>

        <div className="w-full bg-muted">
          {activeVersion.imageUrl ? (
            <Image
              src={activeVersion.imageUrl}
              alt={title}
              width={1200}
              height={1200}
              loading="lazy"
              decoding="async"
              quality={85}
              className="mx-auto max-h-[65vh] w-full object-contain"
              sizes="(max-width: 768px) 100vw, 768px"
            />
          ) : (
            <MediaPlaceholder kind="poster" className="aspect-square w-full" />
          )}
        </div>

        <div className="space-y-4 border-t p-4">
          <PublicContentDetailFields
            category={category}
            topics={topics}
            date={activeVersion.date ? formatPersianDate(activeVersion.date) : null}
            ownerName={ownerName}
            description={description}
            extras={
              activeVersion.notes ? <p className="text-sm text-muted-foreground">{activeVersion.notes}</p> : null
            }
          />

          <Button variant="outline" size="sm" onClick={handleDownload} className="gap-2">
            <Download className="h-4 w-4" />
            دانلود تصویر
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
