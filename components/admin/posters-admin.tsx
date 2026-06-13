"use client";

import { useState, useTransition } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminPosterCard } from "@/components/admin/admin-poster-card";
import {
  saveCategoryAction,
  savePosterAction,
} from "@/lib/actions/admin-actions";
import type { MediaCategory, Poster, PosterVersion } from "@/lib/types";

const categorySchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  sortOrder: z.coerce.number(),
  published: z.boolean(),
});

const posterSchema = z.object({
  categoryId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  published: z.boolean(),
});

interface PostersAdminProps {
  campaignId: string;
  initialCategories: MediaCategory[];
  initialPosters: Poster[];
  initialVersions: PosterVersion[];
}

export function PostersAdmin({
  campaignId,
  initialCategories,
  initialPosters,
  initialVersions,
}: PostersAdminProps) {
  const router = useRouter();
  const [dialogType, setDialogType] = useState<"category" | "poster" | null>(null);
  const [isPending, startTransition] = useTransition();

  const categoryForm = useForm({
    resolver: zodResolver(categorySchema),
    defaultValues: { title: "", description: "", sortOrder: 1, published: true },
  });

  const posterForm = useForm({
    resolver: zodResolver(posterSchema),
    defaultValues: { categoryId: initialCategories[0]?.id ?? "", title: "", description: "", published: true },
  });

  const refresh = () => router.refresh();

  const saveCategory = categoryForm.handleSubmit((data) => {
    startTransition(async () => {
      await saveCategoryAction({ ...data, campaignId, type: "poster" });
      toast.success("دسته ذخیره شد");
      setDialogType(null);
      categoryForm.reset();
      refresh();
    });
  });

  const savePoster = posterForm.handleSubmit((data) => {
    startTransition(async () => {
      await savePosterAction({ ...data, campaignId, sortOrder: initialPosters.length + 1 });
      toast.success("پوستر ایجاد شد");
      setDialogType(null);
      posterForm.reset({ categoryId: initialCategories[0]?.id ?? "", title: "", description: "", published: true });
      refresh();
    });
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">پوسترها</h1>
          <p className="text-sm text-muted-foreground">هر پوستر یک کارت است — نسخه‌ها را داخل همان کارت اضافه کنید</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setDialogType("category")}>
            <Plus className="h-4 w-4" /> دسته جدید
          </Button>
          <Button onClick={() => setDialogType("poster")} disabled={initialCategories.length === 0}>
            <Plus className="h-4 w-4" /> پوستر جدید
          </Button>
        </div>
      </div>

      {initialCategories.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border rounded-xl">
          ابتدا یک دسته‌بندی بسازید.
        </div>
      ) : initialPosters.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border rounded-xl">
          پوستری وجود ندارد. «پوستر جدید» را بزنید.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {initialPosters.map((poster) => (
            <AdminPosterCard
              key={poster.id}
              poster={poster}
              versions={initialVersions.filter((v) => v.posterId === poster.id)}
              categories={initialCategories}
            />
          ))}
        </div>
      )}

      <Dialog open={dialogType === "category"} onOpenChange={(o) => !o && setDialogType(null)}>
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

      <Dialog open={dialogType === "poster"} onOpenChange={(o) => !o && setDialogType(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>پوستر جدید</DialogTitle></DialogHeader>
          <form onSubmit={savePoster} className="space-y-4">
            <div>
              <Label>دسته</Label>
              <Select value={posterForm.watch("categoryId")} onValueChange={(v) => posterForm.setValue("categoryId", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {initialCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>عنوان</Label><Input {...posterForm.register("title")} /></div>
            <div><Label>توضیحات</Label><Textarea {...posterForm.register("description")} /></div>
            <div className="flex items-center gap-2">
              <Switch checked={posterForm.watch("published")} onCheckedChange={(v) => posterForm.setValue("published", v)} />
              <Label>منتشر</Label>
            </div>
            <Button type="submit" disabled={isPending}>ایجاد پوستر</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
