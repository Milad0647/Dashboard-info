"use client";

import { useCallback, useRef, useState } from "react";
import { Minus, Plus, X, ZoomIn } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { OptimizedMediaImage } from "@/components/ui/optimized-media-image";
import { cn } from "@/lib/utils";

const THUMB_QUALITY = 65;
const FULL_QUALITY = 85;
const DEFAULT_SIZES = "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 280px";

interface ImageZoomProps {
  src: string;
  alt?: string;
  className?: string;
  imgClassName?: string;
  /** Show zoom affordance overlay on hover */
  showHint?: boolean;
  /** Responsive sizes hint for next/image optimization */
  sizes?: string;
  /** Thumbnail quality (1–100). Lower = less bandwidth. */
  quality?: number;
  /** Called when the thumbnail image fails to load */
  onError?: () => void;
}

export function ImageZoom({
  src,
  alt = "",
  className,
  imgClassName,
  showHint = true,
  sizes = DEFAULT_SIZES,
  quality = THUMB_QUALITY,
  onError,
}: ImageZoomProps) {
  const [open, setOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const [imageFailed, setImageFailed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const resetZoom = useCallback(() => setScale(1), []);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) resetZoom();
  };

  const handleImageError = () => {
    setImageFailed(true);
    onError?.();
  };

  if (!src || imageFailed) return null;

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
        className={cn(
          "group relative block h-full w-full overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className
        )}
        aria-label="بزرگ‌نمایی تصویر"
      >
        <OptimizedMediaImage
          src={src}
          alt={alt}
          fill
          loading="lazy"
          decoding="async"
          quality={quality}
          sizes={sizes}
          className={cn("object-cover", imgClassName)}
          onError={handleImageError}
        />
        {showHint && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-opacity group-hover:bg-black/25 group-hover:opacity-100">
            <ZoomIn className="h-6 w-6 text-white drop-shadow" />
          </span>
        )}
      </button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[95vh] max-w-[95vw] overflow-hidden border-none bg-black/95 p-2 sm:p-4">
          <DialogTitle className="sr-only">{alt || "تصویر"}</DialogTitle>
          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            className="absolute left-3 top-3 z-10 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
            aria-label="بستن"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/70 p-1">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-white hover:bg-white/20"
              onClick={() => setScale((s) => Math.max(0.5, Number((s - 0.25).toFixed(2))))}
              aria-label="کوچک‌نمایی"
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span className="min-w-[3rem] text-center text-xs text-white tabular-nums">
              {Math.round(scale * 100)}%
            </span>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-white hover:bg-white/20"
              onClick={() => setScale((s) => Math.min(4, Number((s + 0.25).toFixed(2))))}
              aria-label="بزرگ‌نمایی"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div
            ref={containerRef}
            className="flex max-h-[90vh] items-center justify-center overflow-auto"
            onWheel={(event) => {
              if (!event.ctrlKey && Math.abs(event.deltaY) < 40) return;
              event.preventDefault();
              const delta = event.deltaY > 0 ? -0.15 : 0.15;
              setScale((s) => Math.min(4, Math.max(0.5, Number((s + delta).toFixed(2)))));
            }}
          >
            <OptimizedMediaImage
              src={src}
              alt={alt}
              width={1920}
              height={1080}
              quality={FULL_QUALITY}
              sizes="95vw"
              priority
              className="max-h-[90vh] max-w-full origin-center object-contain transition-transform"
              style={{ transform: `scale(${scale})` }}
              draggable={false}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
