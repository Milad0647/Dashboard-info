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
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminVideoCard } from "@/components/admin/admin-video-card";
import { saveCategoryAction, saveVideoAction } from "@/lib/actions/admin-actions";
import type { MediaCategory, Video, VideoVersion } from "@/lib/types";

const categorySchema = z.object({ title: z.string().min(1), description: z.string().optional(), sortOrder: z.coerce.number(), published: z.boolean() });
const videoSchema = z.object({ categoryId: z.string().min(1), title: z.string().min(1), description: z.string().optional(), published: z.boolean() });

interface VideosAdminProps {
  campaignId: string;
  initialCategories: MediaCategory[];
  initialVideos: Video[];
  initialVersions: VideoVersion[];
}

export function VideosAdmin({ campaignId, initialCategories, initialVideos, initialVersions }: VideosAdminProps) {
  const router = useRouter();
  const [dialogType, setDialogType] = useState<"category" | "video" | null>(null);
  const [isPending, startTransition] = useTransition();

  const categoryForm = useForm({ resolver: zodResolver(categorySchema), defaultValues: { title: "", sortOrder: 1, published: true } });
  const videoForm = useForm({ resolver: zodResolver(videoSchema), defaultValues: { categoryId: initialCategories[0]?.id ?? "", title: "", published: true } });

  const refresh = () => router.refresh();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">ویدیوها</h1>
          <p className="text-sm text-muted-foreground">هر ویدیو یک کارت است — نسخه‌ها را داخل همان کارت اضافه کنید</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setDialogType("category")}><Plus className="h-4 w-4" /> دسته جدید</Button>
          <Button onClick={() => setDialogType("video")} disabled={initialCategories.length === 0}><Plus className="h-4 w-4" /> ویدیو جدید</Button>
        </div>
      </div>

      {initialCategories.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border rounded-xl">ابتدا یک دسته‌بندی بسازید.</div>
      ) : initialVideos.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border rounded-xl">ویدیویی وجود ندارد.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {initialVideos.map((video) => (
            <AdminVideoCard
              key={video.id}
              video={video}
              versions={initialVersions.filter((v) => v.videoId === video.id)}
              categories={initialCategories}
            />
          ))}
        </div>
      )}

      <Dialog open={dialogType === "category"} onOpenChange={(o) => !o && setDialogType(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>افزودن دسته ویدیو</DialogTitle></DialogHeader>
          <form onSubmit={categoryForm.handleSubmit((data) => { startTransition(async () => { await saveCategoryAction({ ...data, campaignId, type: "video" }); toast.success("ذخیره شد"); setDialogType(null); categoryForm.reset(); refresh(); }); })} className="space-y-4">
            <div><Label>عنوان</Label><Input {...categoryForm.register("title")} /></div>
            <div><Label>ترتیب</Label><Input type="number" {...categoryForm.register("sortOrder")} /></div>
            <Button type="submit" disabled={isPending}>ذخیره</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogType === "video"} onOpenChange={(o) => !o && setDialogType(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>ویدیو جدید</DialogTitle></DialogHeader>
          <form onSubmit={videoForm.handleSubmit((data) => { startTransition(async () => { await saveVideoAction({ ...data, campaignId, sortOrder: initialVideos.length + 1 }); toast.success("ویدیو ایجاد شد"); setDialogType(null); videoForm.reset({ categoryId: initialCategories[0]?.id ?? "", title: "", published: true }); refresh(); }); })} className="space-y-4">
            <div><Label>دسته</Label><Select value={videoForm.watch("categoryId")} onValueChange={(v) => videoForm.setValue("categoryId", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{initialCategories.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>عنوان</Label><Input {...videoForm.register("title")} /></div>
            <div className="flex items-center gap-2"><Switch checked={videoForm.watch("published")} onCheckedChange={(v) => videoForm.setValue("published", v)} /><Label>منتشر</Label></div>
            <Button type="submit" disabled={isPending}>ایجاد ویدیو</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
