"use client";

import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  CONTENT_TITLE_MAX_LENGTH,
  CONTENT_TITLE_MAX_LENGTH_MESSAGE,
} from "@/lib/content-constraints";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  AdminContentFilterBar,
  adminContentFilterResetKey,
  buildAdminFilterSources,
  DEFAULT_ADMIN_CONTENT_FILTER,
  matchesAdminContentFilter,
  sortAdminContentItems,
  type AdminContentFilterState,
} from "@/components/admin/admin-content-filter-bar";
import { AdminCompactAddCard } from "@/components/admin/admin-compact-add-card";
import { adminCreatedAtDetail } from "@/components/admin/admin-created-at";
import { AdminContentPreviewDialog } from "@/components/admin/admin-content-preview-dialog";
import { AdminSitePublicationCompactCard } from "@/components/admin/admin-site-publication-compact-card";
import { PlanLabelSelect } from "@/components/admin/plan-label-select";
import { ContentOwnerSelect } from "@/components/admin/content-owner-select";
import { ContentScoreControl } from "@/components/admin/content-score-control";
import {
  BulkItemShell,
  SectionBulkEditBar,
  useSectionBulkEdit,
} from "@/components/admin/section-bulk-edit";
import { MediaUpload } from "@/components/ui/media-upload";
import { PersianDateField } from "@/components/ui/persian-date-input";
import { deleteSocialPostAction, fetchSocialLinkMetricsAction, saveSocialPostAction } from "@/lib/actions/extended-actions";
import { RefreshCw, Trash2 } from "lucide-react";
import { normalizePlanLabels, type ContentTopic } from "@/lib/content-topics";
import { type EditSuggestionMissingField } from "@/lib/edit-suggestions";
import { useAdminEditDeepLink } from "@/lib/hooks/use-admin-edit-deep-link";
import { useSectionCreateGate } from "@/lib/hooks/use-section-create-gate";
import { useAdminInfiniteScroll } from "@/lib/hooks/use-admin-infinite-scroll";
import { AdminInfiniteScrollSentinel } from "@/components/admin/admin-infinite-scroll-sentinel";
import { todayISO } from "@/lib/jalali";
import {
  createEmptySocialPostLinkEntry,
  isGroupSocialPost,
  isSitePublication,
  MAX_SOCIAL_POST_LINK_ENTRIES,
  normalizeSocialPostLinkEntries,
} from "@/lib/social-posts";
import type { AdminUser, SocialMediaPost, SocialPostLinkEntry } from "@/lib/types";
import { cn, ensureHttpUrl, formatPersianDate, formatPersianNumber, isValidHttpUrl } from "@/lib/utils";

const schema = z.object({
  title: z
    .string()
    .min(1, "عنوان الزامی است")
    .max(CONTENT_TITLE_MAX_LENGTH, CONTENT_TITLE_MAX_LENGTH_MESSAGE),
  link: z.string().optional(),
  coverImageUrl: z.string().optional(),
  description: z.string().optional(),
  publishedDate: z.string(),
});

interface SitePublicationsAdminProps {
  campaignId: string;
  initialPosts: SocialMediaPost[];
  contentPlans?: string[];
  contentTopics?: ContentTopic[];
  canScore?: boolean;
  isFullAdmin?: boolean;
  canTransferOwnership?: boolean;
  users?: AdminUser[];
}

export function SitePublicationsAdmin({
  campaignId,
  initialPosts,
  contentPlans = [],
  contentTopics = [],
  canScore = false,
  isFullAdmin = false,
  canTransferOwnership = false,
  users = [],
}: SitePublicationsAdminProps) {
  const { requestCreate, tutorialModal } = useSectionCreateGate("sitePublications");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [planLabels, setPlanLabels] = useState<string[]>([]);
  const [editOwnerUserId, setEditOwnerUserId] = useState<string | null>(null);
  const [isGroupDistribution, setIsGroupDistribution] = useState(false);
  const [linkEntries, setLinkEntries] = useState<SocialPostLinkEntry[]>([
    createEmptySocialPostLinkEntry(),
  ]);
  const [contentFilter, setContentFilter] = useState<AdminContentFilterState>(DEFAULT_ADMIN_CONTENT_FILTER);
  const [rows, setRows] = useState(initialPosts.filter(isSitePublication));
  const [previewPost, setPreviewPost] = useState<SocialMediaPost | null>(null);
  const [isPending, startTransition] = useTransition();

  const { users: filterUsers, locations: filterLocations } = useMemo(
    () => buildAdminFilterSources(rows, users, canTransferOwnership || isFullAdmin),
    [rows, users, canTransferOwnership, isFullAdmin]
  );
  const filteredRows = useMemo(
    () =>
      sortAdminContentItems(
        rows.filter((item) => matchesAdminContentFilter(item, contentFilter)),
        contentFilter.sortOrder,
        (item) => item.publishedDate || item.updatedAt || item.createdAt
      ),
    [rows, contentFilter]
  );
  const paginationResetKey = adminContentFilterResetKey(contentFilter);
  const { visibleCount, hasMore, isLoadingMore, loadMore } = useAdminInfiniteScroll(
    filteredRows.length,
    paginationResetKey
  );
  const visibleRows = useMemo(
    () => filteredRows.slice(0, visibleCount),
    [filteredRows, visibleCount]
  );
  const visibleIds = useMemo(() => visibleRows.map((item) => item.id), [visibleRows]);
  const filteredIds = useMemo(() => filteredRows.map((item) => item.id), [filteredRows]);
  const bulk = useSectionBulkEdit(visibleIds, filteredIds);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      link: "",
      coverImageUrl: "",
      description: "",
      publishedDate: todayISO(),
    },
  });

  const loadPostIntoForm = (
    post: SocialMediaPost,
    fields: EditSuggestionMissingField[],
    setFields: (fields: EditSuggestionMissingField[]) => void
  ) => {
    setEditingId(post.id);
    setPlanLabels(normalizePlanLabels(post.planLabels, post.planLabel));
    setEditOwnerUserId(post.ownerUserId ?? null);
    const groupEntries = normalizeSocialPostLinkEntries(post.linkEntries);
    const groupMode = groupEntries.length > 0;
    setIsGroupDistribution(groupMode);
    setLinkEntries(
      groupMode
        ? groupEntries
        : [
            {
              id: crypto.randomUUID(),
              link: post.link ?? "",
              views: 0,
            },
          ]
    );
    form.reset({
      title: post.title,
      link: post.link,
      coverImageUrl: post.coverImageUrl ?? "",
      description: post.description ?? "",
      publishedDate: post.publishedDate,
    });
    setFields(fields);
    setOpen(true);
  };

  const { highlightFields, setHighlightFields, resetDeepLink } = useAdminEditDeepLink({
    items: rows,
    getId: (row) => row.id,
    basePath: "/admin/site-publications",
    onOpen: (post, fields) => {
      loadPostIntoForm(post, fields, setHighlightFields);
    },
  });

  const watchedTitle = form.watch("title");
  const watchedLink = form.watch("link");
  const watchedCover = form.watch("coverImageUrl");
  const watchedDescription = form.watch("description");
  const filledLinkEntries = useMemo(
    () => normalizeSocialPostLinkEntries(linkEntries),
    [linkEntries]
  );
  const highlightTitle = highlightFields.includes("title") && !watchedTitle?.trim();
  const highlightLink =
    highlightFields.includes("link") &&
    (isGroupDistribution ? filledLinkEntries.length === 0 : !watchedLink?.trim());
  const highlightMedia = highlightFields.includes("media") && !watchedCover?.trim();
  const highlightDescription =
    highlightFields.includes("description") && !watchedDescription?.trim();
  const highlightPlanLabels = highlightFields.includes("planLabels") && planLabels.length === 0;

  const updateLinkEntry = (id: string, patch: Partial<Pick<SocialPostLinkEntry, "link">>) => {
    setLinkEntries((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry))
    );
  };

  const addLinkEntry = () => {
    if (linkEntries.length >= MAX_SOCIAL_POST_LINK_ENTRIES) {
      toast.error(`حداکثر ${formatPersianNumber(MAX_SOCIAL_POST_LINK_ENTRIES)} لینک مجاز است`);
      return;
    }
    setLinkEntries((prev) => [...prev, createEmptySocialPostLinkEntry()]);
  };

  const removeLinkEntry = (id: string) => {
    setLinkEntries((prev) => {
      if (prev.length <= 1) return [createEmptySocialPostLinkEntry()];
      return prev.filter((entry) => entry.id !== id);
    });
  };

  const toggleGroupDistribution = (enabled: boolean) => {
    if (enabled) {
      const currentLink = form.getValues("link")?.trim() ?? "";
      setLinkEntries([
        {
          id: crypto.randomUUID(),
          link: currentLink,
          views: 0,
        },
      ]);
      setIsGroupDistribution(true);
      return;
    }

    const first = linkEntries[0];
    form.setValue("link", first?.link ?? "");
    setIsGroupDistribution(false);
  };

  const openCreate = () => {
    void requestCreate(() => {
      setEditingId(null);
      setPlanLabels([]);
      setEditOwnerUserId(null);
      setIsGroupDistribution(false);
      setLinkEntries([createEmptySocialPostLinkEntry()]);
      setHighlightFields([]);
      form.reset({
        title: "",
        link: "",
        coverImageUrl: "",
        description: "",
        publishedDate: todayISO(),
      });
      setOpen(true);
    });
  };

  const openEdit = (post: SocialMediaPost, fields: EditSuggestionMissingField[] = []) => {
    loadPostIntoForm(post, fields, setHighlightFields);
  };

  const closeDialog = () => {
    setOpen(false);
    setEditingId(null);
    setPlanLabels([]);
    setEditOwnerUserId(null);
    setIsGroupDistribution(false);
    setLinkEntries([createEmptySocialPostLinkEntry()]);
    resetDeepLink();
  };

  const handleDelete = (post: SocialMediaPost) => {
    startTransition(async () => {
      await deleteSocialPostAction(post.id);
      setRows((prev) => prev.filter((row) => row.id !== post.id));
      toast.success("حذف شد");
      closeDialog();
      setPreviewPost(null);
    });
  };

  const handleFetchFromLink = () => {
    const rawLink = isGroupDistribution
      ? (linkEntries.find((entry) => entry.link.trim())?.link.trim() ?? "")
      : (form.getValues("link")?.trim() ?? "");
    const link = ensureHttpUrl(rawLink);
    if (!link) {
      toast.error("ابتدا لینک مطلب را وارد کنید");
      return;
    }
    if (!isGroupDistribution && link !== rawLink) {
      form.setValue("link", link);
    }
    if (isGroupDistribution && link !== rawLink) {
      const entry = linkEntries.find((item) => item.link.trim());
      if (entry) updateLinkEntry(entry.id, { link });
    }

    startTransition(async () => {
      const result = await fetchSocialLinkMetricsAction({ url: link, platform: "site" });
      if (!result.success) {
        toast.error(result.error);
        return;
      }

      const currentTitle = form.getValues("title")?.trim() ?? "";
      if (!currentTitle && result.title?.trim()) {
        form.setValue("title", result.title.trim());
      }

      const currentCover = form.getValues("coverImageUrl")?.trim() ?? "";
      if (!currentCover && result.coverImageUrl?.trim()) {
        form.setValue("coverImageUrl", result.coverImageUrl.trim());
      }

      if (result.publishedDate) {
        const currentDate = form.getValues("publishedDate")?.trim() ?? "";
        if (!currentDate || currentDate === todayISO()) {
          form.setValue("publishedDate", result.publishedDate);
        }
      }

      toast.success("اطلاعات صفحه از لینک خوانده شد");
    });
  };

  const onSubmit = form.handleSubmit((data) => {
    startTransition(async () => {
      const existing = editingId ? rows.find((row) => row.id === editingId) : undefined;
      const selectedOwner = canTransferOwnership
        ? users.find((user) => user.id === editOwnerUserId)
        : null;

      const normalizedEntries = isGroupDistribution
        ? normalizeSocialPostLinkEntries(linkEntries)
        : [];

      if (isGroupDistribution && normalizedEntries.length === 0) {
        toast.error("حداقل یک لینک برای پخش گروهی وارد کنید");
        return;
      }

      const invalidGroupLink = normalizedEntries.find((entry) => !isValidHttpUrl(entry.link));
      if (invalidGroupLink) {
        toast.error("همه لینک‌های گروهی باید معتبر باشند");
        return;
      }

      const resolvedLink = isGroupDistribution
        ? (normalizedEntries[0]?.link ?? "")
        : ensureHttpUrl(data.link?.trim() ?? "");

      if (!isGroupDistribution) {
        if (!resolvedLink || !isValidHttpUrl(resolvedLink)) {
          toast.error("لینک معتبر وارد کنید");
          return;
        }
        if (resolvedLink !== (data.link?.trim() ?? "")) {
          form.setValue("link", resolvedLink);
        }
      }

      const result = await saveSocialPostAction({
        campaignId,
        id: editingId ?? undefined,
        platform: "site",
        contentType: "text",
        title: data.title,
        link: resolvedLink,
        linkEntries: normalizedEntries,
        coverImageUrl: data.coverImageUrl || null,
        description: data.description || null,
        publishedDate: data.publishedDate,
        published: true,
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
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
      const nextPost: SocialMediaPost = {
        id: savedId,
        campaignId,
        platform: "site",
        title: data.title,
        link: resolvedLink,
        linkEntries: normalizedEntries.length > 0 ? normalizedEntries : undefined,
        coverImageUrl: data.coverImageUrl || null,
        description: data.description || null,
        publishedDate: data.publishedDate,
        published: true,
        contentType: "text",
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
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
          ? prev.map((row) =>
              row.id === editingId
                ? {
                    ...row,
                    ...nextPost,
                    linkEntries: normalizedEntries.length > 0 ? normalizedEntries : undefined,
                  }
                : row
            )
          : [...prev, nextPost]
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
          <h1 className="text-2xl font-bold">انتشار در سایت</h1>
          <p className="text-sm text-muted-foreground">
            ثبت مطالب منتشرشده در سایت با عنوان لینک‌دار، تاریخ و توضیح
          </p>
        </div>
      </div>

      <AdminContentFilterBar
        filter={contentFilter}
        onChange={setContentFilter}
        users={canTransferOwnership || isFullAdmin ? filterUsers : []}
        plans={contentPlans}
        locations={filterLocations}
      />

      <SectionBulkEditBar
        campaignId={campaignId}
        contentType="site_publication"
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {!bulk.bulkMode && <AdminCompactAddCard onClick={openCreate} label="انتشار جدید" />}
        {visibleRows.map((post) => (
          <BulkItemShell
            key={post.id}
            enabled={bulk.bulkMode}
            selected={bulk.isSelected(post.id)}
            onToggle={() => bulk.toggle(post.id)}
          >
            <AdminSitePublicationCompactCard
              post={post}
              onClick={() => (bulk.bulkMode ? setPreviewPost(post) : openEdit(post))}
              onView={() => setPreviewPost(post)}
              onEdit={() => openEdit(post)}
              onDelete={() => handleDelete(post)}
            />
          </BulkItemShell>
        ))}
      </div>

      <AdminInfiniteScrollSentinel
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        onLoadMore={loadMore}
        remaining={filteredRows.length - visibleCount}
      />

      <AdminContentPreviewDialog
        open={Boolean(previewPost)}
        onOpenChange={(nextOpen) => !nextOpen && setPreviewPost(null)}
        title={previewPost?.title ?? "نمایش انتشار"}
        description={previewPost?.description}
        imageUrl={previewPost?.coverImageUrl}
        meta={
          previewPost ? (
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>{formatPersianDate(previewPost.publishedDate)}</p>
              {isGroupSocialPost(previewPost) ? (
                <div className="space-y-1" dir="ltr">
                  {(previewPost.linkEntries ?? []).slice(0, 8).map((entry) => (
                    <a
                      key={entry.id}
                      href={entry.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block break-all text-primary underline"
                    >
                      {entry.link}
                    </a>
                  ))}
                  {(previewPost.linkEntries?.length ?? 0) > 8 ? (
                    <p className="text-muted-foreground" dir="rtl">
                      و {formatPersianNumber((previewPost.linkEntries?.length ?? 0) - 8)} لینک دیگر…
                    </p>
                  ) : null}
                </div>
              ) : previewPost.link ? (
                <a
                  href={previewPost.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all text-primary underline"
                  dir="ltr"
                >
                  {previewPost.link}
                </a>
              ) : null}
            </div>
          ) : null
        }
        details={
          previewPost
            ? [
                adminCreatedAtDetail(previewPost.createdAt),
                {
                  label: "برچسب‌ها",
                  value: previewPost.planLabels?.length ? previewPost.planLabels.join("، ") : "—",
                },
                {
                  label: "پخش گروهی",
                  value: isGroupSocialPost(previewPost)
                    ? `${formatPersianNumber(previewPost.linkEntries?.length ?? 0)} لینک`
                    : "—",
                },
                ...(canScore
                  ? [{ label: "امتیاز", value: previewPost.score ?? "—" }]
                  : []),
                { label: "مالک", value: previewPost.ownerName ?? "—" },
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
        onDelete={previewPost ? () => handleDelete(previewPost) : undefined}
        deleteLabel="این انتشار"
        canSendMessage={canTransferOwnership || isFullAdmin}
        messageTarget={
          previewPost
            ? {
                campaignId,
                contentType: "site_publication",
                contentId: previewPost.id,
                contentTitle: previewPost.title,
                ownerName: previewPost.ownerName,
              }
            : null
        }
      />

      <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? setOpen(true) : closeDialog())}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "ویرایش انتشار" : "انتشار جدید در سایت"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className={cn(highlightTitle && "text-destructive")}>
                عنوان (به‌صورت لینک نمایش داده می‌شود)
              </Label>
              <Input
                {...form.register("title")}
                maxLength={CONTENT_TITLE_MAX_LENGTH}
                placeholder="عنوان مطلب در سایت"
                className={cn(highlightTitle && "border-destructive focus-visible:ring-destructive")}
              />
              {highlightTitle && (
                <p className="text-xs text-destructive">عنوان خالی است؛ لطفاً تکمیل کنید.</p>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div className="space-y-1 text-right">
                <Label htmlFor="site-group-distribution">پخش گروهی</Label>
                <p className="text-xs text-muted-foreground">
                  اگر یک مطلب را در چند لینک منتشر کرده‌اید، همه لینک‌ها را اینجا وارد کنید.
                </p>
              </div>
              <Switch
                id="site-group-distribution"
                checked={isGroupDistribution}
                onCheckedChange={toggleGroupDistribution}
              />
            </div>

            {isGroupDistribution ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label className={cn(highlightLink && "text-destructive")}>
                    لینک‌ها ({formatPersianNumber(filledLinkEntries.length)} لینک)
                  </Label>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {formatPersianNumber(filledLinkEntries.length)} لینک
                    </Badge>
                    <Button type="button" variant="outline" size="sm" onClick={addLinkEntry}>
                      + افزودن لینک
                    </Button>
                  </div>
                </div>
                <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border p-2">
                  {linkEntries.map((entry, index) => (
                    <div
                      key={entry.id}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 rounded-md border bg-muted/30 p-2"
                    >
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">لینک {index + 1}</Label>
                        <Input
                          dir="ltr"
                          value={entry.link}
                          placeholder="https://..."
                          className={cn(
                            highlightLink &&
                              !entry.link.trim() &&
                              "border-destructive focus-visible:ring-destructive"
                          )}
                          onChange={(event) =>
                            updateLinkEntry(entry.id, { link: event.target.value })
                          }
                          onBlur={() => {
                            const normalized = ensureHttpUrl(entry.link);
                            if (normalized && normalized !== entry.link) {
                              updateLinkEntry(entry.id, { link: normalized });
                            }
                          }}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="mb-0.5"
                        onClick={() => removeLinkEntry(entry.id)}
                        title="حذف"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
                {highlightLink && (
                  <p className="text-xs text-destructive">حداقل یک لینک وارد کنید.</p>
                )}
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending}
                  onClick={handleFetchFromLink}
                  title="خواندن عنوان، توضیح و کاور از اولین لینک"
                  className="w-full gap-1.5"
                >
                  <RefreshCw className={cn("h-4 w-4", isPending && "animate-spin")} />
                  خواندن اطلاعات از اولین لینک
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Label className={cn(highlightLink && "text-destructive")}>لینک مطلب</Label>
                <div className="flex gap-2">
                  <Input
                    {...form.register("link")}
                    dir="ltr"
                    placeholder="https://example.com/article"
                    className={cn(
                      "min-w-0 flex-1",
                      highlightLink && "border-destructive focus-visible:ring-destructive"
                    )}
                    onBlur={(event) => {
                      const normalized = ensureHttpUrl(event.target.value);
                      if (normalized && normalized !== event.target.value) {
                        form.setValue("link", normalized);
                      }
                    }}
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
                {highlightLink && (
                  <p className="text-xs text-destructive">لینک مطلب خالی است؛ لطفاً تکمیل کنید.</p>
                )}
                <p className="text-xs text-muted-foreground">
                  عنوان، توضیح و تصویر شاخص صفحه را در صورت خالی بودن پر می‌کند.
                </p>
              </div>
            )}

            <PersianDateField control={form.control} name="publishedDate" label="تاریخ انتشار" />
            <PlanLabelSelect
              topics={contentTopics}
              plans={contentPlans}
              values={planLabels}
              onChangeMultiple={setPlanLabels}
              highlight={highlightPlanLabels}
              errorText="موضوع انتخاب نشده است؛ لطفاً تکمیل کنید."
            />
            {editingId && (
              <ContentScoreControl
                campaignId={campaignId}
                contentType="site_publication"
                contentId={editingId}
                score={rows.find((row) => row.id === editingId)?.score}
                autoScore={rows.find((row) => row.id === editingId)?.autoScore}
                manualScore={rows.find((row) => row.id === editingId)?.manualScore}
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
                "space-y-2",
                highlightMedia && "rounded-lg border border-destructive bg-destructive/5 p-3"
              )}
            >
              <Label>تصویر شاخص (اختیاری)</Label>
              <MediaUpload
                value={form.watch("coverImageUrl") ?? ""}
                onChange={(url) => form.setValue("coverImageUrl", url)}
                accept="image/*"
              />
              {highlightMedia && (
                <p className="text-xs text-destructive">تصویر شاخص هنوز اضافه نشده است.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label className={cn(highlightDescription && "text-amber-700 dark:text-amber-300")}>توضیح (اختیاری)</Label>
              <Textarea
                {...form.register("description")}
                rows={3}
                placeholder="خلاصه یا یادداشت درباره این انتشار"
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
                  const current = rows.find((row) => row.id === editingId);
                  if (current) handleDelete(current);
                }}
              >
                حذف انتشار
              </Button>
            )}
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
