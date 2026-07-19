"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { AdminCompactAddCard } from "@/components/admin/admin-compact-add-card";
import { AdminItemActions } from "@/components/admin/admin-item-actions";
import { AdminContentPreviewDialog } from "@/components/admin/admin-content-preview-dialog";
import { AdminSocialPostCompactCard } from "@/components/admin/admin-social-post-compact-card";
import { AdminViewModeToggle } from "@/components/admin/admin-view-mode-toggle";
import { PlanLabelSelect } from "@/components/admin/plan-label-select";
import { ContentOwnerSelect } from "@/components/admin/content-owner-select";
import { ContentScoreControl } from "@/components/admin/content-score-control";
import {
  BulkItemShell,
  SectionBulkEditBar,
  useSectionBulkEdit,
} from "@/components/admin/section-bulk-edit";
import { normalizePlanLabels, type ContentTopic } from "@/lib/content-topics";
import { MediaUpload } from "@/components/ui/media-upload";
import { PersianDateField } from "@/components/ui/persian-date-input";
import { deleteSocialPostAction, fetchSocialLinkMetricsAction, saveSocialPostAction } from "@/lib/actions/extended-actions";
import { detectLinkMetricsPlatform } from "@/lib/services/link-metrics/detect";
import { RefreshCw } from "lucide-react";
import {
  parseEditSuggestionMissingFields,
  type EditSuggestionMissingField,
} from "@/lib/edit-suggestions";
import { useAdminViewMode } from "@/lib/hooks/use-admin-view-mode";
import { useSectionCreateGate } from "@/lib/hooks/use-section-create-gate";
import { useAdminInfiniteScroll } from "@/lib/hooks/use-admin-infinite-scroll";
import { AdminInfiniteScrollSentinel } from "@/components/admin/admin-infinite-scroll-sentinel";
import { todayISO } from "@/lib/jalali";
import { videoNeedsAutoCover } from "@/lib/client/video-cover";
import { isSitePublication } from "@/lib/social-posts";
import { SocialPlatformIcon, getSocialPlatformLabel } from "@/components/public/social-platform-icon";
import type { AdminUser, SocialContentType, SocialMediaPost, SocialPlatform } from "@/lib/types";
import { cn, formatPersianDate, formatPersianNumber, getStatusLabel } from "@/lib/utils";
import { GenerateMissingVideoCoversButton } from "@/components/admin/generate-missing-video-covers-button";
import {
  CONTENT_TITLE_MAX_LENGTH,
  CONTENT_TITLE_MAX_LENGTH_MESSAGE,
} from "@/lib/content-constraints";

const schema = z.object({
  platform: z.enum(["instagram", "x", "telegram", "linkedin", "youtube", "aparat", "rubika", "eitaa", "soroush", "bale", "other"]),
  title: z.string().min(1).max(CONTENT_TITLE_MAX_LENGTH, CONTENT_TITLE_MAX_LENGTH_MESSAGE),
  coverImageUrl: z.string().optional(),
  views: z.coerce.number().min(0),
  likes: z.coerce.number().min(0),
  comments: z.coerce.number().min(0),
  shares: z.coerce.number().min(0),
  link: z.string().optional(),
  contentType: z.enum(["image", "text", "video", "carousel", "story", "reel", "audio"]),
  mediaUrl: z.string().optional(),
  description: z.string().optional(),
  publishedDate: z.string(),
});

const platformOptions: SocialPlatform[] = [
  "instagram",
  "x",
  "telegram",
  "linkedin",
  "youtube",
  "aparat",
  "rubika",
  "eitaa",
  "soroush",
  "bale",
  "other",
];

const contentTypeOptions: SocialContentType[] = ["image", "text", "video", "carousel", "story", "reel", "audio"];

interface SocialPostsAdminProps {
  campaignId: string;
  initialPosts: SocialMediaPost[];
  contentPlans?: string[];
  contentTopics?: ContentTopic[];
  canScore?: boolean;
  isFullAdmin?: boolean;
  canTransferOwnership?: boolean;
  users?: AdminUser[];
}

export function SocialPostsAdmin({
  campaignId,
  initialPosts,
  contentPlans = [],
  contentTopics = [],
  canScore = false,
  isFullAdmin = false,
  canTransferOwnership = false,
  users = [],
}: SocialPostsAdminProps) {
  const { requestCreate, tutorialModal } = useSectionCreateGate("socialPosts");
  const router = useRouter();
  const searchParams = useSearchParams();
  const openedFromQueryRef = useRef<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewPost, setPreviewPost] = useState<SocialMediaPost | null>(null);
  const [planLabels, setPlanLabels] = useState<string[]>([]);
  const [editOwnerUserId, setEditOwnerUserId] = useState<string | null>(null);
  const [highlightFields, setHighlightFields] = useState<EditSuggestionMissingField[]>([]);
  const [contentFilter, setContentFilter] = useState<AdminContentFilterState>(DEFAULT_ADMIN_CONTENT_FILTER);
  const { viewMode, setViewMode } = useAdminViewMode("social-posts");
  const [rows, setRows] = useState(initialPosts.filter((post) => !isSitePublication(post)));
  const [isPending, startTransition] = useTransition();

  const filterUsers = useMemo(() => collectAdminFilterUsers(rows), [rows]);
  const filteredRows = useMemo(
    () => rows.filter((item) => matchesAdminContentFilter(item, contentFilter)),
    [rows, contentFilter]
  );
  const paginationResetKey = `${contentFilter.userKey}:${contentFilter.planLabels.join(",")}:${viewMode}`;
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

  useEffect(() => {
    setRows(initialPosts.filter((post) => !isSitePublication(post)));
  }, [initialPosts]);

  const clearEditQuery = () => {
    if (!searchParams.get("edit") && !searchParams.get("missing")) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("edit");
    params.delete("missing");
    const query = params.toString();
    router.replace(query ? `/admin/social-posts?${query}` : "/admin/social-posts");
  };

  const closeEditor = () => {
    setOpen(false);
    setEditingId(null);
    setHighlightFields([]);
    openedFromQueryRef.current = null;
    clearEditQuery();
  };

  const missingCoverTargets = useMemo(() => {
    return rows.flatMap((post) => {
      const isVideoContent = post.contentType === "video" || post.contentType === "reel";
      const mediaUrl = post.mediaUrl?.trim() ?? "";
      if (!isVideoContent || !mediaUrl) return [];
      if (!videoNeedsAutoCover(mediaUrl, post.coverImageUrl)) return [];
      return [
        {
          id: post.id,
          label: post.title,
          videoUrl: mediaUrl,
          thumbnailUrl: post.coverImageUrl,
          applyCover: async (coverUrl: string) => {
            await saveSocialPostAction({
              ...post,
              coverImageUrl: coverUrl,
            });
            setRows((prev) =>
              prev.map((row) => (row.id === post.id ? { ...row, coverImageUrl: coverUrl } : row))
            );
          },
        },
      ];
    });
  }, [rows]);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      platform: "instagram" as SocialPlatform,
      title: "",
      coverImageUrl: "",
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      link: "",
      contentType: "image" as SocialContentType,
      mediaUrl: "",
      description: "",
      publishedDate: todayISO(),
    },
  });

  const openCreate = () => {
    void requestCreate(() => {
      setEditingId(null);
      setHighlightFields([]);
      setPlanLabels([]);
      setEditOwnerUserId(null);
      form.reset({
        platform: "instagram",
        title: "",
        coverImageUrl: "",
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        link: "",
        contentType: "image",
        mediaUrl: "",
        description: "",
        publishedDate: todayISO(),
      });
      setOpen(true);
    });
  };

  const openEdit = (post: SocialMediaPost, fields: EditSuggestionMissingField[] = []) => {
    if (isSitePublication(post)) return;
    setEditingId(post.id);
    setHighlightFields(fields);
    setPlanLabels(normalizePlanLabels(post.planLabels, post.planLabel));
    setEditOwnerUserId(post.ownerUserId ?? null);
    form.reset({
      platform: post.platform as SocialPlatform,
      title: post.title,
      coverImageUrl: post.coverImageUrl ?? "",
      views: post.views,
      likes: post.likes,
      comments: post.comments,
      shares: post.shares,
      link: post.link,
      contentType: post.contentType,
      mediaUrl: post.mediaUrl ?? "",
      description: post.description ?? "",
      publishedDate: post.publishedDate,
    });
    setOpen(true);
  };

  useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId || openedFromQueryRef.current === editId) return;
    const post = rows.find((item) => item.id === editId);
    if (!post) return;
    openedFromQueryRef.current = editId;
    openEdit(post, parseEditSuggestionMissingFields(searchParams.get("missing")));
    // openEdit depends on form; intentionally run when query/rows change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, searchParams]);

  const watchedTitle = form.watch("title");
  const watchedLink = form.watch("link");
  const watchedDescription = form.watch("description");
  const watchedCover = form.watch("coverImageUrl");
  const watchedMedia = form.watch("mediaUrl");
  const highlightTitle = highlightFields.includes("title") && !watchedTitle?.trim();
  const highlightLink = highlightFields.includes("link") && !watchedLink?.trim();
  const highlightDescription =
    highlightFields.includes("description") && !watchedDescription?.trim();
  const highlightMedia =
    highlightFields.includes("media") && !watchedCover?.trim() && !watchedMedia?.trim();

  const handleDelete = (post: SocialMediaPost) => {
    if (!window.confirm(`حذف «${post.title}»؟`)) return;
    startTransition(async () => {
      await deleteSocialPostAction(post.id);
      setRows((prev) => prev.filter((row) => row.id !== post.id));
      toast.success("حذف شد");
    });
  };

  const handleFetchFromLink = () => {
    const link = form.getValues("link")?.trim() ?? "";
    const platform = form.getValues("platform");
    if (!link) {
      toast.error("ابتدا لینک پست را وارد کنید");
      return;
    }

    const detected = detectLinkMetricsPlatform(link, platform);
    if (detected !== "eitaa" && detected !== "aparat" && detected !== "web") {
      toast.error(
        detected === "unsupported"
          ? "واکشی خودکار برای این لینک پشتیبانی نمی‌شود"
          : "برای بله، سروش و روبیکا واکشی خودکار از لینک ممکن نیست؛ اعداد را دستی وارد کنید"
      );
      return;
    }

    startTransition(async () => {
      const result = await fetchSocialLinkMetricsAction({ url: link, platform });
      if (!result.success) {
        toast.error(result.error);
        return;
      }

      if (typeof result.views === "number") {
        form.setValue("views", result.views);
      }
      if (typeof result.likes === "number") {
        form.setValue("likes", result.likes);
      }
      if (typeof result.comments === "number") {
        form.setValue("comments", result.comments);
      }
      if (typeof result.shares === "number") {
        form.setValue("shares", result.shares);
      }

      const currentTitle = form.getValues("title")?.trim() ?? "";
      if (!currentTitle && result.title?.trim()) {
        form.setValue("title", result.title.trim());
      }

      const currentDescription = form.getValues("description")?.trim() ?? "";
      if (!currentDescription && result.description?.trim()) {
        form.setValue("description", result.description.trim());
      }

      const currentCover = form.getValues("coverImageUrl")?.trim() ?? "";
      if (!currentCover && result.coverImageUrl?.trim()) {
        form.setValue("coverImageUrl", result.coverImageUrl.trim());
      }

      if (result.publishedDate && !form.getValues("publishedDate")) {
        form.setValue("publishedDate", result.publishedDate);
      }

      if (platform !== "eitaa" && platform !== "aparat" && (detected === "eitaa" || detected === "aparat")) {
        form.setValue("platform", detected);
      }

      toast.success(
        typeof result.views === "number"
          ? `آمار از لینک خوانده شد (بازدید: ${result.views.toLocaleString("fa-IR")})`
          : "اطلاعات از لینک خوانده شد"
      );
    });
  };

  const onSubmit = form.handleSubmit((data) => {
    startTransition(async () => {
      const existing = editingId ? rows.find((row) => row.id === editingId) : undefined;
      const selectedOwner = canTransferOwnership
        ? users.find((user) => user.id === editOwnerUserId)
        : null;
      const result = await saveSocialPostAction({
        ...data,
        campaignId,
        id: editingId ?? undefined,
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
        toast.error("ذخیره نشد");
        return;
      }

      const savedId =
        "id" in result && typeof result.id === "string" && result.id
          ? result.id
          : editingId ?? crypto.randomUUID();

      const ownerPatch = canTransferOwnership
        ? {
            ownerUserId: editOwnerUserId,
            ownerName: selectedOwner?.name ?? existing?.ownerName ?? null,
          }
        : {};

      if (editingId) {
        setRows((prev) =>
          prev.map((row) =>
            row.id === editingId
              ? { ...row, ...data, campaignId, link: data.link ?? "", published: true, planLabels, planLabel: planLabels[0] ?? null, ...ownerPatch } as SocialMediaPost
              : row
          )
        );
      } else {
        setRows((prev) => [
          ...prev,
          {
            id: savedId,
            campaignId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            sortOrder: prev.length,
            ...data,
            link: data.link ?? "",
            published: true,
            planLabels,
            planLabel: planLabels[0] ?? null,
            ...ownerPatch,
          } as SocialMediaPost,
        ]);
      }

      toast.success("ذخیره شد");
      closeEditor();
    });
  });

  return (
    <div className="space-y-4" dir="rtl">
      {tutorialModal}
      <div className="flex items-center justify-between gap-4">
        <div className="text-right">
          <h1 className="text-2xl font-bold">پست‌های شبکه اجتماعی</h1>
          <p className="text-sm text-muted-foreground">ثبت پست‌ها، بازدید، لینک و نوع محتوا</p>
        </div>
        <div className="flex items-center gap-2">
          <GenerateMissingVideoCoversButton targets={missingCoverTargets} />
          <AdminViewModeToggle value={viewMode} onChange={setViewMode} />
        </div>
      </div>

      <AdminContentFilterBar
        filter={contentFilter}
        onChange={setContentFilter}
        users={canTransferOwnership || isFullAdmin ? filterUsers : []}
        plans={contentPlans}
      />

      <SectionBulkEditBar
        campaignId={campaignId}
        contentType="social_post"
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
          {!bulk.bulkMode && <AdminCompactAddCard onClick={openCreate} label="پست جدید" />}
          {visibleRows.map((post) => (
            <BulkItemShell
              key={post.id}
              enabled={bulk.bulkMode}
              selected={bulk.isSelected(post.id)}
              onToggle={() => bulk.toggle(post.id)}
            >
              <AdminSocialPostCompactCard
                post={post}
                onClick={() => openEdit(post)}
                onView={() => setPreviewPost(post)}
                onEdit={() => openEdit(post)}
                onDelete={() => handleDelete(post)}
              />
            </BulkItemShell>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {!bulk.bulkMode && (
            <div className="max-w-[10rem]">
              <AdminCompactAddCard onClick={openCreate} label="پست جدید" />
            </div>
          )}
          <div className="overflow-hidden rounded-xl border">
          {visibleRows.map((post) => (
            <div
              key={post.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 last:border-b-0"
            >
              <div className="flex min-w-0 items-start gap-3">
                {bulk.bulkMode && (
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4"
                    checked={bulk.isSelected(post.id)}
                    onChange={() => bulk.toggle(post.id)}
                  />
                )}
                <div className="min-w-0">
                  <p className="truncate font-medium">{post.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {getStatusLabel(post.platform)} · {post.ownerName ?? "—"}
                  </p>
                </div>
              </div>
              {!bulk.bulkMode && (
                <AdminItemActions
                  onView={() => setPreviewPost(post)}
                  onEdit={() => openEdit(post)}
                  onDelete={() => handleDelete(post)}
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
        open={Boolean(previewPost)}
        onOpenChange={(open) => !open && setPreviewPost(null)}
        title={previewPost?.title ?? "نمایش پست"}
        description={previewPost?.description}
        imageUrl={previewPost?.mediaUrl || previewPost?.coverImageUrl}
        meta={
          previewPost ? (
            <p className="text-xs text-muted-foreground">
              {getStatusLabel(previewPost.platform)} · {previewPost.ownerName ?? "—"}
            </p>
          ) : null
        }
        details={
          previewPost
            ? [
                { label: "تاریخ انتشار", value: formatPersianDate(previewPost.publishedDate) },
                { label: "نوع محتوا", value: getStatusLabel(previewPost.contentType) },
                {
                  label: "برچسب‌ها",
                  value: previewPost.planLabels?.length ? previewPost.planLabels.join("، ") : "—",
                },
                { label: "بازدید", value: formatPersianNumber(previewPost.views) },
                { label: "لایک", value: formatPersianNumber(previewPost.likes) },
                { label: "کامنت", value: formatPersianNumber(previewPost.comments) },
                { label: "اشتراک‌گذاری", value: formatPersianNumber(previewPost.shares) },
                {
                  label: "لینک",
                  value: previewPost.link ? (
                    <a href={previewPost.link} target="_blank" rel="noreferrer" className="text-primary underline" dir="ltr">
                      {previewPost.link}
                    </a>
                  ) : (
                    "—"
                  ),
                },
                { label: "امتیاز", value: previewPost.score ?? "—" },
              ]
            : []
        }
        onEdit={
          previewPost
            ? () => {
                setPreviewPost(null);
                openEdit(previewPost);
              }
            : undefined
        }
      />

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => (nextOpen ? setOpen(true) : closeEditor())}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle>{editingId ? "ویرایش پست" : "پست جدید"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4 text-right">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>کانال</Label>
                <Select value={form.watch("platform")} onValueChange={(value) => form.setValue("platform", value as SocialPlatform)}>
                  <SelectTrigger>
                    <SelectValue>
                      <span className="flex items-center gap-2">
                        <SocialPlatformIcon
                          platform={form.watch("platform")}
                          size="sm"
                          className="h-5 w-5 rounded-md"
                        />
                        {getSocialPlatformLabel(form.watch("platform"))}
                      </span>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {platformOptions.map((platform) => (
                      <SelectItem key={platform} value={platform}>
                        <span className="flex items-center gap-2">
                          <SocialPlatformIcon platform={platform} size="sm" className="h-5 w-5 rounded-md" />
                          {getSocialPlatformLabel(platform)}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>نوع محتوا</Label>
                <Select value={form.watch("contentType")} onValueChange={(value) => form.setValue("contentType", value as SocialContentType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {contentTypeOptions.map((type) => (
                      <SelectItem key={type} value={type}>{getStatusLabel(type)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className={cn(highlightTitle && "text-destructive")}>عنوان / نام کاور</Label>
              <Input
                {...form.register("title")}
                maxLength={CONTENT_TITLE_MAX_LENGTH}
                className={cn(highlightTitle && "border-destructive focus-visible:ring-destructive")}
              />
              {highlightTitle && (
                <p className="text-xs text-destructive">عنوان خالی است؛ لطفاً تکمیل کنید.</p>
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
                contentType="social_post"
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

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="space-y-2"><Label>بازدید</Label><Input type="number" {...form.register("views")} /></div>
              <div className="space-y-2"><Label>لایک</Label><Input type="number" {...form.register("likes")} /></div>
              <div className="space-y-2"><Label>کامنت</Label><Input type="number" {...form.register("comments")} /></div>
              <div className="space-y-2"><Label>اشتراک</Label><Input type="number" {...form.register("shares")} /></div>
            </div>

            <div className="space-y-2">
              <Label className={cn(highlightLink && "text-destructive")}>لینک پست</Label>
              <div className="flex gap-2">
                <Input
                  {...form.register("link")}
                  dir="ltr"
                  className={cn(
                    "min-w-0 flex-1",
                    highlightLink && "border-destructive focus-visible:ring-destructive"
                  )}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending}
                  onClick={handleFetchFromLink}
                  title="خواندن اطلاعات از لینک (ایتا، آپارات یا صفحه وب)"
                  className="shrink-0 gap-1.5"
                >
                  <RefreshCw className={cn("h-4 w-4", isPending && "animate-spin")} />
                  از لینک
                </Button>
              </div>
              {highlightLink && (
                <p className="text-xs text-destructive">لینک پست خالی است؛ لطفاً تکمیل کنید.</p>
              )}
              <p className="text-xs text-muted-foreground">
                ایتا و آپارات: بازدید/آمار و محتوا. صفحات وب: عنوان، توضیح و کاور. بله/سروش/روبیکا دستی.
              </p>
            </div>

            <PersianDateField control={form.control} name="publishedDate" label="تاریخ انتشار" />

            <div
              className={cn(
                "space-y-3",
                highlightMedia && "rounded-lg border border-destructive bg-destructive/5 p-3"
              )}
            >
              <MediaUpload label="تصویر کاور" value={form.watch("coverImageUrl") ?? ""} onChange={(value) => form.setValue("coverImageUrl", value)} kind="image" />
              {form.watch("contentType") === "audio" ? (
                <MediaUpload
                  label="فایل صوتی"
                  value={form.watch("mediaUrl") ?? ""}
                  onChange={(value) => form.setValue("mediaUrl", value)}
                  kind="audio"
                  uploadKind="audio"
                  accept="audio/*"
                  fileOnly
                />
              ) : form.watch("contentType") === "video" || form.watch("contentType") === "reel" ? (
                <MediaUpload
                  label="رسانه (ویدیو)"
                  value={form.watch("mediaUrl") ?? ""}
                  onChange={(value) => form.setValue("mediaUrl", value)}
                  kind="video"
                  accept="video/*"
                  coverImageUrl={form.watch("coverImageUrl")}
                  onAutoCoverGenerated={(coverUrl) => {
                    const currentCover = form.getValues("coverImageUrl")?.trim() ?? "";
                    if (!currentCover) {
                      form.setValue("coverImageUrl", coverUrl);
                    }
                  }}
                />
              ) : (
                <MediaUpload
                  label="رسانه (تصویر/ویدیو)"
                  value={form.watch("mediaUrl") ?? ""}
                  onChange={(value) => form.setValue("mediaUrl", value)}
                  kind="image"
                />
              )}
              {highlightMedia && (
                <p className="text-xs text-destructive">کاور یا رسانه هنوز اضافه نشده است.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label className={cn(highlightDescription && "text-amber-700 dark:text-amber-300")}>توضیحات</Label>
              <Textarea
                {...form.register("description")}
                rows={4}
                placeholder="خلاصه پست، متن کپشن، نکات مهم یا توضیح محتوا"
                className={cn(
                  highlightDescription && "border-amber-500 focus-visible:ring-amber-500"
                )}
              />
              {highlightDescription && (
                <p className="text-xs text-amber-700 dark:text-amber-300">توضیحات خالی است؛ بهتر است تکمیل شود.</p>
              )}
            </div>



            <Button type="submit" disabled={isPending} className="w-full">ذخیره</Button>
            {editingId && (
              <Button
                type="button"
                variant="destructive"
                className="w-full"
                disabled={isPending}
                onClick={() => {
                  startTransition(async () => {
                    await deleteSocialPostAction(editingId);
                    setRows((prev) => prev.filter((row) => row.id !== editingId));
                    toast.success("حذف شد");
                    setOpen(false);
                  });
                }}
              >
                حذف پست
              </Button>
            )}
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
