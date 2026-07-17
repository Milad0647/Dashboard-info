"use client";

import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  CONTENT_TITLE_MAX_LENGTH,
  CONTENT_TITLE_MAX_LENGTH_MESSAGE,
} from "@/lib/content-constraints";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AdminContentFilterBar,
  collectAdminFilterUsers,
  DEFAULT_ADMIN_CONTENT_FILTER,
  matchesAdminContentFilter,
  type AdminContentFilterState,
} from "@/components/admin/admin-content-filter-bar";
import { AdminCompactAddCard } from "@/components/admin/admin-compact-add-card";
import { AdminContentPreviewDialog } from "@/components/admin/admin-content-preview-dialog";
import { AdminSitePublicationCompactCard } from "@/components/admin/admin-site-publication-compact-card";
import { PlanLabelSelect } from "@/components/admin/plan-label-select";
import { ContentScoreControl } from "@/components/admin/content-score-control";
import {
  BulkItemShell,
  SectionBulkEditBar,
  useSectionBulkEdit,
} from "@/components/admin/section-bulk-edit";
import { MediaUpload } from "@/components/ui/media-upload";
import { PersianDateField } from "@/components/ui/persian-date-input";
import { deleteSocialPostAction, saveSocialPostAction } from "@/lib/actions/extended-actions";
import { normalizePlanLabels, type ContentTopic } from "@/lib/content-topics";
import { useAdminInfiniteScroll } from "@/lib/hooks/use-admin-infinite-scroll";
import { AdminInfiniteScrollSentinel } from "@/components/admin/admin-infinite-scroll-sentinel";
import { todayISO } from "@/lib/jalali";
import { isSitePublication } from "@/lib/social-posts";
import type { AdminUser, SocialMediaPost } from "@/lib/types";
import { formatPersianDate } from "@/lib/utils";

const schema = z.object({
  title: z
    .string()
    .min(1, "عنوان الزامی است")
    .max(CONTENT_TITLE_MAX_LENGTH, CONTENT_TITLE_MAX_LENGTH_MESSAGE),
  link: z.string().url("لینک معتبر وارد کنید"),
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
  users?: AdminUser[];
}

export function SitePublicationsAdmin({
  campaignId,
  initialPosts,
  contentPlans = [],
  contentTopics = [],
  canScore = false,
  isFullAdmin = false,
  users = [],
}: SitePublicationsAdminProps) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [planLabels, setPlanLabels] = useState<string[]>([]);
  const [contentFilter, setContentFilter] = useState<AdminContentFilterState>(DEFAULT_ADMIN_CONTENT_FILTER);
  const [rows, setRows] = useState(initialPosts.filter(isSitePublication));
  const [previewPost, setPreviewPost] = useState<SocialMediaPost | null>(null);
  const [isPending, startTransition] = useTransition();

  const filterUsers = useMemo(() => collectAdminFilterUsers(rows), [rows]);
  const filteredRows = useMemo(
    () => rows.filter((item) => matchesAdminContentFilter(item, contentFilter)),
    [rows, contentFilter]
  );
  const paginationResetKey = `${contentFilter.userKey}:${contentFilter.planLabels.join(",")}`;
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
      link: "",
      coverImageUrl: "",
      description: "",
      publishedDate: todayISO(),
    },
  });

  const openCreate = () => {
    setEditingId(null);
    setPlanLabels([]);
    form.reset({
      title: "",
      link: "",
      coverImageUrl: "",
      description: "",
      publishedDate: todayISO(),
    });
    setOpen(true);
  };

  const openEdit = (post: SocialMediaPost) => {
    setEditingId(post.id);
    setPlanLabels(normalizePlanLabels(post.planLabels, post.planLabel));
    form.reset({
      title: post.title,
      link: post.link,
      coverImageUrl: post.coverImageUrl ?? "",
      description: post.description ?? "",
      publishedDate: post.publishedDate,
    });
    setOpen(true);
  };

  const handleDelete = (post: SocialMediaPost) => {
    startTransition(async () => {
      await deleteSocialPostAction(post.id);
      setRows((prev) => prev.filter((row) => row.id !== post.id));
      toast.success("حذف شد");
      setOpen(false);
      setPreviewPost(null);
    });
  };

  const onSubmit = form.handleSubmit((data) => {
    startTransition(async () => {
      const result = await saveSocialPostAction({
        campaignId,
        id: editingId ?? undefined,
        platform: "site",
        contentType: "text",
        title: data.title,
        link: data.link,
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
        link: data.link,
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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setRows((prev) =>
        editingId ? prev.map((row) => (row.id === editingId ? { ...row, ...nextPost } : row)) : [...prev, nextPost]
      );
      toast.success("ذخیره شد");
      setOpen(false);
    });
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">انتشار در سایت</h1>
          <p className="text-sm text-muted-foreground">
            ثبت مطالب منتشرشده در سایت با عنوان لینک‌دار، تاریخ و توضیح
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          انتشار جدید
        </Button>
      </div>

      <AdminContentFilterBar
        filter={contentFilter}
        onChange={setContentFilter}
        users={isFullAdmin ? filterUsers : []}
        plans={contentPlans}
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
              onClick={() => openEdit(post)}
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
              {previewPost.link ? (
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
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "ویرایش انتشار" : "انتشار جدید در سایت"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>عنوان (به‌صورت لینک نمایش داده می‌شود)</Label>
              <Input
                {...form.register("title")}
                maxLength={CONTENT_TITLE_MAX_LENGTH}
                placeholder="عنوان مطلب در سایت"
              />
            </div>
            <div className="space-y-2">
              <Label>لینک مطلب</Label>
              <Input {...form.register("link")} dir="ltr" placeholder="https://example.com/article" />
            </div>
            <PersianDateField control={form.control} name="publishedDate" label="تاریخ انتشار" />
            <PlanLabelSelect
              topics={contentTopics}
              plans={contentPlans}
              values={planLabels}
              onChangeMultiple={setPlanLabels}
            />
            {editingId && (
              <ContentScoreControl
                campaignId={campaignId}
                contentType="site_publication"
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
            <div className="space-y-2">
              <Label>تصویر شاخص (اختیاری)</Label>
              <MediaUpload
                value={form.watch("coverImageUrl") ?? ""}
                onChange={(url) => form.setValue("coverImageUrl", url)}
                accept="image/*"
              />
            </div>
            <div className="space-y-2">
              <Label>توضیح (اختیاری)</Label>
              <Textarea {...form.register("description")} rows={3} placeholder="خلاصه یا یادداشت درباره این انتشار" />
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
