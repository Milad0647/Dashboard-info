"use client";

import { useEffect, useState, useTransition } from "react";
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
import type { MediaCategory, Poster, PosterVersion } from "@/lib/types";
import { cn, formatPersianDate, formatPersianNumber, getStatusLabel } from "@/lib/utils";

interface AdminPosterEditorProps {
  poster: Poster;
  versions: PosterVersion[];
  categories: MediaCategory[];
  onClose: () => void;
}

export function AdminPosterEditor({
  poster,
  versions,
  categories,
  onClose,
}: AdminPosterEditorProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [editTitle, setEditTitle] = useState(poster.title);
  const [editDescription, setEditDescription] = useState(poster.description ?? "");
  const [editCategoryId, setEditCategoryId] = useState(poster.categoryId);

  useEffect(() => {
    setEditTitle(poster.title);
    setEditDescription(poster.description ?? "");
    setEditCategoryId(poster.categoryId);
    setNewImageUrl("");
    setNewNotes("");
  }, [poster.id, poster.title, poster.description, poster.categoryId]);

  const sortedVersions = [...versions].sort((a, b) => b.versionNumber - a.versionNumber);
  const latestVersion = sortedVersions[0];
  const previousVersions = sortedVersions.slice(1);
  const nextVersionNumber = (sortedVersions[0]?.versionNumber ?? 0) + 1;

  const refresh = () => router.refresh();

  const saveVersion = (imageUrl: string, notes?: string) => {
    if (!imageUrl) {
      toast.error("لطفاً تصویر را آپلود کنید");
      return;
    }

    startTransition(async () => {
      await savePosterVersionAction({
        posterId: poster.id,
        imageUrl,
        thumbnailUrl: imageUrl,
        notes: notes || undefined,
        date: todayISO(),
      });
      setNewImageUrl("");
      setNewNotes("");
      toast.success(`نسخه ${formatPersianNumber(nextVersionNumber)} اضافه شد`);
      refresh();
    });
  };

  const handleAddVersion = () => saveVersion(newImageUrl, newNotes);

  const handleSavePoster = () => {
    startTransition(async () => {
      await savePosterAction({
        ...poster,
        title: editTitle,
        description: editDescription,
        categoryId: editCategoryId,
      });
      toast.success("ذخیره شد");
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

  const handleDeleteVersion = (versionId: string) => {
    startTransition(async () => {
      await deletePosterVersionAction(versionId);
      toast.success("نسخه حذف شد");
      refresh();
    });
  };

  return (
    <div className="space-y-4 pt-2">
      <div className="relative mx-auto aspect-[3/4] max-h-80 w-full max-w-xs overflow-hidden rounded-xl bg-muted">
        {latestVersion ? (
          <MediaThumbnail
            src={latestVersion.imageUrl}
            alt={editTitle}
            kind="poster"
            sizes="320px"
          />
        ) : (
          <MediaThumbnail src={null} alt={editTitle} kind="poster" />
        )}
        <div className="absolute top-2 right-2 flex flex-wrap gap-1">
          {latestVersion ? (
            <>
              <Badge variant="outline">نسخه {formatPersianNumber(latestVersion.versionNumber)}</Badge>
              {latestVersion.isFinal && <Badge status="final">نسخه نهایی</Badge>}
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
          <Button size="sm" variant="outline" onClick={handleSavePoster} disabled={isPending} className="w-full">
            ذخیره اطلاعات
          </Button>
        </div>
        <div className="flex flex-col items-center gap-2 pt-6">
          <Switch checked={poster.published} onCheckedChange={handleTogglePublish} />
          <Button variant="ghost" size="icon" onClick={handleDeletePoster} disabled={isPending}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>

      {previousVersions.length > 0 && (
        <div className="border-t pt-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-full justify-between text-xs"
            onClick={() => setExpanded(!expanded)}
          >
            <span className="flex items-center gap-1.5">
              <History className="h-3.5 w-3.5" />
              {formatPersianNumber(previousVersions.length)} نسخه قبلی
            </span>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>

          <div className={cn("grid gap-2 overflow-hidden transition-all", expanded ? "mt-3 max-h-96 opacity-100" : "max-h-0 opacity-0")}>
            {previousVersions.map((version) => (
              <div key={version.id} className="flex items-center gap-3 rounded-lg border bg-background p-2">
                <div className="relative h-14 w-12 shrink-0 overflow-hidden rounded bg-muted">
                  <MediaThumbnail src={version.thumbnailUrl || version.imageUrl} alt="" kind="poster" sizes="48px" />
                </div>
                <div className="min-w-0 flex-1 text-right">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium">نسخه {formatPersianNumber(version.versionNumber)}</span>
                    <Badge status={version.status} className="text-[10px]">{getStatusLabel(version.status)}</Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{formatPersianDate(version.date)}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleDeleteVersion(version.id)} disabled={isPending}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3 border-t pt-4">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <Plus className="h-4 w-4" />
          افزودن نسخه {formatPersianNumber(nextVersionNumber)}
        </p>
        <MediaUpload
          label="تصویر"
          value={newImageUrl}
          onChange={setNewImageUrl}
          onUploaded={(url) => saveVersion(url, newNotes)}
        />
        <div>
          <Label>یادداشت (اختیاری)</Label>
          <Textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)} rows={2} />
        </div>
        <Button onClick={handleAddVersion} disabled={isPending || !newImageUrl} className="w-full">
          افزودن نسخه
        </Button>
      </div>
    </div>
  );
}
