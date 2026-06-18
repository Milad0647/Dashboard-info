"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, History, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { MediaUpload } from "@/components/ui/media-upload";
import { MediaThumbnail } from "@/components/ui/media-thumbnail";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  deletePosterAction,
  deletePosterVersionAction,
  savePosterAction,
  savePosterVersionAction,
} from "@/lib/actions/admin-actions";
import { todayISO } from "@/lib/jalali";
import { resolveDisplayVersion } from "@/lib/media-utils";
import type { MediaCategory, Poster, PosterVersion } from "@/lib/types";
import { cn, formatPersianDate, formatPersianNumber } from "@/lib/utils";

interface PosterVersionDraft {
  localId: string;
  id?: string;
  versionNumber?: number;
  imageUrl: string;
  notes: string;
  isFinal?: boolean;
  status?: PosterVersion["status"];
  date?: string;
}

interface AdminPosterEditorProps {
  poster: Poster;
  versions: PosterVersion[];
  categories: MediaCategory[];
  onClose: () => void;
}

function createPosterVersionDraft(): PosterVersionDraft {
  return { localId: crypto.randomUUID(), imageUrl: "", notes: "" };
}

function posterVersionToDraft(version: PosterVersion): PosterVersionDraft {
  return {
    localId: version.id,
    id: version.id,
    versionNumber: version.versionNumber,
    imageUrl: version.imageUrl,
    notes: version.notes ?? "",
    isFinal: version.isFinal,
    status: version.status,
    date: version.date,
  };
}

function buildPosterVersionDrafts(versions: PosterVersion[]): PosterVersionDraft[] {
  const sorted = [...versions].sort((a, b) => a.versionNumber - b.versionNumber);
  return sorted.length > 0
    ? sorted.map(posterVersionToDraft)
    : [createPosterVersionDraft()];
}

export function AdminPosterEditor({
  poster,
  versions,
  categories,
  onClose,
}: AdminPosterEditorProps) {
  const router = useRouter();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const shouldScrollToBottomRef = useRef(false);
  const [versionsExpanded, setVersionsExpanded] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [versionDrafts, setVersionDrafts] = useState<PosterVersionDraft[]>(() =>
    buildPosterVersionDrafts(versions)
  );
  const [editTitle, setEditTitle] = useState(poster.title);
  const [editDescription, setEditDescription] = useState(poster.description ?? "");
  const [editCategoryId, setEditCategoryId] = useState(poster.categoryId);

  useEffect(() => {
    setEditTitle(poster.title);
    setEditDescription(poster.description ?? "");
    setEditCategoryId(poster.categoryId);
    setVersionDrafts(buildPosterVersionDrafts(versions));
  }, [poster.id, poster.title, poster.description, poster.categoryId, versions.length]);

  useLayoutEffect(() => {
    if (!shouldScrollToBottomRef.current) return;
    shouldScrollToBottomRef.current = false;
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;
    scrollArea.scrollTo({ top: scrollArea.scrollHeight, behavior: "smooth" });
  }, [versionDrafts.length]);

  const sortedVersions = useMemo(
    () => [...versions].sort((a, b) => b.versionNumber - a.versionNumber),
    [versions]
  );
  const displayVersion = resolveDisplayVersion(sortedVersions);

  const refresh = () => router.refresh();

  const updateDraft = (localId: string, patch: Partial<PosterVersionDraft>) => {
    setVersionDrafts((prev) =>
      prev.map((item) => (item.localId === localId ? { ...item, ...patch } : item))
    );
  };

  const handleSetFinal = (localId: string, isFinal: boolean) => {
    if (isFinal) {
      setVersionDrafts((prev) =>
        prev.map((item) => ({ ...item, isFinal: item.localId === localId }))
      );
      return;
    }

    updateDraft(localId, { isFinal: false });
  };

  const handleDeleteVersion = (draft: PosterVersionDraft) => {
    if (draft.id) {
      startTransition(async () => {
        await deletePosterVersionAction(draft.id!);
        setVersionDrafts((prev) => prev.filter((item) => item.localId !== draft.localId));
        toast.success("نسخه حذف شد");
        refresh();
      });
      return;
    }

    setVersionDrafts((prev) => {
      const next = prev.filter((item) => item.localId !== draft.localId);
      return next.length > 0 ? next : [createPosterVersionDraft()];
    });
  };

  const handleSaveAll = () => {
    const draftsToSave = versionDrafts.filter((item) => item.imageUrl.trim());
    if (draftsToSave.length === 0) {
      toast.error("حداقل یک تصویر برای نسخه لازم است");
      return;
    }

    const finalLocalId = versionDrafts.find((item) => item.isFinal)?.localId;
    const orderedDrafts = finalLocalId
      ? [
          ...draftsToSave.filter((item) => item.localId !== finalLocalId),
          ...draftsToSave.filter((item) => item.localId === finalLocalId),
        ]
      : draftsToSave;

    startTransition(async () => {
      await savePosterAction({
        ...poster,
        title: editTitle,
        description: editDescription,
        categoryId: editCategoryId,
      });

      let savedCount = 0;
      for (const draft of orderedDrafts) {
        const isFinal = Boolean(draft.isFinal);
        await savePosterVersionAction({
          id: draft.id,
          posterId: poster.id,
          versionNumber: draft.versionNumber,
          imageUrl: draft.imageUrl,
          thumbnailUrl: draft.imageUrl,
          notes: draft.notes || undefined,
          date: draft.date ?? todayISO(),
          isFinal,
          status: isFinal ? "final" : "draft",
        });
        savedCount += 1;
      }

      toast.success(`ذخیره شد — ${formatPersianNumber(savedCount)} نسخه`);
      refresh();
    });
  };

  const handleTogglePublish = (published: boolean) => {
    startTransition(async () => {
      await savePosterAction({ ...poster, published });
      toast.success(published ? "منتشر شد" : "از انتشار خارج شد");
      refresh();
    });
  };

  const handleDeletePoster = () => {
    startTransition(async () => {
      await deletePosterAction(poster.id);
      toast.success("پوستر حذف شد");
      onClose();
      refresh();
    });
  };

  const handleAddVersion = () => {
    shouldScrollToBottomRef.current = true;
    setVersionDrafts((prev) => [...prev, createPosterVersionDraft()]);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollAreaRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-y-contain pr-1">
      <div className="relative mx-auto aspect-[3/4] max-h-80 w-full max-w-xs overflow-hidden rounded-xl bg-muted">
        {displayVersion ? (
          <MediaThumbnail src={displayVersion.imageUrl} alt={editTitle} kind="poster" sizes="320px" objectFit="contain" />
        ) : (
          <MediaThumbnail src={null} alt={editTitle} kind="poster" />
        )}
        <div className="absolute top-2 right-2 flex flex-wrap gap-1">
          {displayVersion ? (
            <>
              <Badge variant="outline">نسخه {formatPersianNumber(displayVersion.versionNumber)}</Badge>
              <Badge status={displayVersion.isFinal ? "final" : "draft"}>
                {displayVersion.isFinal ? "نسخه نهایی" : "پیش‌نویس"}
              </Badge>
            </>
          ) : (
            <Badge variant="secondary">بدون نسخه</Badge>
          )}
        </div>
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
          <div>
            <Label>دسته</Label>
            <Select value={editCategoryId} onValueChange={setEditCategoryId}>
              <SelectTrigger><SelectValue placeholder="دسته" /></SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>{category.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-col items-center gap-2 pt-6">
          <Switch checked={poster.published} onCheckedChange={handleTogglePublish} />
          <Button variant="ghost" size="icon" onClick={handleDeletePoster} disabled={isPending}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>

      <div className="border-t pt-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 w-full justify-between text-xs"
          onClick={() => setVersionsExpanded(!versionsExpanded)}
        >
          <span className="flex items-center gap-1.5">
            <History className="h-3.5 w-3.5" />
            نسخه‌ها ({formatPersianNumber(versionDrafts.filter((item) => item.id).length || versionDrafts.length)})
          </span>
          {versionsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>

        <div
          className={cn(
            "space-y-3 transition-all",
            versionsExpanded ? "mt-3 opacity-100" : "max-h-0 overflow-hidden opacity-0"
          )}
        >
          <p className="text-sm font-medium">ویرایش / افزودن نسخه</p>

          {versionDrafts.map((draft, index) => (
            <div key={draft.localId} className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    {draft.id
                      ? `نسخه ${formatPersianNumber(draft.versionNumber ?? index + 1)}`
                      : `نسخه جدید ${formatPersianNumber(index + 1)}`}
                  </p>
                  <Badge status={draft.isFinal ? "final" : "draft"} className="text-[10px]">
                    {draft.isFinal ? "نسخه نهایی" : "پیش‌نویس"}
                  </Badge>
                  {draft.id && draft.date && (
                    <span className="text-[10px] text-muted-foreground">{formatPersianDate(draft.date)}</span>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleDeleteVersion(draft)}
                  disabled={isPending}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
              <MediaUpload
                label="تصویر"
                value={draft.imageUrl}
                onChange={(url) => updateDraft(draft.localId, { imageUrl: url })}
              />
              <div>
                <Label>یادداشت (اختیاری)</Label>
                <Textarea
                  value={draft.notes}
                  onChange={(e) => updateDraft(draft.localId, { notes: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2">
                <div className="space-y-0.5">
                  <Label className="text-xs">نسخه نهایی</Label>
                  <p className="text-[10px] text-muted-foreground">فقط یک نسخه می‌تواند نهایی باشد</p>
                </div>
                <Switch
                  checked={Boolean(draft.isFinal)}
                  onCheckedChange={(checked) => handleSetFinal(draft.localId, checked)}
                  disabled={isPending}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      </div>

      <div className="mt-3 flex shrink-0 gap-2 border-t bg-card pt-3">
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={handleAddVersion}
        >
          <Plus className="h-4 w-4" />
          نسخه
        </Button>
        <Button onClick={handleSaveAll} disabled={isPending} className="flex-1">
          {isPending ? "در حال ذخیره..." : "ذخیره"}
        </Button>
      </div>
    </div>
  );
}
