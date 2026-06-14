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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AdminPosterAddCard, AdminPosterCompactCard } from "@/components/admin/admin-poster-compact-card";
import { AdminPosterEditor } from "@/components/admin/admin-poster-editor";
import { saveCategoryAction, savePosterAction } from "@/lib/actions/admin-actions";
import type { MediaCategory, Poster, PosterVersion } from "@/lib/types";

const categorySchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  sortOrder: z.coerce.number(),
  published: z.boolean(),
});

interface PostersAdminProps {
  campaignId: string;
  initialCategories: MediaCategory[];
  initialPosters: Poster[];
  initialVersions: PosterVersion[];
}

const editorDialogClass =
  "max-h-[92vh] max-w-2xl overflow-y-auto !top-4 !translate-x-[-50%] !translate-y-0 sm:!top-6";

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

export function PostersAdmin({
  campaignId,
  initialCategories,
  initialPosters,
  initialVersions,
}: PostersAdminProps) {
  const router = useRouter();
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [activePosterId, setActivePosterId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const categoryForm = useForm({
    resolver: zodResolver(categorySchema),
    defaultValues: { title: "", description: "", sortOrder: 1, published: true },
  });

  const activePoster = activePosterId
    ? initialPosters.find((poster) => poster.id === activePosterId) ?? null
    : null;

  const refresh = () => router.refresh();

  useEffect(() => {
    if (editorOpen) scrollToTop();
  }, [editorOpen]);

  const openEditor = (posterId: string) => {
    setActivePosterId(posterId);
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setActivePosterId(null);
  };

  const handleCreatePoster = () => {
    if (initialCategories.length === 0) {
      toast.error("ابتدا یک دسته بسازید");
      return;
    }

    const posterId = crypto.randomUUID();

    startTransition(async () => {
      await savePosterAction({
        id: posterId,
        campaignId,
        categoryId: initialCategories[0].id,
        title: `پوستر ${initialPosters.length + 1}`,
        description: "",
        published: false,
        sortOrder: initialPosters.length + 1,
      });
      openEditor(posterId);
      toast.success("پوستر جدید — تصویر را آپلود کنید");
      refresh();
    });
  };

  const saveCategory = categoryForm.handleSubmit((data) => {
    startTransition(async () => {
      await saveCategoryAction({ ...data, campaignId, type: "poster" });
      toast.success("دسته ذخیره شد");
      setCategoryOpen(false);
      categoryForm.reset();
      refresh();
    });
  });

  const activeVersions = activePosterId
    ? initialVersions.filter((version) => version.posterId === activePosterId)
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">پوسترها</h1>
          <p className="text-sm text-muted-foreground">
            نمای فشرده — روی کارت کلیک کنید یا با + پوستر جدید بسازید
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
          {initialPosters.map((poster) => (
            <AdminPosterCompactCard
              key={poster.id}
              poster={poster}
              versions={initialVersions.filter((version) => version.posterId === poster.id)}
              onClick={() => openEditor(poster.id)}
            />
          ))}
          <AdminPosterAddCard onClick={handleCreatePoster} disabled={isPending} />
        </div>
      )}

      <Dialog open={editorOpen} onOpenChange={(open) => !open && closeEditor()}>
        <DialogContent className={editorDialogClass}>
          <DialogHeader>
            <DialogTitle>{activePoster?.title ?? "ویرایش پوستر"}</DialogTitle>
          </DialogHeader>
          {activePoster && (
            <AdminPosterEditor
              poster={activePoster}
              versions={activeVersions}
              categories={initialCategories}
              onClose={closeEditor}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={categoryOpen} onOpenChange={setCategoryOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>افزودن دسته پوستر</DialogTitle></DialogHeader>
          <form onSubmit={saveCategory} className="space-y-4">
            <div><Label>عنوان</Label><Input {...categoryForm.register("title")} /></div>
            <div><Label>توضیحات</Label><Textarea {...categoryForm.register("description")} /></div>
            <div><Label>ترتیب</Label><Input type="number" {...categoryForm.register("sortOrder")} /></div>
            <div className="flex items-center gap-2">
              <Switch checked={categoryForm.watch("published")} onCheckedChange={(v) => categoryForm.setValue("published", v)} />
              <Label>منتشر</Label>
            </div>
            <Button type="submit" disabled={isPending}>ذخیره</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
