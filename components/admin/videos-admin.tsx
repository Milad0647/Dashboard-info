"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AdminVideoAddCard, AdminVideoCompactCard } from "@/components/admin/admin-video-compact-card";
import { AdminVideoEditor } from "@/components/admin/admin-video-editor";
import { saveCategoryAction, saveVideoAction } from "@/lib/actions/admin-actions";
import type { MediaCategory, Video, VideoVersion } from "@/lib/types";

const categorySchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  sortOrder: z.coerce.number(),
  published: z.boolean(),
});

const editorDialogClass =
  "max-h-[92vh] max-w-2xl overflow-y-auto !top-4 !translate-x-[-50%] !translate-y-0 sm:!top-6";

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

interface VideosAdminProps {
  campaignId: string;
  initialCategories: MediaCategory[];
  initialVideos: Video[];
  initialVersions: VideoVersion[];
}

export function VideosAdmin({
  campaignId,
  initialCategories,
  initialVideos,
  initialVersions,
}: VideosAdminProps) {
  const router = useRouter();
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const categoryForm = useForm({
    resolver: zodResolver(categorySchema),
    defaultValues: { title: "", sortOrder: 1, published: true },
  });

  const activeVideo = activeVideoId
    ? initialVideos.find((video) => video.id === activeVideoId) ?? null
    : null;

  const refresh = () => router.refresh();

  useEffect(() => {
    if (editorOpen) scrollToTop();
  }, [editorOpen]);

  const openEditor = (videoId: string) => {
    setActiveVideoId(videoId);
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setActiveVideoId(null);
  };

  const handleCreateVideo = () => {
    if (initialCategories.length === 0) {
      toast.error("ابتدا یک دسته بسازید");
      return;
    }

    const videoId = crypto.randomUUID();

    startTransition(async () => {
      await saveVideoAction({
        id: videoId,
        campaignId,
        categoryId: initialCategories[0].id,
        title: `ویدیو ${initialVideos.length + 1}`,
        description: "",
        published: false,
        sortOrder: initialVideos.length + 1,
      });
      openEditor(videoId);
      toast.success("ویدیو جدید — فایل را آپلود کنید");
      refresh();
    });
  };

  const activeVersions = activeVideoId
    ? initialVersions.filter((version) => version.videoId === activeVideoId)
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">ویدیوها</h1>
          <p className="text-sm text-muted-foreground">
            نمای فشرده — روی کارت کلیک کنید یا با + ویدیو جدید بسازید
          </p>
        </div>
        <Button variant="outline" onClick={() => setCategoryOpen(true)}>
          <Plus className="h-4 w-4" /> دسته جدید
        </Button>
      </div>

      {initialCategories.length === 0 ? (
        <div className="rounded-xl border py-12 text-center text-muted-foreground">
          ابتدا یک دسته‌بندی بسازید.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {initialVideos.map((video) => (
            <AdminVideoCompactCard
              key={video.id}
              video={video}
              versions={initialVersions.filter((version) => version.videoId === video.id)}
              onClick={() => openEditor(video.id)}
            />
          ))}
          <AdminVideoAddCard onClick={handleCreateVideo} disabled={isPending} />
        </div>
      )}

      <Dialog open={editorOpen} onOpenChange={(open) => !open && closeEditor()}>
        <DialogContent className={editorDialogClass}>
          <DialogHeader>
            <DialogTitle>{activeVideo?.title ?? "ویرایش ویدیو"}</DialogTitle>
          </DialogHeader>
          {activeVideo && (
            <AdminVideoEditor
              video={activeVideo}
              versions={activeVersions}
              categories={initialCategories}
              onClose={closeEditor}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={categoryOpen} onOpenChange={setCategoryOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>افزودن دسته ویدیو</DialogTitle></DialogHeader>
          <form
            onSubmit={categoryForm.handleSubmit((data) => {
              startTransition(async () => {
                await saveCategoryAction({ ...data, campaignId, type: "video" });
                toast.success("ذخیره شد");
                setCategoryOpen(false);
                categoryForm.reset();
                refresh();
              });
            })}
            className="space-y-4"
          >
            <div><Label>عنوان</Label><Input {...categoryForm.register("title")} /></div>
            <div><Label>ترتیب</Label><Input type="number" {...categoryForm.register("sortOrder")} /></div>
            <Button type="submit" disabled={isPending}>ذخیره</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
