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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { MediaUpload } from "@/components/ui/media-upload";
import { PersianDateField } from "@/components/ui/persian-date-input";
import { deleteSocialPostAction, saveSocialPostAction } from "@/lib/actions/extended-actions";
import { todayISO } from "@/lib/jalali";
import type { SocialContentType, SocialMediaPost, SocialPlatform } from "@/lib/types";
import { formatPersianDate, formatPersianNumber, getStatusLabel } from "@/lib/utils";

const schema = z.object({
  platform: z.enum(["instagram", "x", "telegram", "linkedin", "youtube", "aparat", "rubika", "eitaa", "bale", "other"]),
  title: z.string().min(1),
  coverImageUrl: z.string().optional(),
  views: z.coerce.number().min(0),
  likes: z.coerce.number().min(0),
  comments: z.coerce.number().min(0),
  shares: z.coerce.number().min(0),
  link: z.string().optional(),
  contentType: z.enum(["image", "text", "video", "carousel", "story", "reel"]),
  mediaUrl: z.string().optional(),
  description: z.string().optional(),
  publishedDate: z.string(),
  published: z.boolean(),
});

const platformOptions: SocialPlatform[] = [
  "instagram",
  "x",
  "telegram",
  "linkedin",
  "youtube",
  "aparat",
  "rubika",
  "eitaa",
  "bale",
  "other",
];

const contentTypeOptions: SocialContentType[] = ["image", "text", "video", "carousel", "story", "reel"];

interface SocialPostsAdminProps {
  campaignId: string;
  initialPosts: SocialMediaPost[];
  embedded?: boolean;
}

export function SocialPostsAdmin({ campaignId, initialPosts, embedded = false }: SocialPostsAdminProps) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rows, setRows] = useState(initialPosts);
  const [isPending, startTransition] = useTransition();

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      platform: "instagram" as SocialPlatform,
      title: "",
      coverImageUrl: "",
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      link: "",
      contentType: "image" as SocialContentType,
      mediaUrl: "",
      description: "",
      publishedDate: todayISO(),
      published: false,
    },
  });

  const openCreate = () => {
    setEditingId(null);
    form.reset({
      platform: "instagram",
      title: "",
      coverImageUrl: "",
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      link: "",
      contentType: "image",
      mediaUrl: "",
      description: "",
      publishedDate: todayISO(),
      published: false,
    });
    setOpen(true);
  };

  const openEdit = (post: SocialMediaPost) => {
    setEditingId(post.id);
    form.reset({
      platform: post.platform,
      title: post.title,
      coverImageUrl: post.coverImageUrl ?? "",
      views: post.views,
      likes: post.likes,
      comments: post.comments,
      shares: post.shares,
      link: post.link,
      contentType: post.contentType,
      mediaUrl: post.mediaUrl ?? "",
      description: post.description ?? "",
      publishedDate: post.publishedDate,
      published: post.published,
    });
    setOpen(true);
  };

  const onSubmit = form.handleSubmit((data) => {
    startTransition(async () => {
      const result = await saveSocialPostAction({ ...data, campaignId, id: editingId ?? undefined });
      if (!result.success) {
        toast.error("ذخیره نشد");
        return;
      }

      const savedId = "id" in result ? result.id : (editingId ?? crypto.randomUUID());

      if (editingId) {
        setRows((prev) =>
          prev.map((row) =>
            row.id === editingId
              ? { ...row, ...data, campaignId, link: data.link ?? "" } as SocialMediaPost
              : row
          )
        );
      } else {
        setRows((prev) => [
          ...prev,
          {
            id: savedId,
            campaignId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            sortOrder: prev.length,
            ...data,
            link: data.link ?? "",
          } as SocialMediaPost,
        ]);
      }

      toast.success("ذخیره شد");
      setOpen(false);
    });
  });

  return (
    <div className="space-y-4">
      {!embedded && (
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">شبکه‌های اجتماعی</h1>
            <p className="text-sm text-muted-foreground">ثبت پست‌ها، بازدید، لینک و نوع محتوا</p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            افزودن پست
          </Button>
        </div>
      )}

      {embedded && (
        <div className="flex items-center justify-end">
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            افزودن پست
          </Button>
        </div>
      )}

      <AdminDataTable
        data={rows}
        searchKeys={["title", "platform", "contentType"]}
        columns={[
          { key: "platform", label: "کانال", render: (item) => getStatusLabel(item.platform) },
          { key: "title", label: "عنوان / کاور" },
          { key: "views", label: "بازدید", render: (item) => formatPersianNumber(item.views) },
          { key: "contentType", label: "نوع", render: (item) => getStatusLabel(item.contentType) },
          { key: "publishedDate", label: "تاریخ", render: (item) => formatPersianDate(item.publishedDate) },
          { key: "published", label: "وضعیت", render: (item) => (item.published ? "منتشر" : "پیش‌نویس") },
        ]}
        onEdit={openEdit}
        onDelete={(item) => {
          startTransition(async () => {
            await deleteSocialPostAction(item.id);
            setRows((prev) => prev.filter((row) => row.id !== item.id));
            toast.success("حذف شد");
          });
        }}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "ویرایش پست" : "پست جدید"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>کانال</Label>
                <Select value={form.watch("platform")} onValueChange={(value) => form.setValue("platform", value as SocialPlatform)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {platformOptions.map((platform) => (
                      <SelectItem key={platform} value={platform}>{getStatusLabel(platform)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>نوع محتوا</Label>
                <Select value={form.watch("contentType")} onValueChange={(value) => form.setValue("contentType", value as SocialContentType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {contentTypeOptions.map((type) => (
                      <SelectItem key={type} value={type}>{getStatusLabel(type)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>عنوان / نام کاور</Label>
              <Input {...form.register("title")} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="space-y-2"><Label>بازدید</Label><Input type="number" {...form.register("views")} /></div>
              <div className="space-y-2"><Label>لایک</Label><Input type="number" {...form.register("likes")} /></div>
              <div className="space-y-2"><Label>کامنت</Label><Input type="number" {...form.register("comments")} /></div>
              <div className="space-y-2"><Label>اشتراک</Label><Input type="number" {...form.register("shares")} /></div>
            </div>

            <div className="space-y-2">
              <Label>لینک پست</Label>
              <Input {...form.register("link")} dir="ltr" />
            </div>

            <PersianDateField control={form.control} name="publishedDate" label="تاریخ انتشار" />

            <MediaUpload label="تصویر کاور" value={form.watch("coverImageUrl") ?? ""} onChange={(value) => form.setValue("coverImageUrl", value)} kind="image" />
            <MediaUpload label="رسانه (ویدیو/تصویر)" value={form.watch("mediaUrl") ?? ""} onChange={(value) => form.setValue("mediaUrl", value)} />

            <div className="space-y-2">
              <Label>توضیحات</Label>
              <Textarea
                {...form.register("description")}
                rows={4}
                placeholder="خلاصه پست، متن کپشن، نکات مهم یا توضیح محتوا"
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={form.watch("published")} onCheckedChange={(value) => form.setValue("published", value)} />
              <Label>منتشر شود</Label>
            </div>

            <Button type="submit" disabled={isPending} className="w-full">ذخیره</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
