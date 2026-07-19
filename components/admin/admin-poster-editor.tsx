"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImageIcon, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MediaUpload } from "@/components/ui/media-upload";
import { MediaThumbnail } from "@/components/ui/media-thumbnail";
import { PlanLabelSelect } from "@/components/admin/plan-label-select";
import { ContentOwnerSelect } from "@/components/admin/content-owner-select";
import { ContentScoreControl } from "@/components/admin/content-score-control";
import {
  deletePosterAction,
  deletePosterVersionAction,
  savePosterAction,
  savePosterVersionAction,
} from "@/lib/actions/admin-actions";
import { normalizePlanLabels, type ContentTopic } from "@/lib/content-topics";
import { CONTENT_TITLE_MAX_LENGTH } from "@/lib/content-constraints";
import {
  isDefaultPosterTitle,
  type EditSuggestionMissingField,
} from "@/lib/edit-suggestions";
import { todayISO } from "@/lib/jalali";
import { resolveDisplayVersion } from "@/lib/media-utils";
import type { AdminUser, MediaCategory, Poster, PosterVersion } from "@/lib/types";
import { cn } from "@/lib/utils";

interface AdminPosterEditorProps {
  poster: Poster;
  versions: PosterVersion[];
  categories: MediaCategory[];
  contentPlans?: string[];
  contentTopics?: ContentTopic[];
  canScore?: boolean;
  canTransferOwnership?: boolean;
  users?: AdminUser[];
  isNew?: boolean;
  highlightFields?: EditSuggestionMissingField[];
  onClose: () => void;
  onSaved?: (poster: Poster) => void;
}

export function AdminPosterEditor({
  poster,
  versions,
  contentPlans = [],
  contentTopics = [],
  canScore = false,
  canTransferOwnership = false,
  users = [],
  isNew = false,
  highlightFields = [],
  onClose,
  onSaved,
}: AdminPosterEditorProps) {
  const router = useRouter();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [isPending, startTransition] = useTransition();

  const displayVersion = useMemo(() => resolveDisplayVersion(versions), [versions]);

  const [imageUrl, setImageUrl] = useState(displayVersion?.imageUrl || "");
  const [thumbnailUrl, setThumbnailUrl] = useState(displayVersion?.thumbnailUrl || "");
  const [notes, setNotes] = useState(displayVersion?.notes ?? "");
  const [editTitle, setEditTitle] = useState(poster.title);
  const [editDescription, setEditDescription] = useState(poster.description ?? "");
  const [editCategoryId, setEditCategoryId] = useState(poster.categoryId);
  const [editPlanLabels, setEditPlanLabels] = useState<string[]>(() =>
    normalizePlanLabels(poster.planLabels, poster.planLabel)
  );
  const [editScore, setEditScore] = useState<number | null | undefined>(poster.score);
  const [editOwnerUserId, setEditOwnerUserId] = useState<string | null>(poster.ownerUserId ?? null);

  useEffect(() => {
    const current = resolveDisplayVersion(versions);
    setEditTitle(poster.title);
    setEditDescription(poster.description ?? "");
    setEditCategoryId(poster.categoryId);
    setEditPlanLabels(normalizePlanLabels(poster.planLabels, poster.planLabel));
    setEditScore(poster.score);
    setEditOwnerUserId(poster.ownerUserId ?? null);
    setImageUrl(current?.imageUrl || "");
    setThumbnailUrl(current?.thumbnailUrl || "");
    setNotes(current?.notes ?? "");
  }, [
    poster.id,
    poster.title,
    poster.description,
    poster.categoryId,
    poster.planLabel,
    poster.planLabels,
    poster.score,
    poster.ownerUserId,
    versions,
  ]);

  const refresh = () => router.refresh();

  const handleSaveAll = () => {
    if (!imageUrl.trim()) {
      toast.error("تصویر پوستر لازم است");
      return;
    }

    startTransition(async () => {
      const selectedOwner = canTransferOwnership
        ? users.find((user) => user.id === editOwnerUserId)
        : null;
      const savedPoster = {
        ...poster,
        title: editTitle,
        description: editDescription,
        categoryId: editCategoryId,
        published: true,
        planLabels: editPlanLabels,
        planLabel: editPlanLabels[0] ?? null,
        score: editScore,
        ...(canTransferOwnership
          ? {
              ownerUserId: editOwnerUserId,
              ownerName: selectedOwner?.name ?? poster.ownerName ?? null,
            }
          : {}),
        updatedAt: new Date().toISOString(),
      };

      const posterResult = await savePosterAction(savedPoster);
      if (!posterResult?.success) {
        toast.error(
          posterResult && "error" in posterResult && typeof posterResult.error === "string"
            ? posterResult.error
            : "ذخیره پوستر ناموفق بود"
        );
        return;
      }

      const keepId = displayVersion?.id;
      const versionResult = await savePosterVersionAction({
        id: keepId,
        posterId: poster.id,
        versionNumber: displayVersion?.versionNumber ?? 1,
        imageUrl,
        thumbnailUrl: thumbnailUrl.trim() || imageUrl,
        notes: notes || undefined,
        date: displayVersion?.date ?? todayISO(),
        isFinal: true,
        status: "final",
      });
      if (!versionResult?.success) {
        toast.error(
          versionResult && "error" in versionResult && typeof versionResult.error === "string"
            ? versionResult.error
            : "ذخیره تصویر پوستر ناموفق بود"
        );
        return;
      }

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

  const highlightTitle =
    highlightFields.includes("title") && isDefaultPosterTitle(editTitle);
  const highlightDescription =
    highlightFields.includes("description") && !editDescription.trim();
  const highlightMedia = highlightFields.includes("media") && !imageUrl.trim();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollAreaRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-y-contain pr-1">
        <MediaUpload
          label="تصویر پوستر"
          value={imageUrl}
          onChange={(url) => {
            setImageUrl(url);
            setThumbnailUrl("");
          }}
          onUploadedMeta={(meta) => {
            if (meta.thumbnailUrl) setThumbnailUrl(meta.thumbnailUrl);
          }}
          showPreview={false}
          showLinkInput={false}
          dropzoneContent={
            <div
              className={cn(
                "relative h-72 w-full overflow-hidden rounded-[10px] bg-muted sm:h-80",
                highlightMedia && "ring-2 ring-destructive ring-offset-2"
              )}
            >
              {imageUrl ? (
                <MediaThumbnail
                  src={imageUrl}
                  alt={editTitle}
                  kind="poster"
                  sizes="100vw"
                  objectFit="contain"
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 px-3 text-center text-sm text-muted-foreground">
                  <ImageIcon className="h-10 w-10" />
                  <span className="text-sm">تصویر را بکشید و رها کنید یا انتخاب کنید</span>
                  <span className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-sm">
                    <Upload className="h-3.5 w-3.5" />
                    انتخاب تصویر
                  </span>
                </div>
              )}
            </div>
          }
        />

        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-3">
            <div>
              <Label className={cn(highlightTitle && "text-destructive")}>عنوان</Label>
              <Input
                value={editTitle}
                maxLength={CONTENT_TITLE_MAX_LENGTH}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="عنوان پوستر"
                className={cn(highlightTitle && "border-destructive focus-visible:ring-destructive")}
              />
              {highlightTitle && (
                <p className="mt-1 text-xs text-destructive">عنوان پیش‌فرض است؛ یک عنوان اختصاصی وارد کنید.</p>
              )}
            </div>
            <div>
              <Label className={cn(highlightDescription && "text-amber-700 dark:text-amber-300")}>توضیحات</Label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={2}
                placeholder="توضیحات (اختیاری)"
                className={cn(
                  highlightDescription && "border-amber-500 focus-visible:ring-amber-500"
                )}
              />
              {highlightDescription && (
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">توضیحات خالی است؛ بهتر است تکمیل شود.</p>
              )}
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
            {canTransferOwnership && (
              <ContentOwnerSelect
                users={users}
                value={editOwnerUserId}
                onChange={setEditOwnerUserId}
              />
            )}
            {highlightMedia && (
              <p className="text-xs text-destructive">تصویر پوستر هنوز آپلود نشده است.</p>
            )}
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
