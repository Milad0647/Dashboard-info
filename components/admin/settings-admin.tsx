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
import type { AnalyticsConfig, CampaignFeatures, CampaignSettings } from "@/lib/types";

const featuresSchema = z.object({
  billboards: z.boolean(),
  posters: z.boolean(),
  videos: z.boolean(),
  analytics: z.boolean(),
  submissions: z.boolean(),
});

const metabaseSchema = z.object({
  url: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  questionId: z.coerce.number().optional(),
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
  analyticsSource: z.enum(["manual", "metabase"]),
  metabase: metabaseSchema,
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
      analyticsSource: initialSettings.analyticsConfig?.source ?? "manual",
      metabase: {
        url: initialSettings.analyticsConfig?.metabase?.url ?? "",
        username: initialSettings.analyticsConfig?.metabase?.username ?? "",
        password: initialSettings.analyticsConfig?.metabase?.password ?? "",
        questionId: initialSettings.analyticsConfig?.metabase?.questionId ?? undefined,
      },
    },
  });

  const analyticsSource = form.watch("analyticsSource");

  const onSubmit = form.handleSubmit((data) => {
    const analyticsConfig: AnalyticsConfig =
      data.analyticsSource === "metabase"
        ? {
            source: "metabase",
            metabase: {
              url: data.metabase.url ?? "",
              username: data.metabase.username ?? "",
              password: data.metabase.password ?? "",
              questionId: Number(data.metabase.questionId ?? 0),
            },
          }
        : { source: "manual" };

    startTransition(async () => {
      await updateSettingsAction({
        id: initialSettings.id,
        title: data.title,
        slug: data.slug,
        description: data.description,
        status: data.status,
        startDate: data.startDate,
        endDate: data.endDate,
        coverImageUrl: data.coverImageUrl,
        published: data.published,
        features: data.features,
        analyticsConfig,
      });
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
            <MediaUpload label="تصویر کاور" value={form.watch("coverImageUrl") ?? ""} onChange={(url) => form.setValue("coverImageUrl", url)} />
            <div className="flex items-center gap-2">
              <Switch checked={form.watch("published")} onCheckedChange={(v) => form.setValue("published", v)} />
              <Label>منتشر در صفحه عمومی</Label>
            </div>
            <div className="space-y-3 border rounded-lg p-4">
              <Label className="text-sm font-semibold">بخش‌های فعال</Label>
              {featureLabels.map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <Label className="font-normal">{label}</Label>
                  <Switch checked={form.watch(`features.${key}`)} onCheckedChange={(v) => form.setValue(`features.${key}`, v)} />
                </div>
              ))}
            </div>

            <div className="space-y-4 border rounded-lg p-4">
              <Label className="text-sm font-semibold">آمار سایت (Metabase)</Label>
              <div>
                <Label>منبع داده</Label>
                <Select value={analyticsSource} onValueChange={(v) => form.setValue("analyticsSource", v as "manual" | "metabase")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">دستی (از پنل آمار)</SelectItem>
                    <SelectItem value="metabase">Metabase</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {analyticsSource === "metabase" && (
                <div className="space-y-3">
                  <div><Label>آدرس Metabase</Label><Input {...form.register("metabase.url")} dir="ltr" placeholder="https://metabase.example.com" /></div>
                  <div><Label>نام کاربری</Label><Input {...form.register("metabase.username")} dir="ltr" autoComplete="off" /></div>
                  <div><Label>رمز عبور</Label><Input {...form.register("metabase.password")} type="password" dir="ltr" autoComplete="new-password" /></div>
                  <div><Label>Question ID</Label><Input type="number" {...form.register("metabase.questionId")} dir="ltr" placeholder="123" /></div>
                  <p className="text-xs text-muted-foreground">
                    ستون‌های پیشنهادی در Question: date, visitors, unique_visitors, page_views, avg_session_duration, source, device, page, city
                  </p>
                </div>
              )}
            </div>

            <Button type="submit" disabled={isPending}>{isPending ? "در حال ذخیره..." : "ذخیره تغییرات"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
