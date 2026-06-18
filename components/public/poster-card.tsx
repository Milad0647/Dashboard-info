"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronDown, ChevronUp, Download, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LightboxModal } from "@/components/media/lightbox-modal";
import { MediaPlaceholder } from "@/components/ui/media-placeholder";
import type { PosterVersion } from "@/lib/types";
import { downloadMedia, getFilenameFromUrl, resolveDisplayVersion } from "@/lib/media-utils";
import { cn, formatPersianDate } from "@/lib/utils";

interface PosterCardProps {
  title: string;
  description?: string | null;
  versions: PosterVersion[];
}

export function PosterCard({ title, description, versions }: PosterCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxVersionId, setLightboxVersionId] = useState<string | null>(null);

  const sortedVersions = [...versions].sort((a, b) => a.versionNumber - b.versionNumber);
  const finalVersion = resolveDisplayVersion(sortedVersions);
  const previousVersions = sortedVersions.filter((v) => v.id !== finalVersion?.id);

  if (!finalVersion) return null;

  const openLightbox = (versionId: string) => {
    setLightboxVersionId(versionId);
    setLightboxOpen(true);
  };

  const handleDownload = (version: PosterVersion, event: React.MouseEvent) => {
    event.stopPropagation();
    void downloadMedia(
      version.imageUrl,
      getFilenameFromUrl(version.imageUrl, `${title}-v${version.versionNumber}.jpg`)
    );
  };

  return (
    <>
      <Card className="overflow-hidden w-full py-0 gap-0">
        <div
          className="relative w-full aspect-[3/4] overflow-hidden bg-muted cursor-pointer group"
          onClick={() => openLightbox(finalVersion.id)}
        >
          {finalVersion.imageUrl ? (
            <Image
              src={finalVersion.imageUrl}
              alt={title}
              fill
              loading="lazy"
              className="object-contain object-center size-full transition-transform group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, 33vw"
            />
          ) : (
            <MediaPlaceholder kind="poster" className="h-full" />
          )}
          <div className="absolute top-3 right-3">
            <Badge status={finalVersion.isFinal ? "final" : "draft"}>
              {finalVersion.isFinal ? "نسخه نهایی" : "پیش‌نویس"}
            </Badge>
          </div>
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center gap-2">
            <span className="opacity-0 group-hover:opacity-100 text-white text-sm font-medium bg-black/50 px-3 py-1.5 rounded-lg transition-opacity">
              مشاهده
            </span>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute bottom-3 left-3 h-8 w-8 opacity-90"
            onClick={(e) => handleDownload(finalVersion, e)}
            aria-label="دانلود تصویر"
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>

        <CardContent className="p-4 pt-4 space-y-3">
          <div>
            <h3 className="font-semibold">{title}</h3>
            {description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{description}</p>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>نسخه {finalVersion.versionNumber}</span>
            <Badge status={finalVersion.isFinal ? "final" : "draft"} className="text-[10px]">
              {finalVersion.isFinal ? "نسخه نهایی" : "پیش‌نویس"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">{formatPersianDate(finalVersion.date)}</p>

          {previousVersions.length > 0 && (
            <div className="border-t pt-3">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between h-9 text-xs"
                onClick={() => setExpanded(!expanded)}
              >
                <span className="flex items-center gap-1.5">
                  <History className="h-3.5 w-3.5" />
                  {previousVersions.length} نسخه قبلی
                </span>
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>

              <div
                className={cn(
                  "grid gap-2 overflow-hidden transition-all duration-300",
                  expanded ? "mt-3 max-h-96 opacity-100" : "max-h-0 opacity-0"
                )}
              >
                {previousVersions.map((version) => (
                  <div
                    key={version.id}
                    className="flex items-center gap-3 p-2 rounded-lg border bg-muted/30 hover:bg-muted/60 transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => openLightbox(version.id)}
                      className="flex items-center gap-3 flex-1 min-w-0 text-right"
                    >
                      <div className="relative w-12 h-14 shrink-0 rounded overflow-hidden bg-muted">
                        {version.thumbnailUrl || version.imageUrl ? (
                          <Image
                            src={version.thumbnailUrl || version.imageUrl}
                            alt=""
                            fill
                            loading="lazy"
                            className="object-cover"
                            sizes="48px"
                          />
                        ) : (
                          <MediaPlaceholder kind="poster" className="h-full" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium">نسخه {version.versionNumber}</span>
                          <Badge status={version.isFinal ? "final" : "draft"} className="text-[10px] shrink-0">
                            {version.isFinal ? "نسخه نهایی" : "پیش‌نویس"}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {formatPersianDate(version.date)}
                        </p>
                      </div>
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 h-8 w-8"
                      onClick={(e) => handleDownload(version, e)}
                      aria-label={`دانلود نسخه ${version.versionNumber}`}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {lightboxOpen && lightboxVersionId && (
        <LightboxModal
          open={lightboxOpen}
          onOpenChange={(open) => {
            setLightboxOpen(open);
            if (!open) setLightboxVersionId(null);
          }}
          title={title}
          versions={sortedVersions}
          initialVersionId={lightboxVersionId}
        />
      )}
    </>
  );
}
