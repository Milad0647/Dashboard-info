"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Play, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MediaUpload } from "@/components/ui/media-upload";
import { VideoThumbnail } from "@/components/media/video-thumbnail";
import { PlanLabelSelect } from "@/components/admin/plan-label-select";
import { ContentScoreControl } from "@/components/admin/content-score-control";
import {
  deleteVideoAction,
  deleteVideoVersionAction,
  saveVideoAction,
  saveVideoVersionAction,
} from "@/lib/actions/admin-actions";
import { normalizePlanLabels, type ContentTopic } from "@/lib/content-topics";
import { CONTENT_TITLE_MAX_LENGTH } from "@/lib/content-constraints";
import {
  isDefaultVideoTitle,
  type EditSuggestionMissingField,
} from "@/lib/edit-suggestions";
import { todayISO } from "@/lib/jalali";
import {
  buildVideoVersionMedia,
  extractAparatVideoHash,
  getAparatThumbnailUrl,
  isAparatVideoInput,
  resolveDisplayVersion,
  resolveVideoThumbnail,
} from "@/lib/media-utils";
import type { MediaCategory, Video, VideoVersion } from "@/lib/types";
import { cn } from "@/lib/utils";
import { pickDefaultVideoCategoryId, videoTypeSelectOptions } from "@/lib/video-types";

interface AdminVideoEditorProps {
  video: Video;
  versions: VideoVersion[];
  categories: MediaCategory[];
  contentPlans?: string[];
  contentTopics?: ContentTopic[];
  canScore?: boolean;
  isNew?: boolean;
  highlightFields?: EditSuggestionMissingField[];
  onClose: () => void;
  onSaved?: (video: Video) => void;
}

function draftCoverFromVersion(version: VideoVersion): string {
  const hash = extractAparatVideoHash(version.videoUrl);
  if (hash && version.thumbnailUrl === getAparatThumbnailUrl(hash)) return "";
  if (version.thumbnailUrl === version.videoUrl) return "";
  return version.thumbnailUrl ?? "";
}

export function AdminVideoEditor({
  video,
  versions,
  categories,
  contentPlans = [],
  contentTopics = [],
  canScore = false,
  isNew = false,
  highlightFields = [],
  onClose,
  onSaved,
}: AdminVideoEditorProps) {
  const router = useRouter();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [isPending, startTransition] = useTransition();

  const displayVersion = useMemo(() => resolveDisplayVersion(versions), [versions]);

  const [videoUrl, setVideoUrl] = useState(displayVersion?.videoUrl ?? "");
  const [thumbnailUrl, setThumbnailUrl] = useState(
    displayVersion ? draftCoverFromVersion(displayVersion) : ""
  );
  const [duration, setDuration] = useState(displayVersion?.duration ?? "");
  const [notes, setNotes] = useState(displayVersion?.notes ?? "");
  const [editTitle, setEditTitle] = useState(video.title);
  const [editDescription, setEditDescription] = useState(video.description ?? "");
  const [editCategoryId, setEditCategoryId] = useState(
    () => video.categoryId || pickDefaultVideoCategoryId(categories)
  );
  const [editPlanLabels, setEditPlanLabels] = useState<string[]>(() =>
    normalizePlanLabels(video.planLabels, video.planLabel)
  );
  const [editScore, setEditScore] = useState<number | null | undefined>(video.score);

  const typeOptions = useMemo(() => videoTypeSelectOptions(categories), [categories]);
  const selectOptions = useMemo(() => {
    if (!editCategoryId) return typeOptions;
    if (typeOptions.some((category) => category.id === editCategoryId)) return typeOptions;
    const current = categories.find((category) => category.id === editCategoryId);
    return current ? [current, ...typeOptions] : typeOptions;
  }, [categories, editCategoryId, typeOptions]);

  useEffect(() => {
    const current = resolveDisplayVersion(versions);
    setEditTitle(video.title);
    setEditDescription(video.description ?? "");
    setEditCategoryId(video.categoryId || pickDefaultVideoCategoryId(categories));
    setEditPlanLabels(normalizePlanLabels(video.planLabels, video.planLabel));
    setEditScore(video.score);
    setVideoUrl(current?.videoUrl ?? "");
    setThumbnailUrl(current ? draftCoverFromVersion(current) : "");
    setDuration(current?.duration ?? "");
    setNotes(current?.notes ?? "");
  }, [
    video.id,
    video.title,
    video.description,
    video.categoryId,
    video.planLabel,
    video.planLabels,
    video.score,
    versions,
    categories,
  ]);

  const previewCover = videoUrl
    ? resolveVideoThumbnail(videoUrl, thumbnailUrl || undefined)
    : null;
  const isAparat = isAparatVideoInput(videoUrl);

  const refresh = () => router.refresh();

  const handleSaveAll = () => {
    if (!editCategoryId) {
      toast.error("نوع ویدیو را انتخاب کنید");
      return;
    }
    if (!videoUrl.trim()) {
      toast.error("ویدیو لازم است");
      return;
    }

    startTransition(async () => {
      const savedVideo = {
        ...video,
        title: editTitle,
        description: editDescription,
        categoryId: editCategoryId,
        published: true,
        planLabels: editPlanLabels,
        planLabel: editPlanLabels[0] ?? null,
        score: editScore,
        updatedAt: new Date().toISOString(),
      };

      await saveVideoAction(savedVideo);

      const media = buildVideoVersionMedia(videoUrl, thumbnailUrl);
      const keepId = displayVersion?.id;
      await saveVideoVersionAction({
        id: keepId,
        videoId: video.id,
        versionNumber: displayVersion?.versionNumber ?? 1,
        videoUrl: media.videoUrl,
        thumbnailUrl: media.thumbnailUrl,
        duration: duration || undefined,
        notes: notes || undefined,
        date: displayVersion?.date ?? todayISO(),
        isFinal: true,
        status: "final",
      });

      for (const version of versions) {
        if (version.id !== keepId) {
          await deleteVideoVersionAction(version.id);
        }
      }

      toast.success("ذخیره شد");
      onSaved?.(savedVideo);
      refresh();
    });
  };

  const handleDeleteVideo = () => {
    if (isNew) {
      onClose();
      return;
    }
    startTransition(async () => {
      await deleteVideoAction(video.id);
      toast.success("ویدیو حذف شد");
      onClose();
      refresh();
    });
  };

  const highlightTitle =
    highlightFields.includes("title") && isDefaultVideoTitle(editTitle);
  const highlightDescription =
    highlightFields.includes("description") && !editDescription.trim();
  const highlightMedia = highlightFields.includes("media") && !videoUrl.trim();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollAreaRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-y-contain pr-1">
        <div
          className={cn(
            "relative mx-auto aspect-video max-h-56 w-full overflow-hidden rounded-xl bg-muted",
            highlightMedia && "ring-2 ring-destructive ring-offset-2"
          )}
        >
          {videoUrl ? (
            previewCover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewCover} alt={editTitle} className="h-full w-full object-contain" />
            ) : (
              <VideoThumbnail
                videoUrl={videoUrl}
                thumbnailUrl={thumbnailUrl || undefined}
                alt={editTitle}
                className="object-contain"
              />
            )
          ) : null}
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <Play className="h-12 w-12 text-white" />
          </div>
        </div>

        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-3">
            <div>
              <Label className={cn(highlightTitle && "text-destructive")}>عنوان</Label>
              <Input
                value={editTitle}
                maxLength={CONTENT_TITLE_MAX_LENGTH}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="عنوان ویدیو"
                className={cn(highlightTitle && "border-destructive focus-visible:ring-destructive")}
              />
              {highlightTitle && (
                <p className="mt-1 text-xs text-destructive">عنوان پیش‌فرض است؛ یک عنوان اختصاصی وارد کنید.</p>
              )}
            </div>
            <div>
              <Label className={cn(highlightDescription && "text-destructive")}>توضیحات</Label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={2}
                placeholder="توضیحات (اختیاری)"
                className={cn(
                  highlightDescription && "border-destructive focus-visible:ring-destructive"
                )}
              />
              {highlightDescription && (
                <p className="mt-1 text-xs text-destructive">توضیحات خالی است؛ بهتر است تکمیل شود.</p>
              )}
            </div>
            <div>
              <Label>نوع ویدیو</Label>
              <Select
                value={editCategoryId || undefined}
                onValueChange={setEditCategoryId}
                disabled={selectOptions.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="تیزر، انیمیشن یا موشن‌گرافیک" />
                </SelectTrigger>
                <SelectContent>
                  {selectOptions.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <PlanLabelSelect
              topics={contentTopics}
              plans={contentPlans}
              values={editPlanLabels}
              onChangeMultiple={setEditPlanLabels}
            />
            {!isNew && (
              <ContentScoreControl
                campaignId={video.campaignId}
                contentType="video"
                contentId={video.id}
                score={editScore}
                canScore={canScore}
                onScoreSaved={setEditScore}
              />
            )}
            <div
              className={cn(
                highlightMedia && "rounded-lg border border-destructive bg-destructive/5 p-3"
              )}
            >
              <MediaUpload
                label="ویدیو"
                kind="video"
                value={videoUrl}
                onChange={setVideoUrl}
                onAutoCoverGenerated={(coverUrl) => {
                  setThumbnailUrl((current) => (current.trim() ? current : coverUrl));
                }}
              />
              {highlightMedia && (
                <p className="mt-2 text-xs text-destructive">ویدیو هنوز آپلود نشده است.</p>
              )}
            </div>
            <MediaUpload
              label={
                isAparat
                  ? "کاور سفارشی (اختیاری — بدون کاور از آپارات)"
                  : "کاور (اختیاری — بدون کاور از ثانیه ۳ ویدیو ساخته می‌شود)"
              }
              value={thumbnailUrl}
              onChange={setThumbnailUrl}
              dropzone={false}
            />
            <div>
              <Label>مدت (اختیاری)</Label>
              <Input
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="0:30"
                dir="ltr"
              />
            </div>
            <div>
              <Label>یادداشت (اختیاری)</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <div className="flex flex-col items-center gap-2 pt-6">
            <Button variant="ghost" size="icon" onClick={handleDeleteVideo} disabled={isPending}>
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
