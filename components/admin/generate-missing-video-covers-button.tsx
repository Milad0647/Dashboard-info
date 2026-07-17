"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ImagePlus, Loader2 } from "lucide-react";
import {
  captureAndUploadVideoCoverFromUrl,
  videoNeedsAutoCover,
} from "@/lib/client/video-cover";
import { formatPersianNumber } from "@/lib/utils";

export interface MissingVideoCoverTarget {
  id: string;
  label: string;
  videoUrl: string;
  thumbnailUrl?: string | null;
  applyCover: (coverUrl: string) => Promise<void>;
}

interface GenerateMissingVideoCoversButtonProps {
  targets: MissingVideoCoverTarget[];
  onComplete?: () => void;
}

export function GenerateMissingVideoCoversButton({
  targets,
  onComplete,
}: GenerateMissingVideoCoversButtonProps) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const pending = targets.filter((item) => videoNeedsAutoCover(item.videoUrl, item.thumbnailUrl));

  if (pending.length === 0) return null;

  const handleGenerate = async () => {
    if (running) return;
    if (
      !window.confirm(
        `برای ${formatPersianNumber(pending.length)} ویدیو بدون کاور، از ثانیه ۳ کاور WebP ساخته شود؟`
      )
    ) {
      return;
    }

    setRunning(true);
    setProgress({ done: 0, total: pending.length });

    let successCount = 0;
    let failCount = 0;

    for (let index = 0; index < pending.length; index += 1) {
      const target = pending[index];
      setProgress({ done: index, total: pending.length });
      try {
        const coverUrl = await captureAndUploadVideoCoverFromUrl(target.videoUrl);
        await target.applyCover(coverUrl);
        successCount += 1;
      } catch (error) {
        failCount += 1;
        console.warn(`Auto cover failed for ${target.id}:`, error);
      }
    }

    setProgress({ done: pending.length, total: pending.length });
    setRunning(false);
    setProgress(null);

    if (successCount > 0) {
      toast.success(`${formatPersianNumber(successCount)} کاور ساخته شد`);
    }
    if (failCount > 0) {
      toast.error(`${formatPersianNumber(failCount)} مورد ناموفق بود (لینک خارجی یا ویدیو خراب)`);
    }

    onComplete?.();
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={running}
      onClick={() => void handleGenerate()}
      className="gap-2"
    >
      {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
      {running && progress
        ? `ساخت کاور ${formatPersianNumber(progress.done)}/${formatPersianNumber(progress.total)}`
        : `ساخت کاور برای ${formatPersianNumber(pending.length)} ویدیو بدون کاور`}
    </Button>
  );
}
