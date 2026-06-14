"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import Link from "next/link";
import { Loader2, RefreshCw } from "lucide-react";
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
import { fetchExternalCampaignsAction } from "@/lib/actions/billboard-import-actions";
import type { AnalyticsConfig, CampaignFeatures, CampaignSettings } from "@/lib/types";
import type { ExternalCampaign } from "@/lib/models/billboard-api";

const featuresSchema = z.object({
  billboards: z.boolean(),
  posters: z.boolean(),
  videos: z.boolean(),
  analytics: z.boolean(),
  socialAnalytics: z.boolean(),
  submissions: z.boolean(),
});

const metabaseSchema = z.object({
  url: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  questionId: z.coerce.number().optional(),
});

const channelSchema = z.object({
  source: z.enum(["manual", "metabase", "hybrid"]),
  metabase: metabaseSchema,
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
  externalCampaignId: z.string().optional(),
  siteAnalytics: channelSchema,
  socialAnalyticsConfig: channelSchema,
});

interface SettingsAdminProps {
  initialSettings: CampaignSettings;
}

const featureLabels: { key: keyof CampaignFeatures; label: string }[] = [
  { key: "billboards", label: "بیلبورد" },
  { key: "posters", label: "پوستر" },
  { key: "videos", label: "ویدیو" },
  { key: "analytics", label: "آمار سایت" },
  { key: "socialAnalytics", label: "آمار شبکه‌های اجتماعی" },
  { key: "submissions", label: "مشارکت کاربران" },
];

function buildAnalyticsConfig(data: z.infer<typeof schema>): AnalyticsConfig {
  const buildChannel = (channel: z.infer<typeof channelSchema>) =>
    channel.source === "manual"
      ? { source: "manual" as const, metabase: null }
      : {
          source: channel.source,
          metabase: {
            url: channel.metabase.url ?? "",
            username: channel.metabase.username ?? "",
            password: channel.metabase.password ?? "",
            questionId: Number(channel.metabase.questionId ?? 0),
          },
        };

  return {
    site: buildChannel(data.siteAnalytics),
    social: buildChannel(data.socialAnalyticsConfig),
  };
}

function ChannelAnalyticsSettings({
  title,
  description,
  sourceName,
  metabasePrefix,
  form,
}: {
  title: string;
  description: string;
  sourceName: "siteAnalytics" | "socialAnalyticsConfig";
  metabasePrefix: "siteAnalytics" | "socialAnalyticsConfig";
  form: ReturnType<typeof useForm<z.infer<typeof schema>>>;
}) {
  const source = form.watch(`${sourceName}.source`);

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div>
        <Label className="text-sm font-semibold">{title}</Label>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </div>
      <div>
        <Label>منبع داده</Label>
        <Select
          value={source}
          onValueChange={(value) =>
            form.setValue(`${sourceName}.source`, value as "manual" | "metabase" | "hybrid")
          }
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="manual">فقط دستی (پنل آمار)</SelectItem>
            <SelectItem value="hybrid">دستی + Metabase (زنده)</SelectItem>
            <SelectItem value="metabase">فقط Metabase</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {(source === "metabase" || source === "hybrid") && (
        <div className="space-y-3">
          <div><Label>آدرس Metabase</Label><Input {...form.register(`${metabasePrefix}.metabase.url`)} dir="ltr" placeholder="https://metabase.example.com" /></div>
          <div><Label>نام کاربری</Label><Input {...form.register(`${metabasePrefix}.metabase.username`)} dir="ltr" autoComplete="off" /></div>
          <div><Label>رمز عبور</Label><Input {...form.register(`${metabasePrefix}.metabase.password`)} type="password" dir="ltr" autoComplete="new-password" /></div>
          <div><Label>Question ID</Label><Input type="number" {...form.register(`${metabasePrefix}.metabase.questionId`)} dir="ltr" placeholder="123" /></div>
        </div>
      )}
    </div>
  );
}

export function SettingsAdmin({ initialSettings }: SettingsAdminProps) {
  const [isPending, startTransition] = useTransition();
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [externalCampaigns, setExternalCampaigns] = useState<ExternalCampaign[]>([]);

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
      externalCampaignId: initialSettings.billboardConfig?.externalCampaignId ?? "",
      siteAnalytics: {
        source: initialSettings.analyticsConfig.site.source,
        metabase: {
          url: initialSettings.analyticsConfig.site.metabase?.url ?? "",
          username: initialSettings.analyticsConfig.site.metabase?.username ?? "",
          password: initialSettings.analyticsConfig.site.metabase?.password ?? "",
          questionId: initialSettings.analyticsConfig.site.metabase?.questionId ?? undefined,
        },
      },
      socialAnalyticsConfig: {
        source: initialSettings.analyticsConfig.social.source,
        metabase: {
          url: initialSettings.analyticsConfig.social.metabase?.url ?? "",
          username: initialSettings.analyticsConfig.social.metabase?.username ?? "",
          password: initialSettings.analyticsConfig.social.metabase?.password ?? "",
          questionId: initialSettings.analyticsConfig.social.metabase?.questionId ?? undefined,
        },
      },
    },
  });

  const loadExternalCampaigns = useCallback(async () => {
    setLoadingCampaigns(true);
    const result = await fetchExternalCampaignsAction();
    setLoadingCampaigns(false);
    if (result.success && result.campaigns) {
      setExternalCampaigns(result.campaigns);
    }
  }, []);

  useEffect(() => {
    void loadExternalCampaigns();
  }, [loadExternalCampaigns]);

  const onSubmit = form.handleSubmit((data) => {
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
        analyticsConfig: buildAnalyticsConfig(data),
        billboardConfig: {
          externalCampaignId: data.externalCampaignId || null,
        },
      });
      toast.success("تنظیمات ذخیره شد");
    });
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">تنظیمات کمپین</h1>
        <p className="text-sm text-muted-foreground">اطلاعات، بیلبورد زنده، آمار سایت و شبکه‌های اجتماعی</p>
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

            <div className="space-y-3 border rounded-lg p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label className="text-sm font-semibold">بیلبورد زنده (Map Bilboard)</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    بیلبوردها مستقیماً از API خوانده می‌شوند — نیازی به import نیست.
                  </p>
                </div>
                <Button type="button" variant="outline" size="icon" onClick={() => void loadExternalCampaigns()} disabled={loadingCampaigns}>
                  {loadingCampaigns ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </Button>
              </div>
              <Select
                value={form.watch("externalCampaignId") || "none"}
                onValueChange={(value) => form.setValue("externalCampaignId", value === "none" ? "" : value)}
              >
                <SelectTrigger><SelectValue placeholder="انتخاب کمپین خارجی" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون اتصال — فقط بیلبوردهای دستی</SelectItem>
                  {externalCampaigns.map((campaign) => (
                    <SelectItem key={campaign.id} value={campaign.id}>{campaign.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <ChannelAnalyticsSettings
              title="تنظیمات آمار سایت"
              description="Metabase یا داده دستی برای بازدید سایت"
              sourceName="siteAnalytics"
              metabasePrefix="siteAnalytics"
              form={form}
            />

            <ChannelAnalyticsSettings
              title="تنظیمات آمار شبکه‌های اجتماعی"
              description="Metabase یا داده دستی برای اینستاگرام، تلگرام و سایر پلتفرم‌ها"
              sourceName="socialAnalyticsConfig"
              metabasePrefix="socialAnalyticsConfig"
              form={form}
            />

            <p className="text-xs text-muted-foreground">
              ستون‌های پیشنهادی Metabase: date, visitors, unique_visitors, page_views, avg_session_duration, source, device, page, city
            </p>

            <Button type="submit" disabled={isPending}>{isPending ? "در حال ذخیره..." : "ذخیره تغییرات"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
