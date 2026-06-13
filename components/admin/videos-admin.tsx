"use client";

import { useState, useTransition } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { MediaUpload } from "@/components/ui/media-upload";
import { Badge } from "@/components/ui/badge";
import {
  saveCategoryAction,
  deleteCategoryAction,
  saveVideoAction,
  deleteVideoAction,
  saveVideoVersionAction,
  deleteVideoVersionAction,
} from "@/lib/actions/admin-actions";
import type { MediaCategory, Video, VideoVersion } from "@/lib/types";
import { getStatusLabel } from "@/lib/utils";

const categorySchema = z.object({ title: z.string().min(1), description: z.string().optional(), sortOrder: z.coerce.number(), published: z.boolean() });
const videoSchema = z.object({ categoryId: z.string().min(1), title: z.string().min(1), description: z.string().optional(), published: z.boolean(), sortOrder: z.coerce.number() });
const versionSchema = z.object({ videoId: z.string().min(1), versionNumber: z.coerce.number(), videoUrl: z.string().min(1), thumbnailUrl: z.string().optional(), duration: z.string().optional(), notes: z.string().optional(), status: z.enum(["draft", "revised", "final"]), isFinal: z.boolean(), date: z.string() });

interface VideosAdminProps {
  campaignId: string;
  initialCategories: MediaCategory[];
  initialVideos: Video[];
  initialVersions: VideoVersion[];
}

export function VideosAdmin({ campaignId, initialCategories, initialVideos, initialVersions }: VideosAdminProps) {
  const [categories, setCategories] = useState(initialCategories);
  const [videos, setVideos] = useState(initialVideos);
  const [versions, setVersions] = useState(initialVersions);
  const [dialogType, setDialogType] = useState<"category" | "video" | "version" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const categoryForm = useForm({ resolver: zodResolver(categorySchema), defaultValues: { title: "", sortOrder: 1, published: true } });
  const videoForm = useForm({ resolver: zodResolver(videoSchema), defaultValues: { categoryId: "", title: "", published: false, sortOrder: 1 } });
  const versionForm = useForm({ resolver: zodResolver(versionSchema), defaultValues: { videoId: "", versionNumber: 1, videoUrl: "", status: "draft" as const, isFinal: false, date: new Date().toISOString().split("T")[0] } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ویدیوها</h1>
        <p className="text-sm text-muted-foreground">مدیریت دسته‌بندی، ویدیوها و نسخه‌ها</p>
      </div>

      <Tabs defaultValue="videos">
        <TabsList>
          <TabsTrigger value="categories">دسته‌بندی‌ها</TabsTrigger>
          <TabsTrigger value="videos">ویدیوها</TabsTrigger>
          <TabsTrigger value="versions">نسخه‌ها</TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="space-y-4">
          <Button onClick={() => { setEditingId(null); categoryForm.reset(); setDialogType("category"); }}><Plus className="h-4 w-4" /> افزودن</Button>
          <AdminDataTable data={categories} searchKeys={["title"]} columns={[{ key: "title", label: "عنوان" }, { key: "sortOrder", label: "ترتیب" }]}
            onEdit={(i) => { setEditingId(i.id); categoryForm.reset({ title: i.title, description: i.description ?? undefined, sortOrder: i.sortOrder, published: i.published }); setDialogType("category"); }}
            onDelete={(i) => { startTransition(async () => { await deleteCategoryAction(i.id, "video"); setCategories((p) => p.filter((c) => c.id !== i.id)); toast.success("حذف شد"); }); }}
          />
        </TabsContent>

        <TabsContent value="videos" className="space-y-4">
          <Button onClick={() => { setEditingId(null); videoForm.reset({ categoryId: categories[0]?.id ?? "" }); setDialogType("video"); }}><Plus className="h-4 w-4" /> افزودن</Button>
          <AdminDataTable data={videos} searchKeys={["title"]} columns={[
            { key: "title", label: "عنوان" },
            { key: "categoryId", label: "دسته", render: (i) => categories.find((c) => c.id === i.categoryId)?.title ?? "—" },
            { key: "published", label: "انتشار", render: (i) => <Badge variant={i.published ? "success" : "secondary"}>{i.published ? "بله" : "خیر"}</Badge> },
          ]}
            onEdit={(i) => { setEditingId(i.id); videoForm.reset({ categoryId: i.categoryId, title: i.title, description: i.description ?? undefined, published: i.published, sortOrder: i.sortOrder }); setDialogType("video"); }}
            onDelete={(i) => { startTransition(async () => { await deleteVideoAction(i.id); setVideos((p) => p.filter((v) => v.id !== i.id)); toast.success("حذف شد"); }); }}
            onTogglePublish={(i) => { startTransition(async () => { const u = { ...i, published: !i.published }; await saveVideoAction(u); setVideos((p) => p.map((v) => v.id === i.id ? u : v)); toast.success("بروز شد"); }); }}
            getPublished={(i) => i.published}
          />
        </TabsContent>

        <TabsContent value="versions" className="space-y-4">
          <Button onClick={() => { setEditingId(null); versionForm.reset({ videoId: videos[0]?.id ?? "" }); setDialogType("version"); }}><Plus className="h-4 w-4" /> افزودن نسخه</Button>
          <AdminDataTable data={versions} searchKeys={["videoId"]} columns={[
            { key: "videoId", label: "ویدیو", render: (i) => videos.find((v) => v.id === i.videoId)?.title ?? "—" },
            { key: "versionNumber", label: "نسخه" },
            { key: "duration", label: "مدت" },
            { key: "status", label: "وضعیت", render: (i) => <Badge status={i.status}>{getStatusLabel(i.status)}</Badge> },
          ]}
            onEdit={(i) => { setEditingId(i.id); versionForm.reset({ videoId: i.videoId, versionNumber: i.versionNumber, videoUrl: i.videoUrl, thumbnailUrl: i.thumbnailUrl, duration: i.duration ?? undefined, notes: i.notes ?? undefined, status: i.status, isFinal: i.isFinal, date: i.date }); setDialogType("version"); }}
            onDelete={(i) => { startTransition(async () => { await deleteVideoVersionAction(i.id); setVersions((p) => p.filter((v) => v.id !== i.id)); toast.success("حذف شد"); }); }}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={dialogType === "category"} onOpenChange={(o) => !o && setDialogType(null)}>
        <DialogContent><DialogHeader><DialogTitle>دسته ویدیو</DialogTitle></DialogHeader>
          <form onSubmit={categoryForm.handleSubmit((data) => { startTransition(async () => { await saveCategoryAction({ ...data, campaignId, id: editingId ?? undefined, type: "video" }); if (editingId) setCategories((p) => p.map((c) => c.id === editingId ? { ...c, ...data } as MediaCategory : c)); else setCategories((p) => [...p, { id: crypto.randomUUID(), campaignId, type: "video", createdAt: new Date().toISOString(), ...data }]); toast.success("ذخیره شد"); setDialogType(null); }); })} className="space-y-4">
            <div><Label>عنوان</Label><Input {...categoryForm.register("title")} /></div>
            <div><Label>ترتیب</Label><Input type="number" {...categoryForm.register("sortOrder")} /></div>
            <Button type="submit">ذخیره</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogType === "video"} onOpenChange={(o) => !o && setDialogType(null)}>
        <DialogContent><DialogHeader><DialogTitle>ویدیو</DialogTitle></DialogHeader>
          <form onSubmit={videoForm.handleSubmit((data) => { startTransition(async () => { await saveVideoAction({ ...data, campaignId, id: editingId ?? undefined }); if (editingId) setVideos((p) => p.map((v) => v.id === editingId ? { ...v, ...data } as Video : v)); else setVideos((p) => [...p, { id: crypto.randomUUID(), campaignId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...data }]); toast.success("ذخیره شد"); setDialogType(null); }); })} className="space-y-4">
            <div><Label>دسته</Label><Select value={videoForm.watch("categoryId")} onValueChange={(v) => videoForm.setValue("categoryId", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>عنوان</Label><Input {...videoForm.register("title")} /></div>
            <div className="flex items-center gap-2"><Switch checked={videoForm.watch("published")} onCheckedChange={(v) => videoForm.setValue("published", v)} /><Label>منتشر</Label></div>
            <Button type="submit">ذخیره</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogType === "version"} onOpenChange={(o) => !o && setDialogType(null)}>
        <DialogContent><DialogHeader><DialogTitle>نسخه ویدیو</DialogTitle></DialogHeader>
          <form onSubmit={versionForm.handleSubmit((data) => {
            startTransition(async () => {
              const { ...rest } = data;
              const payload = { ...rest, thumbnailUrl: data.thumbnailUrl || "https://via.placeholder.com/400x225" };
              await saveVideoVersionAction({ ...payload, id: editingId ?? undefined, videoId: data.videoId });
              if (editingId) {
                setVersions((p) => p.map((v) => v.id === editingId ? { ...v, ...payload } as VideoVersion : v));
              } else {
                const newVersion: VideoVersion = { ...payload, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
                setVersions((p) => [...p, newVersion]);
              }
              toast.success("ذخیره شد");
              setDialogType(null);
            });
          })} className="space-y-4">
            <div><Label>ویدیو</Label><Select value={versionForm.watch("videoId")} onValueChange={(v) => versionForm.setValue("videoId", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{videos.map((v) => <SelectItem key={v.id} value={v.id}>{v.title}</SelectItem>)}</SelectContent></Select></div>
            <MediaUpload
              label="ویدیو"
              kind="video"
              value={versionForm.watch("videoUrl")}
              onChange={(url) => versionForm.setValue("videoUrl", url)}
            />
            <MediaUpload
              label="تصویر بندانگشتی"
              value={versionForm.watch("thumbnailUrl") ?? ""}
              onChange={(url) => versionForm.setValue("thumbnailUrl", url)}
            />
            <div><Label>مدت</Label><Input {...versionForm.register("duration")} placeholder="0:30" /></div>
            <div className="flex items-center gap-2"><Switch checked={versionForm.watch("isFinal")} onCheckedChange={(v) => versionForm.setValue("isFinal", v)} /><Label>نسخه نهایی</Label></div>
            <Button type="submit">ذخیره</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
