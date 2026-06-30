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
import { adminOwnerTableColumn } from "@/components/admin/admin-owner-badge";
import { MediaUpload } from "@/components/ui/media-upload";
import { PersianDateField } from "@/components/ui/persian-date-input";
import { activityTypeOptions, getActivityTypeLabel } from "@/lib/activity-types";
import { deleteCampaignActivityAction, saveCampaignActivityAction } from "@/lib/actions/extended-actions";
import { todayISO } from "@/lib/jalali";
import type { ActivityType, CampaignActivity } from "@/lib/types";
import { formatPersianDate } from "@/lib/utils";

const ACTIVITY_VIDEO_MAX_BYTES = 50 * 1024 * 1024;

const schema = z.object({
  title: z.string().min(1, "عنوان الزامی است"),
  activityType: z.enum([
    "magazine",
    "newspaper",
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

interface ActivitiesAdminProps {
  campaignId: string;
  initialActivities: CampaignActivity[];
}

export function ActivitiesAdmin({ campaignId, initialActivities }: ActivitiesAdminProps) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rows, setRows] = useState(initialActivities);
  const [isPending, startTransition] = useTransition();

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      activityType: "field" as ActivityType,
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
    form.reset({
      title: activity.title,
      activityType: activity.activityType,
      activityDate: activity.activityDate,
      location: activity.location,
      imageUrl: activity.imageUrl ?? "",
      videoUrl: activity.videoUrl ?? "",
      description: activity.description ?? "",
      published: activity.published,
    });
    setOpen(true);
  };

  const onSubmit = form.handleSubmit((data) => {
    startTransition(async () => {
      const result = await saveCampaignActivityAction({
        campaignId,
        id: editingId ?? undefined,
        title: data.title,
        activityType: data.activityType,
        activityDate: data.activityDate,
        location: data.location?.trim() ?? "",
        imageUrl: data.imageUrl || null,
        videoUrl: data.videoUrl || null,
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
        imageUrl: data.imageUrl || null,
        videoUrl: data.videoUrl || null,
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
            ثبت فعالیت‌های میدانی: آگهی مجله و روزنامه، تراکت، غرفه، شعرخوانی، نقاشی و ...
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          اقدام جدید
        </Button>
      </div>

      <AdminDataTable
        data={rows}
        searchKeys={["title", "location", "description", "activityType"]}
        columns={[
          { key: "title", label: "عنوان" },
          adminOwnerTableColumn<CampaignActivity>(),
          {
            key: "activityType",
            label: "نوع",
            render: (item) => getActivityTypeLabel(item.activityType),
          },
          { key: "activityDate", label: "تاریخ", render: (item) => formatPersianDate(item.activityDate) },
          { key: "location", label: "مکان", render: (item) => item.location || "—" },
          {
            key: "published",
            label: "وضعیت",
            render: (item) => (item.published ? "منتشر شده" : "پیش‌نویس"),
          },
        ]}
        onEdit={openEdit}
        onDelete={(activity) => {
          startTransition(async () => {
            await deleteCampaignActivityAction(activity.id);
            setRows((prev) => prev.filter((row) => row.id !== activity.id));
            toast.success("حذف شد");
          });
        }}
      />

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
                onValueChange={(value) => form.setValue("activityType", value as ActivityType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {activityTypeOptions.map((type) => (
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
            <div className="space-y-2">
              <MediaUpload
                value={form.watch("imageUrl") ?? ""}
                onChange={(url) => form.setValue("imageUrl", url)}
                label="تصویر (اختیاری)"
                accept="image/*"
              />
            </div>
            <div className="space-y-2">
              <MediaUpload
                value={form.watch("videoUrl") ?? ""}
                onChange={(url) => form.setValue("videoUrl", url)}
                label="ویدیو (اختیاری — حداکثر ۵۰ مگابایت)"
                kind="video"
                uploadKind="activity-video"
                fileOnly
                maxFileSizeBytes={ACTIVITY_VIDEO_MAX_BYTES}
                accept="video/mp4,video/webm,video/quicktime"
              />
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
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
