"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MediaPlaceholder } from "@/components/ui/media-placeholder";
import { MediaVersionPicker } from "@/components/media/media-version-picker";
import { downloadMedia, getFilenameFromUrl } from "@/lib/media-utils";
import type { PosterVersion } from "@/lib/types";
import { formatPersianDate, getStatusLabel } from "@/lib/utils";

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
  initialVersionId,
}: LightboxModalProps) {
  const sortedVersions = useMemo(
    () => [...versions].sort((a, b) => a.versionNumber - b.versionNumber),
    [versions]
  );

  const [activeVersionId, setActiveVersionId] = useState(initialVersionId);

  useEffect(() => {
    if (open) setActiveVersionId(initialVersionId);
  }, [open, initialVersionId]);

  const activeVersion =
    sortedVersions.find((version) => version.id === activeVersionId) ??
    sortedVersions[sortedVersions.length - 1];

  if (!activeVersion) return null;

  const handleDownload = () => {
    const suffix = `-v${activeVersion.versionNumber}`;
    void downloadMedia(
      activeVersion.imageUrl,
      getFilenameFromUrl(activeVersion.imageUrl, `${title}${suffix}.jpg`)
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto p-0">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {title}
            <span className="text-sm font-normal text-muted-foreground">
              — نسخه {activeVersion.versionNumber}
            </span>
            {activeVersion.isFinal && <Badge status="final">نسخه نهایی</Badge>}
            <Badge status={activeVersion.status}>{getStatusLabel(activeVersion.status)}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="relative mx-4 aspect-[3/4] max-h-[55vh] w-auto bg-muted">
          {activeVersion.imageUrl ? (
            <Image
              key={activeVersion.id}
              src={activeVersion.imageUrl}
              alt={`${title} — نسخه ${activeVersion.versionNumber}`}
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

          <MediaVersionPicker
            versions={sortedVersions}
            activeId={activeVersion.id}
            onSelect={setActiveVersionId}
            renderThumb={(version) =>
              version.thumbnailUrl || version.imageUrl ? (
                <Image
                  src={version.thumbnailUrl || version.imageUrl}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="48px"
                />
              ) : (
                <MediaPlaceholder kind="poster" className="h-full" />
              )
            }
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
