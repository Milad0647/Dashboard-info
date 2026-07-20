"use client";

import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  CONTENT_TITLE_MAX_LENGTH,
  CONTENT_TITLE_MAX_LENGTH_MESSAGE,
} from "@/lib/content-constraints";
import { Star, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AdminContentFilterBar,
  collectAdminFilterUsers,
  DEFAULT_ADMIN_CONTENT_FILTER,
  matchesAdminContentFilter,
  sortAdminContentItems,
  type AdminContentFilterState,
} from "@/components/admin/admin-content-filter-bar";
import { AdminActivityCompactCard } from "@/components/admin/admin-activity-compact-card";
import { AdminCompactAddCard } from "@/components/admin/admin-compact-add-card";
import { adminCreatedAtDetail } from "@/components/admin/admin-created-at";
import { AdminItemActions } from "@/components/admin/admin-item-actions";
import { AdminContentPreviewDialog } from "@/components/admin/admin-content-preview-dialog";
import { AdminViewModeToggle } from "@/components/admin/admin-view-mode-toggle";
import { PlanLabelSelect } from "@/components/admin/plan-label-select";
import { ContentOwnerSelect } from "@/components/admin/content-owner-select";
import { ContentScoreControl } from "@/components/admin/content-score-control";
import {
  BulkItemShell,
  SectionBulkEditBar,
  useSectionBulkEdit,
} from "@/components/admin/section-bulk-edit";
import { DocumentUpload } from "@/components/ui/document-upload";
import { MediaUpload } from "@/components/ui/media-upload";
import { PersianDateField } from "@/components/ui/persian-date-input";
import { applyVideoCoverToMediaItems } from "@/lib/client/activity-media-cover";
import { fieldActivityTypeOptions, getActivityTypeLabel } from "@/lib/activity-types";
import { deleteCampaignActivityAction, saveCampaignActivityAction } from "@/lib/actions/extended-actions";
import { normalizePlanLabels, type ContentTopic } from "@/lib/content-topics";
import { isDefaultActivityTitle, type EditSuggestionMissingField } from "@/lib/edit-suggestions";
import { useAdminEditDeepLink } from "@/lib/hooks/use-admin-edit-deep-link";
import { useAdminViewMode } from "@/lib/hooks/use-admin-view-mode";
import { useSectionCreateGate } from "@/lib/hooks/use-section-create-gate";
import { useAdminInfiniteScroll } from "@/lib/hooks/use-admin-infinite-scroll";
import { AdminInfiniteScrollSentinel } from "@/components/admin/admin-infinite-scroll-sentinel";
import { todayISO } from "@/lib/jalali";
import { isPressPublication } from "@/lib/press-publications";
import type {
  ActivityAttachment,
  ActivityMediaItem,
  ActivityType,
  AdminUser,
  CampaignActivity,
} from "@/lib/types";
import { cn, formatPersianDate } from "@/lib/utils";

const ACTIVITY_VIDEO_MAX_BYTES = 50 * 1024 * 1024;

const MAX_MEDIA_ITEMS = 10;
const MAX_ATTACHMENTS = 10;

function createEmptyAttachment(): ActivityAttachment {
  return {
    id: crypto.randomUUID(),
    title: "",
    fileUrl: "",
    fileName: "",
    mimeType: "",
    fileSize: 0,
  };
}

const schema = z.object({
  title: z
    .string()
    .min(1, "عنوان الزامی است")
    .max(CONTENT_TITLE_MAX_LENGTH, CONTENT_TITLE_MAX_LENGTH_MESSAGE),
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
  canTransferOwnership?: boolean;
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
  canTransferOwnership = false,
  users = [],
}: ActivitiesAdminProps) {
  const { requestCreate, tutorialModal } = useSectionCreateGate("activities");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewActivity, setPreviewActivity] = useState<CampaignActivity | null>(null);
  const [mediaItems, setMediaItems] = useState<ActivityMediaItem[]>([]);
  const [attachments, setAttachments] = useState<ActivityAttachment[]>([]);
  const [isMediaDragging, setIsMediaDragging] = useState(false);
  const [isBatchUploadingMedia, setIsBatchUploadingMedia] = useState(false);
  const [planLabels, setPlanLabels] = useState<string[]>([]);
  const [editOwnerUserId, setEditOwnerUserId] = useState<string | null>(null);
  const [isCreative, setIsCreative] = useState(false);
  const [contentFilter, setContentFilter] = useState<AdminContentFilterState>(DEFAULT_ADMIN_CONTENT_FILTER);
  const { viewMode, setViewMode } = useAdminViewMode("activities");
  const [rows, setRows] = useState(
    initialActivities.filter((activity) => !isPressPublication(activity))
  );
  const [isPending, startTransition] = useTransition();

  const filterUsers = useMemo(() => collectAdminFilterUsers(rows), [rows]);
  const filteredRows = useMemo(
    () =>
      sortAdminContentItems(
        rows.filter((item) => matchesAdminContentFilter(item, contentFilter)),
        contentFilter.sortOrder,
        (item) => item.activityDate || item.updatedAt || item.createdAt
      ),
    [rows, contentFilter]
  );
  const paginationResetKey = `${contentFilter.userKey}:${contentFilter.planLabels.join(",")}:${contentFilter.creative}:${contentFilter.sortOrder}:${viewMode}`;
  const { visibleCount, hasMore, isLoadingMore, loadMore } = useAdminInfiniteScroll(
    filteredRows.length,
    paginationResetKey
  );
  const visibleRows = useMemo(
    () => filteredRows.slice(0, visibleCount),
    [filteredRows, visibleCount]
  );
  const visibleIds = useMemo(() => visibleRows.map((item) => item.id), [visibleRows]);
  const bulk = useSectionBulkEdit(visibleIds);

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
    },
  });

  const { highlightFields, setHighlightFields, resetDeepLink } = useAdminEditDeepLink({
    items: rows,
    getId: (row) => row.id,
    basePath: "/admin/activities",
    onOpen: (activity, fields) => {
      setEditingId(activity.id);
      setMediaItems(activity.mediaItems ?? []);
      setAttachments(activity.attachments ?? []);
      setPlanLabels(normalizePlanLabels(activity.planLabels, activity.planLabel));
      setEditOwnerUserId(activity.ownerUserId ?? null);
      setIsCreative(Boolean(activity.isCreative));
      form.reset({
        title: activity.title,
        activityType: resolveFieldActivityType(activity.activityType),
        activityDate: activity.activityDate,
        location: activity.location,
        imageUrl: activity.imageUrl ?? "",
        videoUrl: activity.videoUrl ?? "",
        description: activity.description ?? "",
      });
      setHighlightFields(fields);
      setOpen(true);
    },
  });

  const watchedTitle = form.watch("title");
  const watchedActivityDate = form.watch("activityDate");
  const watchedLocation = form.watch("location");
  const watchedDescription = form.watch("description");
  const hasActivityMedia =
    Boolean(form.watch("imageUrl")?.trim() || form.watch("videoUrl")?.trim()) ||
    mediaItems.some((item) => item.url.trim());
  const highlightTitle =
    highlightFields.includes("title") &&
    (!watchedTitle?.trim() || isDefaultActivityTitle(watchedTitle));
  const highlightDate = highlightFields.includes("date") && !watchedActivityDate?.trim();
  const highlightLocation = highlightFields.includes("location") && !watchedLocation?.trim();
  const highlightMedia = highlightFields.includes("media") && !hasActivityMedia;
  const highlightDescription =
    highlightFields.includes("description") && !watchedDescription?.trim();

  const openCreate = () => {
    void requestCreate(() => {
      setEditingId(null);
      setMediaItems([]);
      setAttachments([]);
      setPlanLabels([]);
      setEditOwnerUserId(null);
      setIsCreative(false);
      setHighlightFields([]);
      form.reset({
        title: "",
        activityType: "field",
        activityDate: todayISO(),
        location: "",
        imageUrl: "",
        videoUrl: "",
        description: "",
      });
      setOpen(true);
    });
  };

  const openEdit = (activity: CampaignActivity, fields: EditSuggestionMissingField[] = []) => {
    setEditingId(activity.id);
    setMediaItems(activity.mediaItems ?? []);
    setAttachments(activity.attachments ?? []);
    setPlanLabels(normalizePlanLabels(activity.planLabels, activity.planLabel));
    setEditOwnerUserId(activity.ownerUserId ?? null);
    setIsCreative(Boolean(activity.isCreative));
    form.reset({
      title: activity.title,
      activityType: resolveFieldActivityType(activity.activityType),
      activityDate: activity.activityDate,
      location: activity.location,
      imageUrl: activity.imageUrl ?? "",
      videoUrl: activity.videoUrl ?? "",
      description: activity.description ?? "",
    });
    setHighlightFields(fields);
    setOpen(true);
  };

  const closeDialog = () => {
    setOpen(false);
    setEditingId(null);
    setMediaItems([]);
    setAttachments([]);
    setPlanLabels([]);
    setEditOwnerUserId(null);
    setIsCreative(false);
    resetDeepLink();
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

  const addAttachment = () => {
    if (attachments.length >= MAX_ATTACHMENTS) {
      toast.error(`حداکثر ${MAX_ATTACHMENTS} فایل پیوست مجاز است`);
      return;
    }
    setAttachments((prev) => [...prev, createEmptyAttachment()]);
  };

  const updateAttachment = (id: string, patch: Partial<ActivityAttachment>) => {
    setAttachments((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  };

  const uploadMediaFiles = async (files: FileList | File[]) => {
    const selectedFiles = Array.from(files);
    if (selectedFiles.length === 0) return;

    const availableSlots = MAX_MEDIA_ITEMS - mediaItems.length;
    if (availableSlots <= 0) {
      toast.error(`حداکثر ${MAX_MEDIA_ITEMS} فایل مجاز است`);
      return;
    }

    const filesToUpload = selectedFiles.slice(0, availableSlots);
    if (filesToUpload.length < selectedFiles.length) {
      toast.warning(`فقط ${availableSlots} فایل اول اضافه شد`);
    }

    setIsBatchUploadingMedia(true);
    try {
      const uploadedItems: ActivityMediaItem[] = [];

      for (const file of filesToUpload) {
        const type: ActivityMediaItem["type"] = file.type.startsWith("video/")
          ? "video"
          : file.type.startsWith("audio/")
            ? "audio"
            : "image";

        if (type === "video" && file.size > ACTIVITY_VIDEO_MAX_BYTES) {
          toast.error(`حجم ویدیو ${file.name} بیشتر از حد مجاز است`);
          continue;
        }

        const formData = new FormData();
        formData.append("file", file);
        formData.append("kind", type === "video" ? "activity-video" : type);

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? `آپلود ${file.name} ناموفق بود`);
        }

        const data = (await response.json()) as { url: string };
        uploadedItems.push({ id: crypto.randomUUID(), type, url: data.url });
      }

      if (uploadedItems.length > 0) {
        setMediaItems((prev) => [...prev, ...uploadedItems]);
        toast.success(`${uploadedItems.length} رسانه اضافه شد`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "آپلود رسانه‌ها ناموفق بود");
    } finally {
      setIsBatchUploadingMedia(false);
    }
  };

  const onSubmit = form.handleSubmit((data) => {
    const filledMedia = mediaItems.filter((item) => item.url.trim());
    const incompleteAttachment = attachments.find(
      (item) =>
        (item.title.trim() && !item.fileUrl.trim()) ||
        (!item.title.trim() && item.fileUrl.trim())
    );
    if (incompleteAttachment) {
      toast.error("برای هر فایل پیوست، هم عنوان و هم فایل لازم است");
      return;
    }
    const filledAttachments = attachments
      .filter((item) => item.title.trim() && item.fileUrl.trim())
      .map((item) => ({
        ...item,
        title: item.title.trim(),
        fileName: item.fileName || item.title.trim(),
      }));

    startTransition(async () => {
      const existing = editingId ? rows.find((row) => row.id === editingId) : undefined;
      const selectedOwner = canTransferOwnership
        ? users.find((user) => user.id === editOwnerUserId)
        : null;
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
        attachments: filledAttachments,
        description: data.description || null,
        isCreative,
        published: true,
        planLabels,
        planLabel: planLabels[0] ?? null,
        ...(canTransferOwnership
          ? {
              ownerUserId: editOwnerUserId,
              ownerName: selectedOwner?.name ?? existing?.ownerName ?? null,
            }
          : {}),
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
        attachments: filledAttachments,
        description: data.description || null,
        isCreative,
        published: true,
        planLabels,
        planLabel: planLabels[0] ?? null,
        sortOrder: rows.length + 1,
        ownerUserId: canTransferOwnership
          ? editOwnerUserId
          : existing?.ownerUserId,
        ownerName: canTransferOwnership
          ? selectedOwner?.name ?? existing?.ownerName ?? null
          : existing?.ownerName,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setRows((prev) =>
        editingId
          ? prev.map((row) => (row.id === editingId ? { ...row, ...nextActivity } : row))
          : [...prev, nextActivity]
      );
      toast.success("ذخیره شد");
      closeDialog();
    });
  });

  return (
    <div className="space-y-4">
      {tutorialModal}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">اقدامات</h1>
          <p className="text-sm text-muted-foreground">
            ثبت فعالیت‌های میدانی: تراکت، غرفه، شعرخوانی، نقاشی و ... (تا {MAX_MEDIA_ITEMS} رسانه)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AdminViewModeToggle value={viewMode} onChange={setViewMode} />
        </div>
      </div>

      <AdminContentFilterBar
        filter={contentFilter}
        onChange={setContentFilter}
        users={canTransferOwnership || isFullAdmin ? filterUsers : []}
        plans={contentPlans}
        showCreativeFilter
      />

      <SectionBulkEditBar
        campaignId={campaignId}
        contentType="activity"
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
        canTransferOwnership={canTransferOwnership || isFullAdmin}
        users={users}
      />

      {viewMode === "grid" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {!bulk.bulkMode && <AdminCompactAddCard onClick={openCreate} label="اقدام جدید" />}
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
      ) : (
        <div className="space-y-3">
          {!bulk.bulkMode && (
            <div className="max-w-[10rem]">
              <AdminCompactAddCard onClick={openCreate} label="اقدام جدید" />
            </div>
          )}
          <div className="overflow-hidden rounded-xl border">
          {visibleRows.map((activity) => (
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
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="truncate font-medium">{activity.title}</p>
                    {activity.isCreative && (
                      <Badge
                        variant="warning"
                        className="shrink-0 gap-0.5 px-1.5 py-0 text-[10px]"
                      >
                        <Star className="h-2.5 w-2.5 fill-current" />
                        خلاقانه
                      </Badge>
                    )}
                  </div>
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
        </div>
      )}

      <AdminInfiniteScrollSentinel
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        onLoadMore={loadMore}
        remaining={filteredRows.length - visibleCount}
      />

      <AdminContentPreviewDialog
        open={Boolean(previewActivity)}
        onOpenChange={(open) => !open && setPreviewActivity(null)}
        title={previewActivity?.title ?? "نمایش اقدام"}
        description={previewActivity?.description}
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
        details={
          previewActivity
            ? [
                { label: "تاریخ", value: formatPersianDate(previewActivity.activityDate) },
                adminCreatedAtDetail(previewActivity.createdAt),
                { label: "مکان", value: previewActivity.location || "—" },
                {
                  label: "رسانه‌ها",
                  value: previewActivity.mediaItems?.length
                    ? `${previewActivity.mediaItems.length} مورد`
                    : "—",
                },
                {
                  label: "فایل‌های پیوست",
                  value: previewActivity.attachments?.length
                    ? `${previewActivity.attachments.length} مورد`
                    : "—",
                },
                {
                  label: "برچسب‌ها",
                  value: previewActivity.planLabels?.length ? previewActivity.planLabels.join("، ") : "—",
                },
                {
                  label: "خلاقانه",
                  value: previewActivity.isCreative ? "بله" : "خیر",
                },
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
      />

      <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? setOpen(true) : closeDialog())}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "ویرایش اقدام" : "اقدام جدید"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className={cn(highlightTitle && "text-destructive")}>عنوان</Label>
              <Input
                {...form.register("title")}
                maxLength={CONTENT_TITLE_MAX_LENGTH}
                placeholder="مثلاً غرفه‌گذاری در نمایشگاه کتاب"
                className={cn(highlightTitle && "border-destructive focus-visible:ring-destructive")}
              />
              {highlightTitle && (
                <p className="text-xs text-destructive">عنوان پیش‌فرض یا خالی است؛ یک عنوان اختصاصی وارد کنید.</p>
              )}
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
            <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2.5">
              <div className="space-y-0.5 text-right">
                <Label htmlFor="activity-is-creative" className="flex items-center gap-1.5">
                  <Star className="h-3.5 w-3.5 text-amber-500" />
                  اقدام خلاقانه
                </Label>
                <p className="text-xs text-muted-foreground">
                  با بج ستاره مشخص می‌شود و در فیلتر جدا می‌شود
                </p>
              </div>
              <Switch
                id="activity-is-creative"
                checked={isCreative}
                onCheckedChange={setIsCreative}
              />
            </div>
            <div className={cn(highlightDate && "rounded-lg border border-destructive bg-destructive/5 p-3")}>
              <PersianDateField control={form.control} name="activityDate" label="تاریخ" />
              {highlightDate && (
                <p className="mt-1 text-xs text-destructive">تاریخ اقدام خالی است؛ لطفاً انتخاب کنید.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label className={cn(highlightLocation && "text-destructive")}>مکان (اختیاری)</Label>
              <Input
                {...form.register("location")}
                placeholder="شهر یا محل برگزاری"
                className={cn(highlightLocation && "border-destructive focus-visible:ring-destructive")}
              />
              {highlightLocation && (
                <p className="text-xs text-destructive">مکان خالی است؛ بهتر است تکمیل شود.</p>
              )}
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
            {canTransferOwnership && (
              <ContentOwnerSelect
                users={users}
                value={editOwnerUserId}
                onChange={setEditOwnerUserId}
              />
            )}
            <div
              className={cn(
                "space-y-3",
                highlightMedia && "rounded-lg border border-destructive bg-destructive/5 p-3"
              )}
            >
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
              <div
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsMediaDragging(true);
                }}
                onDragLeave={() => setIsMediaDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsMediaDragging(false);
                  void uploadMediaFiles(event.dataTransfer.files);
                }}
                className={cn(
                  "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-5 text-center transition-colors",
                  isMediaDragging && "border-primary bg-primary/5",
                  isBatchUploadingMedia && "pointer-events-none opacity-60"
                )}
              >
                <Upload className="h-7 w-7 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">چند تصویر، فیلم یا صوت را اینجا بکشید و رها کنید</p>
                  <p className="text-xs text-muted-foreground">
                    فایل‌ها خودکار آپلود و به لیست رسانه‌ها اضافه می‌شوند.
                  </p>
                </div>
                {isBatchUploadingMedia ? (
                  <p className="text-xs text-muted-foreground">در حال آپلود رسانه‌ها...</p>
                ) : null}
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
              {highlightMedia && (
                <p className="text-xs text-destructive">هنوز رسانه‌ای اضافه نشده است.</p>
              )}
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <Label>فایل‌های قابل دانلود (حداکثر {MAX_ATTACHMENTS})</Label>
                <Button type="button" variant="outline" size="sm" onClick={addAttachment}>
                  + افزودن فایل
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                برای هر فایل یک عنوان بگذارید؛ تصویر، ویدیو، PDF، Word یا Excel قابل آپلود و دانلود است.
              </p>
              {attachments.map((item, index) => (
                <div key={item.id} className="space-y-3 rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">فایل {index + 1}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setAttachments((prev) => prev.filter((attachment) => attachment.id !== item.id))
                      }
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label>عنوان فایل</Label>
                    <Input
                      value={item.title}
                      maxLength={CONTENT_TITLE_MAX_LENGTH}
                      placeholder="مثلاً گزارش کامل اقدام"
                      onChange={(event) => updateAttachment(item.id, { title: event.target.value })}
                    />
                  </div>
                  <DocumentUpload
                    label="فایل"
                    variant="attachment"
                    value={item.fileUrl}
                    fileName={item.fileName}
                    fileSize={item.fileSize}
                    mimeType={item.mimeType}
                    onChange={(payload) =>
                      updateAttachment(item.id, {
                        fileUrl: payload.url,
                        fileName: payload.fileName,
                        fileSize: payload.fileSize,
                        mimeType: payload.mimeType,
                      })
                    }
                  />
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Label className={cn(highlightDescription && "text-amber-700 dark:text-amber-300")}>توضیحات (اختیاری)</Label>
              <Textarea
                {...form.register("description")}
                rows={4}
                placeholder="جزئیات اقدام، تعداد مخاطب، نتایج و ..."
                className={cn(
                  highlightDescription && "border-amber-500 focus-visible:ring-amber-500"
                )}
              />
              {highlightDescription && (
                <p className="text-xs text-amber-700 dark:text-amber-300">توضیحات خالی است؛ بهتر است تکمیل شود.</p>
              )}
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
                    closeDialog();
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
