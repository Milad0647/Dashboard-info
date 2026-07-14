"use client";

import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AdminContentFilterBar,
  collectAdminFilterUsers,
  DEFAULT_ADMIN_CONTENT_FILTER,
  matchesAdminContentFilter,
  type AdminContentFilterState,
} from "@/components/admin/admin-content-filter-bar";
import { AdminActivityCompactCard } from "@/components/admin/admin-activity-compact-card";
import { AdminCompactAddCard } from "@/components/admin/admin-compact-add-card";
import { AdminItemActions } from "@/components/admin/admin-item-actions";
import { AdminContentPreviewDialog } from "@/components/admin/admin-content-preview-dialog";
import { AdminViewModeToggle } from "@/components/admin/admin-view-mode-toggle";
import { PlanLabelSelect } from "@/components/admin/plan-label-select";
import { ContentScoreControl } from "@/components/admin/content-score-control";
import {
  BulkItemShell,
  SectionBulkEditBar,
  useSectionBulkEdit,
} from "@/components/admin/section-bulk-edit";
import { MediaUpload } from "@/components/ui/media-upload";
import { PersianDateField } from "@/components/ui/persian-date-input";
import { fieldActivityTypeOptions, getActivityTypeLabel } from "@/lib/activity-types";
import { deleteCampaignActivityAction, saveCampaignActivityAction } from "@/lib/actions/extended-actions";
import { normalizePlanLabels, type ContentTopic } from "@/lib/content-topics";
import { useAdminViewMode } from "@/lib/hooks/use-admin-view-mode";
import { todayISO } from "@/lib/jalali";
import { isPressPublication } from "@/lib/press-publications";
import type { ActivityMediaItem, ActivityType, AdminUser, CampaignActivity } from "@/lib/types";

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
  contentPlans?: string[];
  contentTopics?: ContentTopic[];
  canScore?: boolean;
  isFullAdmin?: boolean;
  users?: AdminUser[];
}

function resolveFieldActivityType(type: ActivityType): FieldActivityType {
  return fieldActivityTypeOptions.includes(type) ? (type as FieldActivityType) : "field";
}

export function ActivitiesAdmin({
  campaignId,
  initialActivities,
  contentPlans = [],
  contentTopics = [],
  canScore = false,
  isFullAdmin = false,
  users = [],
}: ActivitiesAdminProps) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewActivity, setPreviewActivity] = useState<CampaignActivity | null>(null);
  const [mediaItems, setMediaItems] = useState<ActivityMediaItem[]>([]);
  const [planLabels, setPlanLabels] = useState<string[]>([]);
  const [contentFilter, setContentFilter] = useState<AdminContentFilterState>(DEFAULT_ADMIN_CONTENT_FILTER);
  const { viewMode, setViewMode } = useAdminViewMode("activities");
  const [rows, setRows] = useState(
    initialActivities.filter((activity) => !isPressPublication(activity))
  );
  const [isPending, startTransition] = useTransition();

  const filterUsers = useMemo(() => collectAdminFilterUsers(rows), [rows]);
  const filteredRows = useMemo(
    () => rows.filter((item) => matchesAdminContentFilter(item, contentFilter)),
    [rows, contentFilter]
  );
  const filteredIds = useMemo(() => filteredRows.map((item) => item.id), [filteredRows]);
  const bulk = useSectionBulkEdit(filteredIds);

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
      published: true,
    },
  });

  const openCreate = () => {
    setEditingId(null);
    setMediaItems([]);
    setPlanLabels([]);
    form.reset({
      title: "",
      activityType: "field",
      activityDate: todayISO(),
      location: "",
      imageUrl: "",
      videoUrl: "",
      description: "",
      published: true,
    });
    setOpen(true);
  };

  const openEdit = (activity: CampaignActivity) => {
    setEditingId(activity.id);
    setMediaItems(activity.mediaItems ?? []);
    setPlanLabels(normalizePlanLabels(activity.planLabels, activity.planLabel));
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

  const handleDelete = (activity: CampaignActivity) => {
    if (!window.confirm(`حذف «${activity.title}»؟`)) return;
    startTransition(async () => {
      await deleteCampaignActivityAction(activity.id);
      setRows((prev) => prev.filter((row) => row.id !== activity.id));
      toast.success("حذف شد");
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
        imageUrl: filledMedia.find((item) => item.type === "image")?.url ?? (data.imageUrl || null),
        videoUrl: filledMedia.find((item) => item.type === "video")?.url ?? (data.videoUrl || null),
        mediaItems: filledMedia,
        description: data.description || null,
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
        imageUrl: filledMedia.find((item) => item.type === "image")?.url ?? (data.imageUrl || null),
        videoUrl: filledMedia.find((item) => item.type === "video")?.url ?? (data.videoUrl || null),
        mediaItems: filledMedia,
        description: data.description || null,
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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">اقدامات</h1>
          <p className="text-sm text-muted-foreground">
            ثبت فعالیت‌های میدانی: تراکت، غرفه، شعرخوانی، نقاشی و ... (تا {MAX_MEDIA_ITEMS} رسانه)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AdminViewModeToggle value={viewMode} onChange={setViewMode} />
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            اقدام جدید
          </Button>
        </div>
      </div>

      <AdminContentFilterBar
        filter={contentFilter}
        onChange={setContentFilter}
        users={isFullAdmin ? filterUsers : []}
        plans={contentPlans}
      />

      <SectionBulkEditBar
        campaignId={campaignId}
        contentType="activity"
        bulkMode={bulk.bulkMode}
        onBulkModeChange={bulk.setBulkMode}
        selectedIds={[...bulk.selectedIds]}
        visibleCount={filteredRows.length}
        allVisibleSelected={bulk.allVisibleSelected}
        onToggleAllVisible={bulk.toggleAllVisible}
        onClearSelection={bulk.clearSelection}
        contentPlans={contentPlans}
        contentTopics={contentTopics}
        isFullAdmin={isFullAdmin}
        users={users}
      />

      {viewMode === "grid" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {!bulk.bulkMode && <AdminCompactAddCard onClick={openCreate} label="اقدام جدید" />}
          {filteredRows.map((activity) => (
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
      ) : (
        <div className="overflow-hidden rounded-xl border">
          {filteredRows.map((activity) => (
            <div
              key={activity.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 last:border-b-0"
            >
              <div className="flex min-w-0 items-start gap-3">
                {bulk.bulkMode && (
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4"
                    checked={bulk.isSelected(activity.id)}
                    onChange={() => bulk.toggle(activity.id)}
                  />
                )}
                <div className="min-w-0">
                  <p className="truncate font-medium">{activity.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {getActivityTypeLabel(activity.activityType)} · {activity.ownerName ?? "—"}
                  </p>
                </div>
              </div>
              {!bulk.bulkMode && (
                <AdminItemActions
                  onView={() => setPreviewActivity(activity)}
                  onEdit={() => openEdit(activity)}
                  onDelete={() => handleDelete(activity)}
                />
              )}
            </div>
          ))}
          {filteredRows.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">موردی یافت نشد.</div>
          )}
        </div>
      )}

      <AdminContentPreviewDialog
        open={Boolean(previewActivity)}
        onOpenChange={(open) => !open && setPreviewActivity(null)}
        title={previewActivity?.title ?? "نمایش اقدام"}
        description={previewActivity?.location}
        imageUrl={
          previewActivity?.imageUrl ||
          previewActivity?.mediaItems?.find((item) => item.url)?.url ||
          null
        }
        meta={
          previewActivity ? (
            <p className="text-xs text-muted-foreground">
              {getActivityTypeLabel(previewActivity.activityType)} · {previewActivity.ownerName ?? "—"}
            </p>
          ) : null
        }
        onEdit={
          previewActivity
            ? () => {
                setPreviewActivity(null);
                openEdit(previewActivity);
              }
            : undefined
        }
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
            <PlanLabelSelect
              topics={contentTopics}
              plans={contentPlans}
              values={planLabels}
              onChangeMultiple={setPlanLabels}
            />
            {editingId && (
              <ContentScoreControl
                campaignId={campaignId}
                contentType="activity"
                contentId={editingId}
                score={rows.find((row) => row.id === editingId)?.score}
                canScore={canScore}
                onScoreSaved={(score) =>
                  setRows((prev) =>
                    prev.map((row) => (row.id === editingId ? { ...row, score } : row))
                  )
                }
              />
            )}
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
              <Textarea {...form.register("description")} rows={4} placeholder="جزئیات اقدام، تعداد مخاطب، نتایج و ..." />
            </div>
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
