"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MediaUpload } from "@/components/ui/media-upload";
import { MediaThumbnail } from "@/components/ui/media-thumbnail";
import { PlanLabelSelect } from "@/components/admin/plan-label-select";
import { ContentScoreControl } from "@/components/admin/content-score-control";
import {
  deletePosterAction,
  deletePosterVersionAction,
  savePosterAction,
  savePosterVersionAction,
} from "@/lib/actions/admin-actions";
import { normalizePlanLabels, type ContentTopic } from "@/lib/content-topics";
import { todayISO } from "@/lib/jalali";
import { resolveDisplayVersion } from "@/lib/media-utils";
import type { MediaCategory, Poster, PosterVersion } from "@/lib/types";

interface AdminPosterEditorProps {
  poster: Poster;
  versions: PosterVersion[];
  categories: MediaCategory[];
  contentPlans?: string[];
  contentTopics?: ContentTopic[];
  canScore?: boolean;
  isNew?: boolean;
  onClose: () => void;
  onSaved?: (poster: Poster) => void;
}

export function AdminPosterEditor({
  poster,
  versions,
  contentPlans = [],
  contentTopics = [],
  canScore = false,
  isNew = false,
  onClose,
  onSaved,
}: AdminPosterEditorProps) {
  const router = useRouter();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [isPending, startTransition] = useTransition();

  const displayVersion = useMemo(() => resolveDisplayVersion(versions), [versions]);

  const [imageUrl, setImageUrl] = useState(displayVersion?.imageUrl ?? "");
  const [notes, setNotes] = useState(displayVersion?.notes ?? "");
  const [editTitle, setEditTitle] = useState(poster.title);
  const [editDescription, setEditDescription] = useState(poster.description ?? "");
  const [editCategoryId, setEditCategoryId] = useState(poster.categoryId);
  const [editPlanLabels, setEditPlanLabels] = useState<string[]>(() =>
    normalizePlanLabels(poster.planLabels, poster.planLabel)
  );
  const [editScore, setEditScore] = useState<number | null | undefined>(poster.score);

  useEffect(() => {
    const current = resolveDisplayVersion(versions);
    setEditTitle(poster.title);
    setEditDescription(poster.description ?? "");
    setEditCategoryId(poster.categoryId);
    setEditPlanLabels(normalizePlanLabels(poster.planLabels, poster.planLabel));
    setEditScore(poster.score);
    setImageUrl(current?.imageUrl ?? "");
    setNotes(current?.notes ?? "");
  }, [
    poster.id,
    poster.title,
    poster.description,
    poster.categoryId,
    poster.planLabel,
    poster.planLabels,
    poster.score,
    versions,
  ]);

  const refresh = () => router.refresh();

  const handleSaveAll = () => {
    if (!imageUrl.trim()) {
      toast.error("تصویر پوستر لازم است");
      return;
    }

    startTransition(async () => {
      const savedPoster = {
        ...poster,
        title: editTitle,
        description: editDescription,
        categoryId: editCategoryId,
        published: true,
        planLabels: editPlanLabels,
        planLabel: editPlanLabels[0] ?? null,
        score: editScore,
        updatedAt: new Date().toISOString(),
      };

      await savePosterAction(savedPoster);

      const keepId = displayVersion?.id;
      await savePosterVersionAction({
        id: keepId,
        posterId: poster.id,
        versionNumber: displayVersion?.versionNumber ?? 1,
        imageUrl,
        thumbnailUrl: imageUrl,
        notes: notes || undefined,
        date: displayVersion?.date ?? todayISO(),
        isFinal: true,
        status: "final",
      });

      for (const version of versions) {
        if (version.id !== keepId) {
          await deletePosterVersionAction(version.id);
        }
      }

      toast.success("ذخیره شد");
      onSaved?.(savedPoster);
      refresh();
    });
  };

  const handleDeletePoster = () => {
    if (isNew) {
      onClose();
      return;
    }
    startTransition(async () => {
      await deletePosterAction(poster.id);
      toast.success("پوستر حذف شد");
      onClose();
      refresh();
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollAreaRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-y-contain pr-1">
        <div className="relative mx-auto aspect-[3/4] max-h-80 w-full max-w-xs overflow-hidden rounded-xl bg-muted">
          <MediaThumbnail
            src={imageUrl || null}
            alt={editTitle}
            kind="poster"
            sizes="320px"
            objectFit="contain"
          />
        </div>

        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-3">
            <div>
              <Label>عنوان</Label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="عنوان پوستر" />
            </div>
            <div>
              <Label>توضیحات</Label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={2}
                placeholder="توضیحات (اختیاری)"
              />
            </div>
            <PlanLabelSelect
              topics={contentTopics}
              plans={contentPlans}
              values={editPlanLabels}
              onChangeMultiple={setEditPlanLabels}
            />
            {!isNew && (
              <ContentScoreControl
                campaignId={poster.campaignId}
                contentType="poster"
                contentId={poster.id}
                score={editScore}
                canScore={canScore}
                onScoreSaved={setEditScore}
              />
            )}
            <MediaUpload label="تصویر" value={imageUrl} onChange={setImageUrl} />
            <div>
              <Label>یادداشت (اختیاری)</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <div className="flex flex-col items-center gap-2 pt-6">
            <Button variant="ghost" size="icon" onClick={handleDeletePoster} disabled={isPending}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-3 flex shrink-0 gap-2 border-t bg-card pt-3">
        <Button onClick={handleSaveAll} disabled={isPending} className="flex-1">
          {isPending ? "در حال ذخیره..." : "ذخیره"}
        </Button>
      </div>
    </div>
  );
}
