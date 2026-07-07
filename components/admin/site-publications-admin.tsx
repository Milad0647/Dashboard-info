"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AdminCompactAddCard } from "@/components/admin/admin-compact-add-card";
import { AdminSitePublicationCompactCard } from "@/components/admin/admin-site-publication-compact-card";
import { MediaUpload } from "@/components/ui/media-upload";
import { PersianDateField } from "@/components/ui/persian-date-input";
import { deleteSocialPostAction, saveSocialPostAction } from "@/lib/actions/extended-actions";
import { todayISO } from "@/lib/jalali";
import { isSitePublication } from "@/lib/social-posts";
import type { SocialMediaPost } from "@/lib/types";

const schema = z.object({
  title: z.string().min(1, "عنوان الزامی است"),
  link: z.string().url("لینک معتبر وارد کنید"),
  coverImageUrl: z.string().optional(),
  description: z.string().optional(),
  publishedDate: z.string(),
  published: z.boolean(),
});

interface SitePublicationsAdminProps {
  campaignId: string;
  initialPosts: SocialMediaPost[];
}

export function SitePublicationsAdmin({ campaignId, initialPosts }: SitePublicationsAdminProps) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rows, setRows] = useState(initialPosts.filter(isSitePublication));
  const [isPending, startTransition] = useTransition();

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      link: "",
      coverImageUrl: "",
      description: "",
      publishedDate: todayISO(),
      published: false,
    },
  });

  const openCreate = () => {
    setEditingId(null);
    form.reset({
      title: "",
      link: "",
      coverImageUrl: "",
      description: "",
      publishedDate: todayISO(),
      published: false,
    });
    setOpen(true);
  };

  const openEdit = (post: SocialMediaPost) => {
    setEditingId(post.id);
    form.reset({
      title: post.title,
      link: post.link,
      coverImageUrl: post.coverImageUrl ?? "",
      description: post.description ?? "",
      publishedDate: post.publishedDate,
      published: post.published,
    });
    setOpen(true);
  };

  const onSubmit = form.handleSubmit((data) => {
    startTransition(async () => {
      const result = await saveSocialPostAction({
        campaignId,
        id: editingId ?? undefined,
        platform: "site",
        contentType: "text",
        title: data.title,
        link: data.link,
        coverImageUrl: data.coverImageUrl || null,
        description: data.description || null,
        publishedDate: data.publishedDate,
        published: data.published,
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
      });

      if (!result.success) {
        toast.error("error" in result ? result.error : "ذخیره نشد");
        return;
      }

      const savedId = "id" in result ? result.id : (editingId ?? crypto.randomUUID());
      const nextPost: SocialMediaPost = {
        id: savedId,
        campaignId,
        platform: "site",
        title: data.title,
        link: data.link,
        coverImageUrl: data.coverImageUrl || null,
        description: data.description || null,
        publishedDate: data.publishedDate,
        published: data.published,
        contentType: "text",
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        sortOrder: rows.length + 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setRows((prev) =>
        editingId ? prev.map((row) => (row.id === editingId ? { ...row, ...nextPost } : row)) : [...prev, nextPost]
      );
      toast.success("ذخیره شد");
      setOpen(false);
    });
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">انتشار در سایت</h1>
          <p className="text-sm text-muted-foreground">
            ثبت مطالب منتشرشده در سایت با عنوان لینک‌دار، تاریخ و توضیح
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          انتشار جدید
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {rows.map((post) => (
          <AdminSitePublicationCompactCard key={post.id} post={post} onClick={() => openEdit(post)} />
        ))}
        <AdminCompactAddCard onClick={openCreate} label="انتشار جدید" />
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "ویرایش انتشار" : "انتشار جدید در سایت"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>عنوان (به‌صورت لینک نمایش داده می‌شود)</Label>
              <Input {...form.register("title")} placeholder="عنوان مطلب در سایت" />
            </div>
            <div className="space-y-2">
              <Label>لینک مطلب</Label>
              <Input {...form.register("link")} dir="ltr" placeholder="https://example.com/article" />
            </div>
            <PersianDateField control={form.control} name="publishedDate" label="تاریخ انتشار" />
            <div className="space-y-2">
              <Label>تصویر شاخص (اختیاری)</Label>
              <MediaUpload
                value={form.watch("coverImageUrl") ?? ""}
                onChange={(url) => form.setValue("coverImageUrl", url)}
                accept="image/*"
              />
            </div>
            <div className="space-y-2">
              <Label>توضیح (اختیاری)</Label>
              <Textarea {...form.register("description")} rows={3} placeholder="خلاصه یا یادداشت درباره این انتشار" />
            </div>
            <label className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <span>منتشر در صفحه عمومی</span>
              <Switch checked={form.watch("published")} onCheckedChange={(value) => form.setValue("published", value)} />
            </label>
            <Button type="submit" disabled={isPending} className="w-full">
              ذخیره
            </Button>
            {editingId && (
              <Button
                type="button"
                variant="destructive"
                className="w-full"
                disabled={isPending}
                onClick={() => {
                  startTransition(async () => {
                    await deleteSocialPostAction(editingId);
                    setRows((prev) => prev.filter((row) => row.id !== editingId));
                    toast.success("حذف شد");
                    setOpen(false);
                  });
                }}
              >
                حذف انتشار
              </Button>
            )}
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
