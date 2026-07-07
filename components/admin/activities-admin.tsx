"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminActivityCompactCard } from "@/components/admin/admin-activity-compact-card";
import { AdminCompactAddCard } from "@/components/admin/admin-compact-add-card";
import { MediaUpload } from "@/components/ui/media-upload";
import { PersianDateField } from "@/components/ui/persian-date-input";
import { fieldActivityTypeOptions, getActivityTypeLabel } from "@/lib/activity-types";
import { deleteCampaignActivityAction, saveCampaignActivityAction } from "@/lib/actions/extended-actions";
import { todayISO } from "@/lib/jalali";
import { isPressPublication } from "@/lib/press-publications";
import type { ActivityMediaItem, ActivityType, CampaignActivity } from "@/lib/types";

const ACTIVITY_VIDEO_MAX_BYTES = 50 * 1024 * 1024;

const MAX_MEDIA_ITEMS = 10;

const schema = z.object({
  title: z.string().min(1, "عنوان الزامی است"),
  activityType: z.enum([
    "tract",
    "booth",
    "field",
    "poetry",
    "painting",
    "exhibition",
    "other",
  ]),
  activityDate: z.string(),
  location: z.string().optional(),
  imageUrl: z.string().optional(),
  videoUrl: z.string().optional(),
  description: z.string().optional(),
  published: z.boolean(),
});

type FormData = z.infer<typeof schema>;
type FieldActivityType = FormData["activityType"];

interface ActivitiesAdminProps {
  campaignId: string;
  initialActivities: CampaignActivity[];
}

function resolveFieldActivityType(type: ActivityType): FieldActivityType {
  return fieldActivityTypeOptions.includes(type) ? (type as FieldActivityType) : "field";
}

export function ActivitiesAdmin({ campaignId, initialActivities }: ActivitiesAdminProps) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [mediaItems, setMediaItems] = useState<ActivityMediaItem[]>([]);
  const [rows, setRows] = useState(
    initialActivities.filter((activity) => !isPressPublication(activity))
  );
  const [isPending, startTransition] = useTransition();

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      activityType: "field",
      activityDate: todayISO(),
      location: "",
      imageUrl: "",
      videoUrl: "",
      description: "",
      published: false,
    },
  });

  const openCreate = () => {
    setEditingId(null);
    setMediaItems([]);
    form.reset({
      title: "",
      activityType: "field",
      activityDate: todayISO(),
      location: "",
      imageUrl: "",
      videoUrl: "",
      description: "",
      published: false,
    });
    setOpen(true);
  };

  const openEdit = (activity: CampaignActivity) => {
    setEditingId(activity.id);
    setMediaItems(activity.mediaItems ?? []);
    form.reset({
      title: activity.title,
      activityType: resolveFieldActivityType(activity.activityType),
      activityDate: activity.activityDate,
      location: activity.location,
      imageUrl: activity.imageUrl ?? "",
      videoUrl: activity.videoUrl ?? "",
      description: activity.description ?? "",
      published: activity.published,
    });
    setOpen(true);
  };

  const addMediaItem = (type: "image" | "video") => {
    if (mediaItems.length >= MAX_MEDIA_ITEMS) {
      toast.error(`حداکثر ${MAX_MEDIA_ITEMS} فایل مجاز است`);
      return;
    }
    setMediaItems((prev) => [...prev, { id: crypto.randomUUID(), type, url: "" }]);
  };

  const onSubmit = form.handleSubmit((data) => {
    const filledMedia = mediaItems.filter((item) => item.url.trim());
    startTransition(async () => {
      const result = await saveCampaignActivityAction({
        campaignId,
        id: editingId ?? undefined,
        title: data.title,
        activityType: data.activityType,
        activityDate: data.activityDate,
        location: data.location?.trim() ?? "",
        imageUrl: filledMedia.find((item) => item.type === "image")?.url ?? (data.imageUrl || null),
        videoUrl: filledMedia.find((item) => item.type === "video")?.url ?? (data.videoUrl || null),
        mediaItems: filledMedia,
        description: data.description || null,
        published: data.published,
      });

      if (!result.success) {
        toast.error("error" in result ? result.error : "ذخیره نشد");
        return;
      }

      const savedId = "id" in result ? result.id : (editingId ?? crypto.randomUUID());
      const nextActivity: CampaignActivity = {
        id: savedId,
        campaignId,
        title: data.title,
        activityType: data.activityType,
        activityDate: data.activityDate,
        location: data.location?.trim() ?? "",
        imageUrl: filledMedia.find((item) => item.type === "image")?.url ?? (data.imageUrl || null),
        videoUrl: filledMedia.find((item) => item.type === "video")?.url ?? (data.videoUrl || null),
        mediaItems: filledMedia,
        description: data.description || null,
        published: data.published,
        sortOrder: rows.length + 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setRows((prev) =>
        editingId
          ? prev.map((row) => (row.id === editingId ? { ...row, ...nextActivity } : row))
          : [...prev, nextActivity]
      );
      toast.success("ذخیره شد");
      setOpen(false);
    });
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">اقدامات</h1>
          <p className="text-sm text-muted-foreground">
            ثبت فعالیت‌های میدانی: تراکت، غرفه، شعرخوانی، نقاشی و ... (تا {MAX_MEDIA_ITEMS} رسانه)
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          اقدام جدید
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {rows.map((activity) => (
          <AdminActivityCompactCard key={activity.id} activity={activity} onClick={() => openEdit(activity)} />
        ))}
        <AdminCompactAddCard onClick={openCreate} label="اقدام جدید" />
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "ویرایش اقدام" : "اقدام جدید"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>عنوان</Label>
              <Input {...form.register("title")} placeholder="مثلاً غرفه‌گذاری در نمایشگاه کتاب" />
            </div>
            <div className="space-y-2">
              <Label>نوع اقدام</Label>
              <Select
                value={form.watch("activityType")}
                onValueChange={(value) => form.setValue("activityType", value as FieldActivityType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fieldActivityTypeOptions.map((type) => (
                    <SelectItem key={type} value={type}>
                      {getActivityTypeLabel(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <PersianDateField control={form.control} name="activityDate" label="تاریخ" />
            <div className="space-y-2">
              <Label>مکان (اختیاری)</Label>
              <Input {...form.register("location")} placeholder="شهر یا محل برگزاری" />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>رسانه‌ها (حداکثر {MAX_MEDIA_ITEMS})</Label>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => addMediaItem("image")}>
                    + تصویر
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => addMediaItem("video")}>
                    + ویدیو
                  </Button>
                </div>
              </div>
              {mediaItems.map((item) => (
                <div key={item.id} className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {item.type === "image" ? "تصویر" : "ویدیو"}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setMediaItems((prev) => prev.filter((media) => media.id !== item.id))}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <MediaUpload
                    value={item.url}
                    onChange={(url) =>
                      setMediaItems((prev) =>
                        prev.map((media) => (media.id === item.id ? { ...media, url } : media))
                      )
                    }
                    label={item.type === "image" ? "تصویر" : "ویدیو"}
                    kind={item.type === "image" ? "image" : "video"}
                    uploadKind={item.type === "image" ? "image" : "activity-video"}
                    fileOnly={item.type === "video"}
                    maxFileSizeBytes={item.type === "video" ? ACTIVITY_VIDEO_MAX_BYTES : undefined}
                    accept={item.type === "image" ? "image/*" : "video/mp4,video/webm,video/quicktime"}
                  />
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Label>توضیحات (اختیاری)</Label>
              <Textarea {...form.register("description")} rows={4} placeholder="جزئیات اقدام، تعداد مخاطب، نتایج و ..." />
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
                    await deleteCampaignActivityAction(editingId);
                    setRows((prev) => prev.filter((row) => row.id !== editingId));
                    toast.success("حذف شد");
                    setOpen(false);
                  });
                }}
              >
                حذف اقدام
              </Button>
            )}
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
