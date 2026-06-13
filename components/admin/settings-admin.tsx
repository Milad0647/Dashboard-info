"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MediaUpload } from "@/components/ui/media-upload";
import { PersianDateField } from "@/components/ui/persian-date-input";
import { updateSettingsAction } from "@/lib/actions/admin-actions";
import type { CampaignFeatures, CampaignSettings } from "@/lib/types";

const featuresSchema = z.object({
  billboards: z.boolean(),
  posters: z.boolean(),
  videos: z.boolean(),
  analytics: z.boolean(),
  submissions: z.boolean(),
});

const schema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().min(1),
  status: z.enum(["live", "completed", "draft"]),
  startDate: z.string(),
  endDate: z.string(),
  coverImageUrl: z.string().optional(),
  published: z.boolean(),
  features: featuresSchema,
});

interface SettingsAdminProps {
  initialSettings: CampaignSettings;
}

const featureLabels: { key: keyof CampaignFeatures; label: string }[] = [
  { key: "billboards", label: "بیلبورد" },
  { key: "posters", label: "پوستر" },
  { key: "videos", label: "ویدیو" },
  { key: "analytics", label: "آمار سایت" },
  { key: "submissions", label: "مشارکت کاربران" },
];

export function SettingsAdmin({ initialSettings }: SettingsAdminProps) {
  const [isPending, startTransition] = useTransition();

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      title: initialSettings.title,
      slug: initialSettings.slug,
      description: initialSettings.description,
      status: initialSettings.status,
      startDate: initialSettings.startDate,
      endDate: initialSettings.endDate,
      coverImageUrl: initialSettings.coverImageUrl ?? "",
      published: initialSettings.published,
      features: initialSettings.features,
    },
  });

  const onSubmit = form.handleSubmit((data) => {
    startTransition(async () => {
      await updateSettingsAction({ ...data, id: initialSettings.id });
      toast.success("تنظیمات ذخیره شد");
    });
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">تنظیمات کمپین</h1>
        <p className="text-sm text-muted-foreground">اطلاعات و بخش‌های فعال این کمپین</p>
        <Link href="/admin/campaigns" className="text-sm text-primary hover:underline inline-block mt-1">
          ساخت یا حذف کمپین ← مدیریت کمپین‌ها
        </Link>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">اطلاعات کمپین</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div><Label>عنوان</Label><Input {...form.register("title")} /></div>
            <div><Label>اسلاگ (URL)</Label><Input {...form.register("slug")} dir="ltr" /></div>
            <div><Label>توضیحات</Label><Textarea {...form.register("description")} rows={4} /></div>
            <div><Label>وضعیت</Label>
              <Select value={form.watch("status")} onValueChange={(v) => form.setValue("status", v as "live" | "completed" | "draft")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="live">زنده</SelectItem>
                  <SelectItem value="completed">پایان‌یافته</SelectItem>
                  <SelectItem value="draft">پیش‌نویس</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <PersianDateField control={form.control} name="startDate" label="تاریخ شروع (شمسی)" />
              <PersianDateField control={form.control} name="endDate" label="تاریخ پایان (شمسی)" />
            </div>
            <MediaUpload
              label="تصویر کاور"
              value={form.watch("coverImageUrl") ?? ""}
              onChange={(url) => form.setValue("coverImageUrl", url)}
            />
            <div className="flex items-center gap-2">
              <Switch checked={form.watch("published")} onCheckedChange={(v) => form.setValue("published", v)} />
              <Label>منتشر در صفحه عمومی</Label>
            </div>
            <div className="space-y-3 border rounded-lg p-4">
              <Label className="text-sm font-semibold">بخش‌های فعال</Label>
              {featureLabels.map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <Label className="font-normal">{label}</Label>
                  <Switch
                    checked={form.watch(`features.${key}`)}
                    onCheckedChange={(v) => form.setValue(`features.${key}`, v)}
                  />
                </div>
              ))}
            </div>
            <Button type="submit" disabled={isPending}>{isPending ? "در حال ذخیره..." : "ذخیره تغییرات"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
