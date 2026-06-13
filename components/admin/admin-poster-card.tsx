"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, History, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { MediaUpload } from "@/components/ui/media-upload";
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
import { cn, formatPersianDate, getStatusLabel } from "@/lib/utils";

interface AdminPosterCardProps {
  poster: Poster;
  versions: PosterVersion[];
  categories: MediaCategory[];
}

export function AdminPosterCard({ poster, versions, categories }: AdminPosterCardProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [editTitle, setEditTitle] = useState(poster.title);
  const [editDescription, setEditDescription] = useState(poster.description ?? "");
  const [editCategoryId, setEditCategoryId] = useState(poster.categoryId);

  const sortedVersions = [...versions].sort((a, b) => b.versionNumber - a.versionNumber);
  const finalVersion = sortedVersions.find((v) => v.isFinal) ?? sortedVersions[0];
  const previousVersions = sortedVersions.filter((v) => v.id !== finalVersion?.id);

  const refresh = () => router.refresh();

  const handleAddVersion = () => {
    if (!newImageUrl) {
      toast.error("لطفاً تصویر را آپلود کنید");
      return;
    }

    startTransition(async () => {
      await savePosterVersionAction({
        posterId: poster.id,
        imageUrl: newImageUrl,
        thumbnailUrl: newImageUrl,
        notes: newNotes || undefined,
        date: todayISO(),
        isFinal: true,
        status: "final",
      });
      setNewImageUrl("");
      setNewNotes("");
      toast.success("نسخه جدید اضافه شد");
      refresh();
    });
  };

  const handleSavePoster = () => {
    startTransition(async () => {
      await savePosterAction({
        ...poster,
        title: editTitle,
        description: editDescription,
        categoryId: editCategoryId,
      });
      toast.success("پوستر ذخیره شد");
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
    <Card className="overflow-hidden w-full py-0 gap-0">
      {finalVersion && (
        <div className="relative w-full aspect-[3/4] overflow-hidden bg-muted">
          <Image
            src={finalVersion.imageUrl}
            alt={poster.title}
            fill
            className="object-cover object-center size-full"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
          <div className="absolute top-2 right-2">
            <Badge status="final">نسخه نهایی — {finalVersion.versionNumber}</Badge>
          </div>
        </div>
      )}

      <CardHeader className="pb-3 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 flex-1">
            <CardTitle className="text-base">{poster.title}</CardTitle>
            <p className="text-xs text-muted-foreground">
              {categories.find((c) => c.id === poster.categoryId)?.title ?? "بدون دسته"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={poster.published} onCheckedChange={handleTogglePublish} />
            <Button variant="ghost" size="icon" onClick={handleDeletePoster} disabled={isPending}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-4">
        <div className="space-y-3 border rounded-lg p-3 bg-muted/20">
          <p className="text-xs font-medium text-muted-foreground">ویرایش اطلاعات پوستر</p>
          <div><Label>عنوان</Label><Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} /></div>
          <div><Label>توضیحات</Label><Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={2} /></div>
          <div>
            <Label>دسته</Label>
            <Select value={editCategoryId} onValueChange={setEditCategoryId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" variant="outline" onClick={handleSavePoster} disabled={isPending}>
            <Pencil className="h-3.5 w-3.5" /> ذخیره اطلاعات
          </Button>
        </div>

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

            <div className={cn("grid gap-2 overflow-hidden transition-all", expanded ? "mt-3 max-h-96 opacity-100" : "max-h-0 opacity-0")}>
              {previousVersions.map((version) => (
                <div key={version.id} className="flex items-center gap-3 p-2 rounded-lg border bg-background">
                  <div className="relative w-12 h-14 shrink-0 rounded overflow-hidden bg-muted">
                    <Image src={version.thumbnailUrl} alt="" fill className="object-cover" sizes="48px" />
                  </div>
                  <div className="flex-1 min-w-0 text-right">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium">نسخه {version.versionNumber}</span>
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

        <div className="border-t pt-4 space-y-3">
          <p className="text-sm font-medium flex items-center gap-1.5">
            <Plus className="h-4 w-4" /> افزودن نسخه جدید
          </p>
          <MediaUpload label="تصویر جدید" value={newImageUrl} onChange={setNewImageUrl} />
          <div><Label>یادداشت (اختیاری)</Label><Textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)} rows={2} /></div>
          <Button onClick={handleAddVersion} disabled={isPending || !newImageUrl} className="w-full">
            افزودن به عنوان نسخه نهایی
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
