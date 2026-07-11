"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import Link from "next/link";
import { ExternalLink, FolderKanban, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { Badge } from "@/components/ui/badge";
import { MediaUpload } from "@/components/ui/media-upload";
import { PersianDateField } from "@/components/ui/persian-date-input";
import { saveCampaignAction, deleteCampaignAction } from "@/lib/actions/admin-actions";
import type { CampaignFeatures, CampaignSettings } from "@/lib/types";
import { todayISO } from "@/lib/jalali";
import { formatPersianDate, slugify } from "@/lib/utils";

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

const schema = z.object({
  title: z.string().min(1, "عنوان الزامی است"),
  slug: z.string().min(1, "اسلاگ الزامی است"),
  description: z.string().min(1),
  status: z.enum(["live", "completed", "draft"]),
  startDate: z.string(),
  endDate: z.string(),
  coverImageUrl: z.string().optional(),
  published: z.boolean(),
  features: featuresSchema,
});

type FormData = z.infer<typeof schema>;

const defaultFeatures: CampaignFeatures = {
  billboards: true,
  posters: true,
  videos: false,
  analytics: false,
  socialAnalytics: false,
  socialPosts: false,
  sitePublications: false,
  broadcastReports: false,
  meetings: false,
  activities: false,
  pressPublications: false,
  submissions: false,
  files: false,
  rawMedia: true,
};

interface CampaignsAdminProps {
  initialCampaigns: CampaignSettings[];
}

export function CampaignsAdmin({ initialCampaigns }: CampaignsAdminProps) {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CampaignSettings | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      slug: "",
      description: "",
      status: "draft",
      startDate: todayISO(),
      endDate: todayISO(),
      coverImageUrl: "",
      published: false,
      features: defaultFeatures,
    },
  });

  const openCreate = () => {
    setEditing(null);
    form.reset({
      title: "",
      slug: "",
      description: "",
      status: "draft",
      startDate: todayISO(),
      endDate: todayISO(),
      coverImageUrl: "",
      published: false,
      features: defaultFeatures,
    });
    setOpen(true);
  };

  const openEdit = (campaign: CampaignSettings) => {
    setEditing(campaign);
    form.reset({
      title: campaign.title,
      slug: campaign.slug,
      description: campaign.description,
      status: campaign.status,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      coverImageUrl: campaign.coverImageUrl ?? "",
      published: campaign.published,
      features: campaign.features,
    });
    setOpen(true);
  };

  const onSubmit = form.handleSubmit((data) => {
    startTransition(async () => {
      await saveCampaignAction({ ...data, id: editing?.id });
      if (editing) {
        setCampaigns((prev) =>
          prev.map((c) =>
            c.id === editing.id
              ? ({ ...c, ...data, updatedAt: new Date().toISOString() } as CampaignSettings)
              : c
          )
        );
        toast.success("کمپین ویرایش شد");
      } else {
        setCampaigns((prev) => [
          ...prev,
          { id: crypto.randomUUID(), updatedAt: new Date().toISOString(), ...data } as CampaignSettings,
        ]);
        toast.success("کمپین ایجاد شد");
      }
      setOpen(false);
      router.refresh();
    });
  });

  const featureLabels: { key: keyof CampaignFeatures; label: string }[] = [
    { key: "billboards", label: "تبلیغات محیطی" },
    { key: "posters", label: "پوستر" },
    { key: "videos", label: "ویدیو" },
    { key: "analytics", label: "آمار سایت" },
    { key: "socialAnalytics", label: "آمار شبکه‌های اجتماعی" },
    { key: "activities", label: "اقدامات" },
    { key: "pressPublications", label: "مجله و روزنامه" },
    { key: "meetings", label: "جلسات و مصوبات" },
    { key: "submissions", label: "مشارکت کاربران" },
    { key: "files", label: "فایل‌های کمپین" },
    { key: "rawMedia", label: "راش تصویر" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FolderKanban className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">مدیریت کمپین‌ها</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            کمپین جدید بسازید، ویرایش کنید یا حذف کنید — سپس از منوی کناری بخش‌های هر کمپین را پر کنید
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          افزودن کمپین جدید
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <div className="text-center py-16 border rounded-xl bg-muted/20 space-y-4">
          <FolderKanban className="h-12 w-12 mx-auto text-muted-foreground" />
          <div>
            <p className="font-medium">هنوز کمپینی تعریف نشده</p>
            <p className="text-sm text-muted-foreground mt-1">
              برای شروع، اولین کمپین خود را بسازید
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            ساخت اولین کمپین
          </Button>
        </div>
      ) : (
        <AdminDataTable
          data={campaigns}
          searchKeys={["title", "slug"]}
          columns={[
            { key: "title", label: "عنوان" },
            { key: "slug", label: "اسلاگ" },
            {
              key: "period",
              label: "بازه زمانی",
              render: (c) => (
                <span className="text-xs whitespace-nowrap">
                  {formatPersianDate(c.startDate)} — {formatPersianDate(c.endDate)}
                </span>
              ),
            },
            {
              key: "status",
              label: "وضعیت",
              render: (c) => (
                <Badge status={c.status}>
                  {c.status === "live" ? "زنده" : c.status === "completed" ? "پایان‌یافته" : "پیش‌نویس"}
                </Badge>
              ),
            },
            {
              key: "published",
              label: "انتشار",
              render: (c) => (
                <Badge variant={c.published ? "success" : "secondary"}>
                  {c.published ? "منتشر" : "پیش‌نویس"}
                </Badge>
              ),
            },
            {
              key: "publicPage",
              label: "صفحه عمومی",
              render: (c) => (
                <Link
                  href={`/campaign/${c.slug}`}
                  target="_blank"
                  className="text-primary text-xs flex items-center gap-1 hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  مشاهده
                </Link>
              ),
            },
          ]}
          onEdit={openEdit}
          onDelete={(c) => {
            startTransition(async () => {
              const result = await deleteCampaignAction(c.id);
              if (!result.success) {
                toast.error(result.error ?? "حذف کمپین ناموفق بود");
                return;
              }
              setCampaigns((prev) => prev.filter((x) => x.id !== c.id));
              toast.success("کمپین حذف شد");
              router.refresh();
            });
          }}
        />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "ویرایش کمپین" : "افزودن کمپین جدید"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label>عنوان</Label>
              <Input
                {...form.register("title")}
                onBlur={() => {
                  if (!editing && !form.getValues("slug")) {
                    form.setValue("slug", slugify(form.getValues("title")));
                  }
                }}
              />
            </div>
            <div>
              <Label>اسلاگ (URL)</Label>
              <Input {...form.register("slug")} dir="ltr" placeholder="summer-1404" />
            </div>
            <div>
              <Label>توضیحات</Label>
              <Textarea {...form.register("description")} rows={3} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <PersianDateField control={form.control} name="startDate" label="تاریخ شروع (شمسی)" />
              <PersianDateField control={form.control} name="endDate" label="تاریخ پایان (شمسی)" />
            </div>
            <div>
              <Label>وضعیت</Label>
              <Select
                value={form.watch("status")}
                onValueChange={(v) => form.setValue("status", v as FormData["status"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="live">زنده</SelectItem>
                  <SelectItem value="completed">پایان‌یافته</SelectItem>
                  <SelectItem value="draft">پیش‌نویس</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <MediaUpload
              label="تصویر کاور"
              value={form.watch("coverImageUrl") ?? ""}
              onChange={(url) => form.setValue("coverImageUrl", url)}
            />
            <div className="flex items-center gap-2">
              <Switch
                checked={form.watch("published")}
                onCheckedChange={(v) => form.setValue("published", v)}
              />
              <Label>منتشر در صفحه عمومی</Label>
            </div>
            <div className="space-y-3 border rounded-lg p-4">
              <Label className="text-sm font-semibold">بخش‌های فعال کمپین</Label>
              <p className="text-xs text-muted-foreground">
                فقط بخش‌هایی که فعال و دارای داده باشند در صفحه عمومی نمایش داده می‌شوند
              </p>
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
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "در حال ذخیره..." : editing ? "ذخیره تغییرات" : "ایجاد کمپین"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
