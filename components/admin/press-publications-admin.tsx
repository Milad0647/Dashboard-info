"use client";

import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  CONTENT_TITLE_MAX_LENGTH,
  CONTENT_TITLE_MAX_LENGTH_MESSAGE,
} from "@/lib/content-constraints";
import { Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminActivityCompactCard } from "@/components/admin/admin-activity-compact-card";
import { AdminCompactAddCard } from "@/components/admin/admin-compact-add-card";
import { AdminContentPreviewDialog } from "@/components/admin/admin-content-preview-dialog";
import { PlanLabelSelect } from "@/components/admin/plan-label-select";
import {
  BulkItemShell,
  SectionBulkEditBar,
  useSectionBulkEdit,
} from "@/components/admin/section-bulk-edit";
import { MediaUpload } from "@/components/ui/media-upload";
import { PersianDateField } from "@/components/ui/persian-date-input";
import { applyVideoCoverToMediaItems } from "@/lib/client/activity-media-cover";
import { getActivityTypeLabel, pressActivityTypeOptions } from "@/lib/activity-types";
import {
  deleteCampaignActivityAction,
  fetchSocialLinkMetricsAction,
  saveCampaignActivityAction,
} from "@/lib/actions/extended-actions";
import { normalizePlanLabels, type ContentTopic } from "@/lib/content-topics";
import { useSectionCreateGate } from "@/lib/hooks/use-section-create-gate";
import { useAdminInfiniteScroll } from "@/lib/hooks/use-admin-infinite-scroll";
import { AdminInfiniteScrollSentinel } from "@/components/admin/admin-infinite-scroll-sentinel";
import { todayISO } from "@/lib/jalali";
import { isPressPublication } from "@/lib/press-publications";
import { cn, formatPersianDate } from "@/lib/utils";
import type { ActivityMediaItem, AdminUser, CampaignActivity } from "@/lib/types";

const ACTIVITY_VIDEO_MAX_BYTES = 50 * 1024 * 1024;
const MAX_MEDIA_ITEMS = 10;

const schema = z.object({
  title: z
    .string()
    .min(1, "عنوان الزامی است")
    .max(CONTENT_TITLE_MAX_LENGTH, CONTENT_TITLE_MAX_LENGTH_MESSAGE),
  activityType: z.enum(["magazine", "newspaper"]),
  activityDate: z.string(),
  location: z.string().optional(),
  link: z
    .string()
    .optional()
    .refine((value) => !value?.trim() || z.string().url().safeParse(value.trim()).success, {
      message: "لینک معتبر وارد کنید",
    }),
  description: z.string().optional(),
});

interface PressPublicationsAdminProps {
  campaignId: string;
  initialActivities: CampaignActivity[];
  contentPlans?: string[];
  contentTopics?: ContentTopic[];
  isFullAdmin?: boolean;
  users?: AdminUser[];
}

export function PressPublicationsAdmin({
  campaignId,
  initialActivities,
  contentPlans = [],
  contentTopics = [],
  isFullAdmin = false,
  users = [],
}: PressPublicationsAdminProps) {
  const { requestCreate, tutorialModal } = useSectionCreateGate("pressPublications");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [mediaItems, setMediaItems] = useState<ActivityMediaItem[]>([]);
  const [planLabels, setPlanLabels] = useState<string[]>([]);
  const [rows, setRows] = useState(
    initialActivities.filter((activity) => isPressPublication(activity))
  );
  const [previewActivity, setPreviewActivity] = useState<CampaignActivity | null>(null);
  const [isPending, startTransition] = useTransition();
  const paginationResetKey = "press";
  const { visibleCount, hasMore, isLoadingMore, loadMore } = useAdminInfiniteScroll(
    rows.length,
    paginationResetKey
  );
  const visibleRows = useMemo(() => rows.slice(0, visibleCount), [rows, visibleCount]);
  const visibleIds = useMemo(() => visibleRows.map((item) => item.id), [visibleRows]);
  const bulk = useSectionBulkEdit(visibleIds);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      activityType: "magazine",
      activityDate: todayISO(),
      location: "",
      link: "",
      description: "",
    },
  });

  const primaryImage = useMemo(
    () => mediaItems.find((item) => item.type === "image")?.url ?? null,
    [mediaItems]
  );
  const primaryVideo = useMemo(
    () => mediaItems.find((item) => item.type === "video")?.url ?? null,
    [mediaItems]
  );

  const openCreate = () => {
    void requestCreate(() => {
      setEditingId(null);
      setMediaItems([]);
      setPlanLabels([]);
      form.reset({
        title: "",
        activityType: "magazine",
        activityDate: todayISO(),
        location: "",
        link: "",
        description: "",
      });
      setOpen(true);
    });
  };

  const openEdit = (activity: CampaignActivity) => {
    setEditingId(activity.id);
    setMediaItems(activity.mediaItems ?? []);
    setPlanLabels(normalizePlanLabels(activity.planLabels, activity.planLabel));
    form.reset({
      title: activity.title,
      activityType: activity.activityType === "newspaper" ? "newspaper" : "magazine",
      activityDate: activity.activityDate,
      location: activity.location,
      link: activity.link ?? "",
      description: activity.description ?? "",
    });
    setOpen(true);
  };

  const handleDelete = (activity: CampaignActivity) => {
    startTransition(async () => {
      await deleteCampaignActivityAction(activity.id);
      setRows((prev) => prev.filter((row) => row.id !== activity.id));
      toast.success("حذف شد");
      setOpen(false);
      setPreviewActivity(null);
    });
  };

  const handleFetchFromLink = () => {
    const link = form.getValues("link")?.trim() ?? "";
    const activityType = form.getValues("activityType");
    if (!link) {
      toast.error("ابتدا لینک را وارد کنید");
      return;
    }

    startTransition(async () => {
      const result = await fetchSocialLinkMetricsAction({
        url: link,
        platform: activityType,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }

      const currentTitle = form.getValues("title")?.trim() ?? "";
      if (!currentTitle && result.title?.trim()) {
        form.setValue("title", result.title.trim());
      }

      const currentDescription = form.getValues("description")?.trim() ?? "";
      if (!currentDescription && result.description?.trim()) {
        form.setValue("description", result.description.trim());
      }

      if (result.coverImageUrl?.trim()) {
        const coverUrl = result.coverImageUrl.trim();
        const hasCoverImage = mediaItems.some(
          (item) => item.type === "image" && item.url.trim()
        );
        if (!hasCoverImage) {
          setMediaItems((prev) => {
            const emptyImage = prev.find((item) => item.type === "image" && !item.url.trim());
            if (emptyImage) {
              return prev.map((item) =>
                item.id === emptyImage.id ? { ...item, url: coverUrl } : item
              );
            }
            if (prev.length >= MAX_MEDIA_ITEMS) return prev;
            return [...prev, { id: crypto.randomUUID(), type: "image" as const, url: coverUrl }];
          });
        }
      }

      if (result.publishedDate) {
        const currentDate = form.getValues("activityDate")?.trim() ?? "";
        if (!currentDate || currentDate === todayISO()) {
          form.setValue("activityDate", result.publishedDate);
        }
      }

      toast.success("اطلاعات صفحه از لینک خوانده شد");
    });
  };

  const addMediaItem = (type: ActivityMediaItem["type"]) => {
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
        link: data.link?.trim() || "",
        imageUrl: filledMedia.find((item) => item.type === "image")?.url ?? null,
        videoUrl: filledMedia.find((item) => item.type === "video")?.url ?? null,
        mediaItems: filledMedia,
        attachments: [],
        description: data.description || null,
        isCreative: false,
        published: true,
        planLabels,
        planLabel: planLabels[0] ?? null,
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
        link: data.link?.trim() || "",
        imageUrl: primaryImage,
        videoUrl: primaryVideo,
        mediaItems: filledMedia,
        attachments: [],
        description: data.description || null,
        isCreative: false,
        published: true,
        planLabels,
        planLabel: planLabels[0] ?? null,
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
      {tutorialModal}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">مجله و روزنامه</h1>
          <p className="text-sm text-muted-foreground">ثبت آگهی‌های مجله و روزنامه با چند رسانه</p>
        </div>
      </div>

      <SectionBulkEditBar
        campaignId={campaignId}
        contentType="press"
        bulkMode={bulk.bulkMode}
        onBulkModeChange={bulk.setBulkMode}
        selectedIds={[...bulk.selectedIds]}
        visibleCount={visibleRows.length}
        allVisibleSelected={bulk.allVisibleSelected}
        onToggleAllVisible={bulk.toggleAllVisible}
        onClearSelection={bulk.clearSelection}
        contentPlans={contentPlans}
        contentTopics={contentTopics}
        isFullAdmin={isFullAdmin}
        users={users}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {!bulk.bulkMode && <AdminCompactAddCard onClick={openCreate} label="ثبت جدید" />}
        {visibleRows.map((activity) => (
          <BulkItemShell
            key={activity.id}
            enabled={bulk.bulkMode}
            selected={bulk.isSelected(activity.id)}
            onToggle={() => bulk.toggle(activity.id)}
          >
            <AdminActivityCompactCard
              activity={activity}
              onClick={() => openEdit(activity)}
              onView={() => setPreviewActivity(activity)}
              onEdit={() => openEdit(activity)}
              onDelete={() => handleDelete(activity)}
            />
          </BulkItemShell>
        ))}
      </div>

      <AdminInfiniteScrollSentinel
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        onLoadMore={loadMore}
        remaining={rows.length - visibleCount}
      />

      <AdminContentPreviewDialog
        open={Boolean(previewActivity)}
        onOpenChange={(nextOpen) => !nextOpen && setPreviewActivity(null)}
        title={previewActivity?.title ?? "نمایش انتشار مطبوعاتی"}
        description={previewActivity?.description}
        imageUrl={
          previewActivity?.imageUrl ||
          previewActivity?.mediaItems?.find((item) => item.url)?.url ||
          null
        }
        meta={
          previewActivity ? (
            <p className="text-xs text-muted-foreground">
              {getActivityTypeLabel(previewActivity.activityType)}
              {previewActivity.location ? ` · ${previewActivity.location}` : ""}
            </p>
          ) : null
        }
        details={
          previewActivity
            ? [
                { label: "تاریخ", value: formatPersianDate(previewActivity.activityDate) },
                {
                  label: "رسانه‌ها",
                  value: previewActivity.mediaItems?.length
                    ? `${previewActivity.mediaItems.length} مورد`
                    : "—",
                },
                {
                  label: "لینک",
                  value: previewActivity.link ? (
                    <a
                      href={previewActivity.link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline"
                      dir="ltr"
                    >
                      {previewActivity.link}
                    </a>
                  ) : (
                    "—"
                  ),
                },
                {
                  label: "برچسب‌ها",
                  value: previewActivity.planLabels?.length ? previewActivity.planLabels.join("، ") : "—",
                },
                { label: "مالک", value: previewActivity.ownerName ?? "—" },
                { label: "امتیاز", value: previewActivity.score ?? "—" },
              ]
            : []
        }
        onEdit={
          previewActivity
            ? () => {
                setPreviewActivity(null);
                openEdit(previewActivity);
              }
            : undefined
        }
        onDelete={previewActivity ? () => handleDelete(previewActivity) : undefined}
        deleteLabel="این انتشار"
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "ویرایش" : "ثبت جدید"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>عنوان</Label>
              <Input {...form.register("title")} maxLength={CONTENT_TITLE_MAX_LENGTH} />
            </div>
            <div className="space-y-2">
              <Label>نوع</Label>
              <Select
                value={form.watch("activityType")}
                onValueChange={(value) => form.setValue("activityType", value as "magazine" | "newspaper")}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {pressActivityTypeOptions.map((type) => (
                    <SelectItem key={type} value={type}>
                      {getActivityTypeLabel(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <PersianDateField control={form.control} name="activityDate" label="تاریخ" />
            <div className="space-y-2">
              <Label>لینک مطلب (اختیاری)</Label>
              <div className="flex gap-2">
                <Input
                  {...form.register("link")}
                  dir="ltr"
                  placeholder="https://example.com/article"
                  className="min-w-0 flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending}
                  onClick={handleFetchFromLink}
                  title="خواندن عنوان، توضیح و کاور از لینک"
                  className="shrink-0 gap-1.5"
                >
                  <RefreshCw className={cn("h-4 w-4", isPending && "animate-spin")} />
                  از لینک
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                اگر لینک دارید، عنوان/توضیح/تصویر را می‌توان از صفحه خواند.
              </p>
            </div>
            <div className="space-y-2">
              <Label>مکان (اختیاری)</Label>
              <Input {...form.register("location")} />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <Label>رسانه‌ها (حداکثر {MAX_MEDIA_ITEMS})</Label>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => addMediaItem("image")}>
                    + تصویر
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => addMediaItem("video")}>
                    + ویدیو
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => addMediaItem("audio")}>
                    + صوت
                  </Button>
                </div>
              </div>
              {mediaItems.map((item) => (
                <div key={item.id} className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {item.type === "image" ? "تصویر" : item.type === "audio" ? "صوت" : "ویدیو"}
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
                    label={item.type === "image" ? "تصویر" : item.type === "audio" ? "صوت" : "ویدیو"}
                    kind={item.type === "image" ? "image" : item.type === "audio" ? "audio" : "video"}
                    uploadKind={
                      item.type === "image" ? "image" : item.type === "audio" ? "audio" : "activity-video"
                    }
                    fileOnly={item.type === "video" || item.type === "audio"}
                    maxFileSizeBytes={item.type === "video" ? ACTIVITY_VIDEO_MAX_BYTES : undefined}
                    coverImageUrl={
                      item.type === "video"
                        ? mediaItems.find((media) => media.type === "image" && media.url.trim())?.url
                        : undefined
                    }
                    onAutoCoverGenerated={
                      item.type === "video"
                        ? (coverUrl) => {
                            setMediaItems((prev) => {
                              const { mediaItems: next, applied } = applyVideoCoverToMediaItems(
                                prev,
                                coverUrl,
                                MAX_MEDIA_ITEMS
                              );
                              return applied ? next : prev;
                            });
                          }
                        : undefined
                    }
                    accept={
                      item.type === "image"
                        ? "image/*"
                        : item.type === "audio"
                          ? "audio/*"
                          : "video/mp4,video/webm,video/quicktime"
                    }
                  />
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Label>توضیحات (اختیاری)</Label>
              <Textarea {...form.register("description")} rows={4} />
            </div>
            <PlanLabelSelect
              topics={contentTopics}
              plans={contentPlans}
              values={planLabels}
              onChangeMultiple={setPlanLabels}
            />
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
                  const current = rows.find((row) => row.id === editingId);
                  if (current) handleDelete(current);
                }}
              >
                حذف
              </Button>
            )}
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
