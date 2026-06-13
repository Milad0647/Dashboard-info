"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronDown, ChevronUp, History, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { VideoModal } from "@/components/media/video-modal";
import type { VideoVersion } from "@/lib/types";
import { formatPersianDate, getStatusLabel } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface VideoCardProps {
  title: string;
  description?: string | null;
  versions: VideoVersion[];
}

export function VideoCard({ title, description, versions }: VideoCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [activeVersion, setActiveVersion] = useState<VideoVersion | null>(null);

  const sortedVersions = [...versions].sort((a, b) => a.versionNumber - b.versionNumber);
  const finalVersion = sortedVersions.find((v) => v.isFinal) ?? sortedVersions[sortedVersions.length - 1];
  const previousVersions = sortedVersions.filter((v) => v.id !== finalVersion?.id);

  if (!finalVersion) return null;

  return (
    <>
      <Card className="overflow-hidden">
        <div
          className="relative aspect-video bg-muted cursor-pointer group"
          onClick={() => setActiveVersion(finalVersion)}
        >
          {finalVersion.thumbnailUrl ? (
            <Image src={finalVersion.thumbnailUrl} alt={title} fill className="object-cover transition-transform group-hover:scale-105" sizes="(max-width: 768px) 100vw, 33vw" />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground text-sm">بدون تصویر</div>
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
            <Play className="h-12 w-12 text-white" />
          </div>
          {finalVersion.isFinal && (
            <div className="absolute top-3 right-3">
              <Badge status="final">نسخه نهایی</Badge>
            </div>
          )}
        </div>

        <CardContent className="p-4 space-y-3">
          <div>
            <h3 className="font-semibold">{title}</h3>
            {description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{description}</p>}
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>نسخه {finalVersion.versionNumber}{finalVersion.duration ? ` — ${finalVersion.duration}` : ""}</span>
            <Badge status={finalVersion.status} className="text-[10px]">{getStatusLabel(finalVersion.status)}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">{formatPersianDate(finalVersion.date)}</p>

          {previousVersions.length > 0 && (
            <div className="border-t pt-3">
              <Button variant="ghost" size="sm" className="w-full justify-between h-9 text-xs" onClick={() => setExpanded(!expanded)}>
                <span className="flex items-center gap-1.5"><History className="h-3.5 w-3.5" />{previousVersions.length} نسخه قبلی</span>
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
              <div className={cn("grid gap-2 overflow-hidden transition-all duration-300", expanded ? "mt-3 max-h-96 opacity-100" : "max-h-0 opacity-0")}>
                {previousVersions.map((version) => (
                  <button key={version.id} type="button" onClick={() => setActiveVersion(version)} className="flex items-center gap-3 p-2 rounded-lg border bg-muted/30 hover:bg-muted/60 transition-colors text-right w-full">
                    <div className="relative w-16 h-10 shrink-0 rounded overflow-hidden bg-muted">
                      {version.thumbnailUrl && <Image src={version.thumbnailUrl} alt="" fill className="object-cover" sizes="64px" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium">نسخه {version.versionNumber}</span>
                        <Badge status={version.status} className="text-[10px] shrink-0">{getStatusLabel(version.status)}</Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{formatPersianDate(version.date)}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {activeVersion && (
        <VideoModal
          open={!!activeVersion}
          onOpenChange={(open) => !open && setActiveVersion(null)}
          videoUrl={activeVersion.videoUrl}
          title={title}
          versionNumber={activeVersion.versionNumber}
          date={activeVersion.date}
          notes={activeVersion.notes}
          status={activeVersion.status}
          isFinal={activeVersion.isFinal}
          duration={activeVersion.duration}
        />
      )}
    </>
  );
}
