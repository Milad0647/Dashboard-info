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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { MediaUpload } from "@/components/ui/media-upload";
import { PersianDateField } from "@/components/ui/persian-date-input";
import { Badge } from "@/components/ui/badge";
import {
  saveCategoryAction,
  deleteCategoryAction,
  savePosterAction,
  deletePosterAction,
  savePosterVersionAction,
  deletePosterVersionAction,
} from "@/lib/actions/admin-actions";
import { todayISO } from "@/lib/jalali";
import type { MediaCategory, Poster, PosterVersion } from "@/lib/types";
import { getStatusLabel } from "@/lib/utils";

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
  sortOrder: z.coerce.number(),
});

const versionSchema = z.object({
  posterId: z.string().min(1),
  versionNumber: z.coerce.number(),
  imageUrl: z.string().min(1),
  thumbnailUrl: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(["draft", "revised", "final"]),
  isFinal: z.boolean(),
  date: z.string(),
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
  const [categories, setCategories] = useState(initialCategories);
  const [posters, setPosters] = useState(initialPosters);
  const [versions, setVersions] = useState(initialVersions);
  const [dialogType, setDialogType] = useState<"category" | "poster" | "version" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const categoryForm = useForm({ resolver: zodResolver(categorySchema), defaultValues: { title: "", description: "", sortOrder: 1, published: true } });
  const posterForm = useForm({ resolver: zodResolver(posterSchema), defaultValues: { categoryId: "", title: "", description: "", published: false, sortOrder: 1 } });
  const versionForm = useForm({ resolver: zodResolver(versionSchema), defaultValues: { posterId: "", versionNumber: 1, imageUrl: "", thumbnailUrl: "", notes: "", status: "draft" as const, isFinal: false, date: todayISO() } });

  const saveCategory = categoryForm.handleSubmit((data) => {
    startTransition(async () => {
      await saveCategoryAction({ ...data, campaignId, id: editingId ?? undefined, type: "poster" });
      if (editingId) {
        setCategories((prev) => prev.map((c) => c.id === editingId ? { ...c, ...data } as MediaCategory : c));
      } else {
        setCategories((prev) => [...prev, { id: crypto.randomUUID(), campaignId, type: "poster", createdAt: new Date().toISOString(), ...data }]);
      }
      toast.success("ذخیره شد");
      setDialogType(null);
    });
  });

  const savePoster = posterForm.handleSubmit((data) => {
    startTransition(async () => {
      await savePosterAction({ ...data, campaignId, id: editingId ?? undefined });
      if (editingId) {
        setPosters((prev) => prev.map((p) => p.id === editingId ? { ...p, ...data, updatedAt: new Date().toISOString() } as Poster : p));
      } else {
        setPosters((prev) => [...prev, { id: crypto.randomUUID(), campaignId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...data }]);
      }
      toast.success("ذخیره شد");
      setDialogType(null);
    });
  });

  const saveVersion = versionForm.handleSubmit((data) => {
    startTransition(async () => {
      const payload = { ...data, thumbnailUrl: data.thumbnailUrl || data.imageUrl };
      await savePosterVersionAction({ ...payload, id: editingId ?? undefined, posterId: data.posterId });
      if (editingId) {
        setVersions((prev) => prev.map((v) => v.id === editingId ? { ...v, ...payload } as PosterVersion : v));
      } else {
        const newVersion: PosterVersion = {
          ...payload,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        };
        setVersions((prev) => [...prev, newVersion]);
      }
      if (data.isFinal) {
        setVersions((prev) => prev.map((v) => v.posterId === data.posterId && v.id !== editingId ? { ...v, isFinal: false } : v));
      }
      toast.success("نسخه ذخیره شد");
      setDialogType(null);
    });
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">پوسترها</h1>
        <p className="text-sm text-muted-foreground">مدیریت دسته‌بندی، پوسترها و نسخه‌ها</p>
      </div>

      <Tabs defaultValue="posters">
        <TabsList>
          <TabsTrigger value="categories">دسته‌بندی‌ها</TabsTrigger>
          <TabsTrigger value="posters">پوسترها</TabsTrigger>
          <TabsTrigger value="versions">نسخه‌ها</TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="space-y-4">
          <Button onClick={() => { setEditingId(null); categoryForm.reset(); setDialogType("category"); }}>
            <Plus className="h-4 w-4" /> افزودن دسته
          </Button>
          <AdminDataTable
            data={categories}
            searchKeys={["title"]}
            columns={[
              { key: "title", label: "عنوان" },
              { key: "sortOrder", label: "ترتیب" },
              { key: "published", label: "انتشار", render: (i) => <Badge variant={i.published ? "success" : "secondary"}>{i.published ? "بله" : "خیر"}</Badge> },
            ]}
            onEdit={(item) => { setEditingId(item.id); categoryForm.reset({ title: item.title, description: item.description ?? undefined, sortOrder: item.sortOrder, published: item.published }); setDialogType("category"); }}
            onDelete={(item) => { startTransition(async () => { await deleteCategoryAction(item.id, "poster"); setCategories((p) => p.filter((c) => c.id !== item.id)); toast.success("حذف شد"); }); }}
          />
        </TabsContent>

        <TabsContent value="posters" className="space-y-4">
          <Button onClick={() => { setEditingId(null); posterForm.reset({ categoryId: categories[0]?.id ?? "" }); setDialogType("poster"); }}>
            <Plus className="h-4 w-4" /> افزودن پوستر
          </Button>
          <AdminDataTable
            data={posters}
            searchKeys={["title"]}
            columns={[
              { key: "title", label: "عنوان" },
              { key: "categoryId", label: "دسته", render: (i) => categories.find((c) => c.id === i.categoryId)?.title ?? "—" },
              { key: "published", label: "انتشار", render: (i) => <Badge variant={i.published ? "success" : "secondary"}>{i.published ? "بله" : "خیر"}</Badge> },
            ]}
            onEdit={(item) => { setEditingId(item.id); posterForm.reset({ categoryId: item.categoryId, title: item.title, description: item.description ?? undefined, published: item.published, sortOrder: item.sortOrder }); setDialogType("poster"); }}
            onDelete={(item) => { startTransition(async () => { await deletePosterAction(item.id); setPosters((p) => p.filter((x) => x.id !== item.id)); toast.success("حذف شد"); }); }}
            onTogglePublish={(item) => { startTransition(async () => { const u = { ...item, published: !item.published }; await savePosterAction(u); setPosters((p) => p.map((x) => x.id === item.id ? u : x)); toast.success("بروز شد"); }); }}
            getPublished={(i) => i.published}
          />
        </TabsContent>

        <TabsContent value="versions" className="space-y-4">
          <Button onClick={() => { setEditingId(null); versionForm.reset({ posterId: posters[0]?.id ?? "", versionNumber: 1 }); setDialogType("version"); }}>
            <Plus className="h-4 w-4" /> افزودن نسخه
          </Button>
          <AdminDataTable
            data={versions}
            searchKeys={["posterId"]}
            columns={[
              { key: "posterId", label: "پوستر", render: (i) => posters.find((p) => p.id === i.posterId)?.title ?? "—" },
              { key: "versionNumber", label: "نسخه" },
              { key: "status", label: "وضعیت", render: (i) => <Badge status={i.status}>{getStatusLabel(i.status)}</Badge> },
              { key: "isFinal", label: "نهایی", render: (i) => i.isFinal ? <Badge status="final">نسخه نهایی</Badge> : "—" },
            ]}
            onEdit={(item) => { setEditingId(item.id); versionForm.reset({ posterId: item.posterId, versionNumber: item.versionNumber, imageUrl: item.imageUrl, thumbnailUrl: item.thumbnailUrl, notes: item.notes ?? undefined, status: item.status, isFinal: item.isFinal, date: item.date }); setDialogType("version"); }}
            onDelete={(item) => { startTransition(async () => { await deletePosterVersionAction(item.id); setVersions((p) => p.filter((v) => v.id !== item.id)); toast.success("حذف شد"); }); }}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={dialogType === "category"} onOpenChange={(o) => !o && setDialogType(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? "ویرایش" : "افزودن"} دسته</DialogTitle></DialogHeader>
          <form onSubmit={saveCategory} className="space-y-4">
            <div><Label>عنوان</Label><Input {...categoryForm.register("title")} /></div>
            <div><Label>توضیحات</Label><Textarea {...categoryForm.register("description")} /></div>
            <div><Label>ترتیب</Label><Input type="number" {...categoryForm.register("sortOrder")} /></div>
            <div className="flex items-center gap-2"><Switch checked={categoryForm.watch("published")} onCheckedChange={(v) => categoryForm.setValue("published", v)} /><Label>منتشر</Label></div>
            <Button type="submit" disabled={isPending}>ذخیره تغییرات</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogType === "poster"} onOpenChange={(o) => !o && setDialogType(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? "ویرایش" : "افزودن"} پوستر</DialogTitle></DialogHeader>
          <form onSubmit={savePoster} className="space-y-4">
            <div><Label>دسته</Label>
              <Select value={posterForm.watch("categoryId")} onValueChange={(v) => posterForm.setValue("categoryId", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>عنوان</Label><Input {...posterForm.register("title")} /></div>
            <div><Label>توضیحات</Label><Textarea {...posterForm.register("description")} /></div>
            <div><Label>ترتیب</Label><Input type="number" {...posterForm.register("sortOrder")} /></div>
            <div className="flex items-center gap-2"><Switch checked={posterForm.watch("published")} onCheckedChange={(v) => posterForm.setValue("published", v)} /><Label>منتشر</Label></div>
            <Button type="submit" disabled={isPending}>ذخیره تغییرات</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogType === "version"} onOpenChange={(o) => !o && setDialogType(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? "ویرایش" : "افزودن"} نسخه</DialogTitle></DialogHeader>
          <form onSubmit={saveVersion} className="space-y-4">
            <div><Label>پوستر</Label>
              <Select value={versionForm.watch("posterId")} onValueChange={(v) => versionForm.setValue("posterId", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{posters.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>شماره نسخه</Label><Input type="number" {...versionForm.register("versionNumber")} /></div>
              <PersianDateField control={versionForm.control} name="date" label="تاریخ (شمسی)" />
            </div>
            <MediaUpload
              label="تصویر"
              value={versionForm.watch("imageUrl")}
              onChange={(url) => versionForm.setValue("imageUrl", url)}
            />
            <div><Label>یادداشت</Label><Textarea {...versionForm.register("notes")} /></div>
            <div><Label>وضعیت</Label>
              <Select value={versionForm.watch("status")} onValueChange={(v) => versionForm.setValue("status", v as "draft" | "revised" | "final")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">پیش‌نویس</SelectItem>
                  <SelectItem value="revised">بازبینی</SelectItem>
                  <SelectItem value="final">نهایی</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2"><Switch checked={versionForm.watch("isFinal")} onCheckedChange={(v) => versionForm.setValue("isFinal", v)} /><Label>نسخه نهایی</Label></div>
            <Button type="submit" disabled={isPending}>ذخیره تغییرات</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
