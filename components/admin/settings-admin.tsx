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
import { saveCampaignPagePasswordAction } from "@/lib/actions/extended-actions";
import { fetchExternalCampaignsAction } from "@/lib/actions/billboard-import-actions";
import { SmsSettingsCard } from "@/components/admin/sms-settings-card";
import { CampaignPageAccessCodesAdmin } from "@/components/admin/campaign-page-access-codes-admin";
import { ScoringRulesAdmin } from "@/components/admin/scoring-rules-admin";
import {
  contentPlansFromTopics,
  normalizeContentTopics,
  type ContentTopic,
} from "@/lib/content-topics";
import { DEFAULT_ADMIN_OWNER_LABEL } from "@/lib/owner-groups";
import {
  CONTENT_TITLE_MAX_LENGTH,
  CONTENT_TITLE_MAX_LENGTH_MESSAGE,
} from "@/lib/content-constraints";
import type { AnalyticsConfig, CampaignFeatures, CampaignSettings, ChannelAnalyticsConfig } from "@/lib/types";
import type { ExternalCampaign } from "@/lib/models/billboard-api";

const featuresSchema = z.object({
  billboards: z.boolean(),
  posters: z.boolean(),
  videos: z.boolean(),
  analytics: z.boolean(),
  socialAnalytics: z.boolean(),
  socialPosts: z.boolean(),
  sitePublications: z.boolean(),
  broadcastReports: z.boolean(),
  meetings: z.boolean(),
  activities: z.boolean(),
  pressPublications: z.boolean(),
  submissions: z.boolean(),
  files: z.boolean(),
  rawMedia: z.boolean(),
});

const metabaseSchema = z.object({
  url: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  questionId: z.coerce.number().optional(),
  dashboardId: z.coerce.number().optional(),
  embedSecret: z.string().optional(),
});

const channelSchema = z.object({
  source: z.enum(["manual", "metabase", "hybrid"]),
  metabase: metabaseSchema,
});

const schema = z.object({
  title: z.string().min(1).max(CONTENT_TITLE_MAX_LENGTH, CONTENT_TITLE_MAX_LENGTH_MESSAGE),
  slug: z.string().min(1),
  description: z.string().min(1),
  status: z.enum(["live", "completed", "draft"]),
  startDate: z.string(),
  endDate: z.string(),
  coverImageUrl: z.string().optional(),
  published: z.boolean(),
  features: featuresSchema,
  externalCampaignId: z.string().optional(),
  externalCampaignSlug: z.string().optional(),
  adminOwnerLabel: z.string().optional(),
  siteAnalytics: channelSchema,
  socialAnalyticsConfig: channelSchema,
});

interface SettingsAdminProps {
  initialSettings: CampaignSettings;
  canEditFullSettings?: boolean;
  hasPagePassword?: boolean;
}

const featureLabels: { key: keyof CampaignFeatures; label: string }[] = [
  { key: "billboards", label: "تبلیغات محیطی" },
  { key: "posters", label: "پوستر" },
  { key: "videos", label: "ویدیو" },
  { key: "analytics", label: "آمار سایت" },
  { key: "socialAnalytics", label: "شبکه‌های اجتماعی" },
  { key: "socialPosts", label: "پست‌های شبکه اجتماعی" },
  { key: "sitePublications", label: "انتشار در سایت" },
  { key: "broadcastReports", label: "گزارش پخش صدا و سیما" },
  { key: "meetings", label: "جلسات و مصوبات" },
  { key: "activities", label: "اقدامات" },
  { key: "pressPublications", label: "مجله و روزنامه" },
  { key: "submissions", label: "مشارکت کاربران" },
  { key: "files", label: "فایل‌های کمپین" },
  { key: "rawMedia", label: "راش تصویر" },
];

function buildChannelAnalyticsConfig(
  channel: {
    source: "manual" | "metabase" | "hybrid";
    metabase?: {
      url?: string;
      username?: string;
      password?: string;
      questionId?: number;
      dashboardId?: number;
      embedSecret?: string;
    };
  },
  previous: ChannelAnalyticsConfig
): ChannelAnalyticsConfig {
  const url = channel.metabase?.url?.trim() ?? "";
  const dashboardId = Number(channel.metabase?.dashboardId ?? 0) || undefined;
  const questionId = Number(channel.metabase?.questionId ?? 0) || undefined;
  const username = channel.metabase?.username?.trim() ?? "";
  const password = channel.metabase?.password?.trim()
    ? channel.metabase.password
    : previous.metabase?.password ?? "";
  const embedSecret = channel.metabase?.embedSecret?.trim()
    ? channel.metabase.embedSecret
    : previous.metabase?.embedSecret ?? "";

  const hasDashboardEmbed = Boolean(url && dashboardId && embedSecret);
  const hasMetabaseQuery = Boolean(url && questionId && username && password);

  if (channel.source === "manual" && !hasDashboardEmbed && !hasMetabaseQuery) {
    return { source: "manual", metabase: null };
  }

  const resolvedSource =
    channel.source === "manual" && hasDashboardEmbed ? "metabase" : channel.source;

  return {
    source: resolvedSource,
    metabase: {
      url,
      username,
      password,
      questionId,
      dashboardId,
      embedSecret,
    },
  };
}

function buildAnalyticsConfig(
  data: z.infer<typeof schema>,
  previous: AnalyticsConfig
): AnalyticsConfig {
  return {
    site: buildChannelAnalyticsConfig(data.siteAnalytics, previous.site),
    social: buildChannelAnalyticsConfig(data.socialAnalyticsConfig, previous.social),
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
            <SelectItem value="metabase">فقط Metabase (داشبورد embed)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {(source === "metabase" || source === "hybrid") && (
        <div className="space-y-3">
          <div><Label>آدرس Metabase</Label><Input {...form.register(`${metabasePrefix}.metabase.url`)} dir="ltr" placeholder="https://oneclick-metabase-fh09o5az.darkube.ir" /></div>
          <div><Label>نام کاربری</Label><Input {...form.register(`${metabasePrefix}.metabase.username`)} dir="ltr" autoComplete="off" /></div>
          <div><Label>رمز عبور</Label><Input {...form.register(`${metabasePrefix}.metabase.password`)} type="password" dir="ltr" autoComplete="new-password" /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Dashboard ID</Label><Input type="number" {...form.register(`${metabasePrefix}.metabase.dashboardId`)} dir="ltr" placeholder="2" /></div>
            <div><Label>Question ID (اختیاری)</Label><Input type="number" {...form.register(`${metabasePrefix}.metabase.questionId`)} dir="ltr" placeholder="123" /></div>
          </div>
          <div>
            <Label>Embed Secret</Label>
            <Input {...form.register(`${metabasePrefix}.metabase.embedSecret`)} type="password" dir="ltr" autoComplete="new-password" placeholder="کلید embedding از Metabase Admin" />
            <p className="mt-1 text-xs text-muted-foreground">
              برای نمایش داشبورد در سایت، منبع را «فقط Metabase» انتخاب کنید، Dashboard ID و Embed Secret را وارد کنید و embedding داشبورد ۲ را در Metabase فعال کنید.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export function SettingsAdmin({
  initialSettings,
  canEditFullSettings = true,
  hasPagePassword = false,
}: SettingsAdminProps) {
  const [isPending, startTransition] = useTransition();
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [externalCampaigns, setExternalCampaigns] = useState<ExternalCampaign[]>([]);
  const [contentTopics, setContentTopics] = useState<ContentTopic[]>(() =>
    normalizeContentTopics(
      initialSettings.contentTopics?.length
        ? initialSettings.contentTopics
        : (initialSettings.contentPlans ?? []).map((name) => ({ name, subtopics: [] }))
    )
  );
  const [newTopicName, setNewTopicName] = useState("");
  const [newSubtopicByTopic, setNewSubtopicByTopic] = useState<Record<string, string>>({});
  const [pagePassword, setPagePassword] = useState("");
  const [pagePasswordConfigured, setPagePasswordConfigured] = useState(hasPagePassword);

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
      features: {
        ...initialSettings.features,
        rawMedia: initialSettings.features.rawMedia ?? true,
      },
      externalCampaignId: initialSettings.billboardConfig?.externalCampaignId ?? "",
      externalCampaignSlug: initialSettings.billboardConfig?.externalCampaignSlug ?? "",
      adminOwnerLabel: initialSettings.adminOwnerLabel ?? DEFAULT_ADMIN_OWNER_LABEL,
      siteAnalytics: {
        source: initialSettings.analyticsConfig.site.source,
        metabase: {
          url: initialSettings.analyticsConfig.site.metabase?.url ?? "",
          username: initialSettings.analyticsConfig.site.metabase?.username ?? "",
          password: initialSettings.analyticsConfig.site.metabase?.password ?? "",
          questionId: initialSettings.analyticsConfig.site.metabase?.questionId ?? undefined,
          dashboardId: initialSettings.analyticsConfig.site.metabase?.dashboardId ?? undefined,
          embedSecret: initialSettings.analyticsConfig.site.metabase?.embedSecret ?? "",
        },
      },
      socialAnalyticsConfig: {
        source: initialSettings.analyticsConfig.social.source,
        metabase: {
          url: initialSettings.analyticsConfig.social.metabase?.url ?? "",
          username: initialSettings.analyticsConfig.social.metabase?.username ?? "",
          password: initialSettings.analyticsConfig.social.metabase?.password ?? "",
          questionId: initialSettings.analyticsConfig.social.metabase?.questionId ?? undefined,
          dashboardId: initialSettings.analyticsConfig.social.metabase?.dashboardId ?? undefined,
          embedSecret: initialSettings.analyticsConfig.social.metabase?.embedSecret ?? "",
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

  useEffect(() => {
    const currentSlug = form.getValues("externalCampaignSlug");
    const currentId = form.getValues("externalCampaignId");
    if (!currentSlug && currentId && externalCampaigns.length > 0) {
      const match = externalCampaigns.find((item) => item.id === currentId);
      if (match) {
        form.setValue("externalCampaignSlug", match.slug);
      }
    }
  }, [externalCampaigns, form]);

  const onSubmit = form.handleSubmit((data) => {
    if (!canEditFullSettings) return;
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
        analyticsConfig: buildAnalyticsConfig(data, initialSettings.analyticsConfig),
        billboardConfig: {
          externalCampaignId: data.externalCampaignId || null,
          externalCampaignSlug: data.externalCampaignSlug || null,
        },
        adminOwnerLabel: data.adminOwnerLabel?.trim() || DEFAULT_ADMIN_OWNER_LABEL,
        contentTopics,
        contentPlans: contentPlansFromTopics(contentTopics),
      });
      toast.success("تنظیمات ذخیره شد");
    });
  });

  const savePagePassword = (removePassword = false) => {
    startTransition(async () => {
      const result = await saveCampaignPagePasswordAction(initialSettings.id, {
        password: removePassword ? undefined : pagePassword,
        removePassword,
      });
      if (!result.success) {
        toast.error("error" in result && result.error ? result.error : "ذخیره رمز نشد");
        return;
      }
      setPagePassword("");
      setPagePasswordConfigured(!removePassword);
      toast.success(removePassword ? "رمز صفحه کمپین حذف شد" : "رمز صفحه کمپین ذخیره شد");
    });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">تنظیمات کمپین</h1>
        <p className="text-sm text-muted-foreground">
          {canEditFullSettings
            ? "اطلاعات، پیامک، بیلبورد زنده، آمار سایت و شبکه‌های اجتماعی"
            : "رمز دسترسی به صفحه نمایش کمپین"}
        </p>
        {canEditFullSettings && (
          <Link href="/admin/campaigns" className="text-sm text-primary hover:underline inline-block mt-1">
            ساخت یا حذف کمپین ← مدیریت کمپین‌ها
          </Link>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">رمز صفحه نمایش کمپین</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            با تنظیم رمز، بازدیدکنندگان عمومی فقط بعد از وارد کردن رمز می‌توانند صفحه کمپین را ببینند.
            ادمین و کارفرما وقتی وارد پنل هستند بدون رمز صفحه را می‌بینند.
          </p>
          <Input
            type="password"
            value={pagePassword}
            onChange={(event) => setPagePassword(event.target.value)}
            placeholder={pagePasswordConfigured ? "رمز جدید (برای تغییر)" : "رمز صفحه کمپین"}
            dir="ltr"
            className="text-left"
            autoComplete="new-password"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => savePagePassword(false)}
              disabled={isPending || !pagePassword.trim()}
            >
              {pagePasswordConfigured ? "تغییر رمز" : "تنظیم رمز"}
            </Button>
            {pagePasswordConfigured && (
              <Button
                type="button"
                variant="outline"
                onClick={() => savePagePassword(true)}
                disabled={isPending}
              >
                حذف رمز
              </Button>
            )}
          </div>
          {pagePasswordConfigured && (
            <p className="text-xs text-muted-foreground">رمز فعلی تنظیم شده است.</p>
          )}
        </CardContent>
      </Card>

      <CampaignPageAccessCodesAdmin campaignId={initialSettings.id} />

      <ScoringRulesAdmin initialSettings={initialSettings} />

      {canEditFullSettings && <SmsSettingsCard />}

      {canEditFullSettings && (
      <Card>
        <CardHeader><CardTitle className="text-base">اطلاعات کمپین</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label>عنوان</Label>
              <Input {...form.register("title")} maxLength={CONTENT_TITLE_MAX_LENGTH} />
            </div>
            <div><Label>اسلاگ (URL)</Label><Input {...form.register("slug")} dir="ltr" /></div>
            <div><Label>توضیحات</Label><Textarea {...form.register("description")} rows={4} /></div>
            <div>
              <Label>برچسب محتوای مدیریت</Label>
              <Input {...form.register("adminOwnerLabel")} placeholder={DEFAULT_ADMIN_OWNER_LABEL} />
              <p className="mt-1 text-xs text-muted-foreground">
                نام گروه محتوایی که توسط ادمین (بدون کاربر) ثبت شده — در صفحه عمومی کمپین نمایش داده می‌شود.
              </p>
            </div>

            <div className="space-y-3 rounded-lg border p-4">
              <div>
                <Label>موضوع‌های کمپین</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  موضوع و زیرموضوع تعریف کنید (مثلاً مهتاب ← هفته اول) تا هنگام آپلود محتوا و فیلتر صفحه اصلی استفاده شوند.
                </p>
              </div>
              <div className="flex gap-2">
                <Input
                  value={newTopicName}
                  onChange={(event) => setNewTopicName(event.target.value)}
                  placeholder="نام موضوع جدید"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const value = newTopicName.trim();
                    if (!value || contentTopics.some((topic) => topic.name === value)) return;
                    setContentTopics((current) => [...current, { name: value, subtopics: [] }]);
                    setNewTopicName("");
                  }}
                >
                  افزودن موضوع
                </Button>
              </div>
              {contentTopics.length > 0 && (
                <div className="space-y-3">
                  {contentTopics.map((topic) => (
                    <div key={topic.name} className="space-y-2 rounded-md border bg-muted/30 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">{topic.name}</p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-destructive"
                          onClick={() =>
                            setContentTopics((current) =>
                              current.filter((item) => item.name !== topic.name)
                            )
                          }
                        >
                          حذف موضوع
                        </Button>
                      </div>
                      {topic.subtopics.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {topic.subtopics.map((sub) => (
                            <Button
                              key={sub}
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                setContentTopics((current) =>
                                  current.map((item) =>
                                    item.name === topic.name
                                      ? {
                                          ...item,
                                          subtopics: item.subtopics.filter((s) => s !== sub),
                                        }
                                      : item
                                  )
                                )
                              }
                            >
                              {sub} ×
                            </Button>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Input
                          value={newSubtopicByTopic[topic.name] ?? ""}
                          onChange={(event) =>
                            setNewSubtopicByTopic((current) => ({
                              ...current,
                              [topic.name]: event.target.value,
                            }))
                          }
                          placeholder="زیرموضوع جدید"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const value = (newSubtopicByTopic[topic.name] ?? "").trim();
                            if (!value || topic.subtopics.includes(value)) return;
                            setContentTopics((current) =>
                              current.map((item) =>
                                item.name === topic.name
                                  ? { ...item, subtopics: [...item.subtopics, value] }
                                  : item
                              )
                            );
                            setNewSubtopicByTopic((current) => ({ ...current, [topic.name]: "" }));
                          }}
                        >
                          افزودن
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

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
                    بیلبوردها از API integration خوانده می‌شوند — کمپین خارجی را انتخاب کنید.
                  </p>
                </div>
                <Button type="button" variant="outline" size="icon" onClick={() => void loadExternalCampaigns()} disabled={loadingCampaigns}>
                  {loadingCampaigns ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </Button>
              </div>
              <Select
                value={form.watch("externalCampaignSlug") || "none"}
                onValueChange={(value) => {
                  if (value === "none") {
                    form.setValue("externalCampaignSlug", "");
                    form.setValue("externalCampaignId", "");
                    return;
                  }

                  const campaign = externalCampaigns.find((item) => item.slug === value);
                  form.setValue("externalCampaignSlug", value);
                  form.setValue("externalCampaignId", campaign?.id ?? "");
                }}
              >
                <SelectTrigger><SelectValue placeholder="انتخاب کمپین خارجی" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون اتصال — فقط بیلبوردهای دستی</SelectItem>
                  {externalCampaigns.map((campaign) => (
                    <SelectItem key={campaign.id} value={campaign.slug}>
                      {campaign.name}
                      {campaign.date_range_shamsi ? ` — ${campaign.date_range_shamsi}` : ""}
                    </SelectItem>
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
      )}
    </div>
  );
}
