"use client";

import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus } from "lucide-react";
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
import { ContentScoreControl } from "@/components/admin/content-score-control";
import { normalizePlanLabels, type ContentTopic } from "@/lib/content-topics";
import { MediaUpload } from "@/components/ui/media-upload";
import { PersianDateField } from "@/components/ui/persian-date-input";
import { deleteSocialPostAction, saveSocialPostAction } from "@/lib/actions/extended-actions";
import { useAdminViewMode } from "@/lib/hooks/use-admin-view-mode";
import { todayISO } from "@/lib/jalali";
import { isSitePublication } from "@/lib/social-posts";
import type { SocialContentType, SocialMediaPost, SocialPlatform } from "@/lib/types";
import { getStatusLabel } from "@/lib/utils";

const schema = z.object({
  platform: z.enum(["instagram", "x", "telegram", "linkedin", "youtube", "aparat", "rubika", "eitaa", "soroush", "bale", "other"]),
  title: z.string().min(1),
  coverImageUrl: z.string().optional(),
  views: z.coerce.number().min(0),
  likes: z.coerce.number().min(0),
  comments: z.coerce.number().min(0),
  shares: z.coerce.number().min(0),
  link: z.string().optional(),
  contentType: z.enum(["image", "text", "video", "carousel", "story", "reel"]),
  mediaUrl: z.string().optional(),
  description: z.string().optional(),
  publishedDate: z.string(),
  published: z.boolean(),
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

const contentTypeOptions: SocialContentType[] = ["image", "text", "video", "carousel", "story", "reel"];

interface SocialPostsAdminProps {
  campaignId: string;
  initialPosts: SocialMediaPost[];
  contentPlans?: string[];
  contentTopics?: ContentTopic[];
  canScore?: boolean;
  embedded?: boolean;
}

export function SocialPostsAdmin({
  campaignId,
  initialPosts,
  contentPlans = [],
  contentTopics = [],
  canScore = false,
  embedded = false,
}: SocialPostsAdminProps) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewPost, setPreviewPost] = useState<SocialMediaPost | null>(null);
  const [planLabels, setPlanLabels] = useState<string[]>([]);
  const [contentFilter, setContentFilter] = useState<AdminContentFilterState>(DEFAULT_ADMIN_CONTENT_FILTER);
  const { viewMode, setViewMode } = useAdminViewMode("social-posts");
  const [rows, setRows] = useState(initialPosts.filter((post) => !isSitePublication(post)));
  const [isPending, startTransition] = useTransition();

  const filterUsers = useMemo(() => collectAdminFilterUsers(rows), [rows]);
  const filteredRows = useMemo(
    () => rows.filter((item) => matchesAdminContentFilter(item, contentFilter)),
    [rows, contentFilter]
  );

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
      published: true,
    },
  });

  const openCreate = () => {
    setEditingId(null);
    setPlanLabels([]);
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
      published: true,
    });
    setOpen(true);
  };

  const openEdit = (post: SocialMediaPost) => {
    if (isSitePublication(post)) return;
    setEditingId(post.id);
    setPlanLabels(normalizePlanLabels(post.planLabels, post.planLabel));
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
      published: post.published,
    });
    setOpen(true);
  };

  const handleDelete = (post: SocialMediaPost) => {
    if (!window.confirm(`حذف «${post.title}»؟`)) return;
    startTransition(async () => {
      await deleteSocialPostAction(post.id);
      setRows((prev) => prev.filter((row) => row.id !== post.id));
      toast.success("حذف شد");
    });
  };

  const onSubmit = form.handleSubmit((data) => {
    startTransition(async () => {
      const result = await saveSocialPostAction({
        ...data,
        campaignId,
        id: editingId ?? undefined,
        published: true,
        planLabels,
        planLabel: planLabels[0] ?? null,
      });
      if (!result.success) {
        toast.error("ذخیره نشد");
        return;
      }

      const savedId = "id" in result ? result.id : (editingId ?? crypto.randomUUID());

      if (editingId) {
        setRows((prev) =>
          prev.map((row) =>
            row.id === editingId
              ? { ...row, ...data, campaignId, link: data.link ?? "", published: true, planLabels, planLabel: planLabels[0] ?? null } as SocialMediaPost
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
          } as SocialMediaPost,
        ]);
      }

      toast.success("ذخیره شد");
      setOpen(false);
    });
  });

  return (
    <div className="space-y-4">
      {!embedded && (
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">شبکه‌های اجتماعی</h1>
            <p className="text-sm text-muted-foreground">ثبت پست‌ها، بازدید، لینک و نوع محتوا</p>
          </div>
          <div className="flex items-center gap-2">
            <AdminViewModeToggle value={viewMode} onChange={setViewMode} />
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              افزودن پست
            </Button>
          </div>
        </div>
      )}

      {embedded && (
        <div className="flex items-center justify-end gap-2">
          <AdminViewModeToggle value={viewMode} onChange={setViewMode} />
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            افزودن پست
          </Button>
        </div>
      )}

      <AdminContentFilterBar
        filter={contentFilter}
        onChange={setContentFilter}
        users={filterUsers}
        plans={contentPlans}
      />

      {viewMode === "grid" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filteredRows.map((post) => (
            <AdminSocialPostCompactCard
              key={post.id}
              post={post}
              onClick={() => openEdit(post)}
              onView={() => setPreviewPost(post)}
              onEdit={() => openEdit(post)}
              onDelete={() => handleDelete(post)}
            />
          ))}
          <AdminCompactAddCard onClick={openCreate} label="پست جدید" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          {filteredRows.map((post) => (
            <div
              key={post.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 last:border-b-0"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{post.title}</p>
                <p className="text-xs text-muted-foreground">
                  {getStatusLabel(post.platform)} · {post.ownerName ?? "—"}
                </p>
              </div>
              <AdminItemActions
                onView={() => setPreviewPost(post)}
                onEdit={() => openEdit(post)}
                onDelete={() => handleDelete(post)}
              />
            </div>
          ))}
          {filteredRows.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">موردی یافت نشد.</div>
          )}
        </div>
      )}

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
        onEdit={
          previewPost
            ? () => {
                setPreviewPost(null);
                openEdit(previewPost);
              }
            : undefined
        }
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "ویرایش پست" : "پست جدید"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>کانال</Label>
                <Select value={form.watch("platform")} onValueChange={(value) => form.setValue("platform", value as SocialPlatform)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {platformOptions.map((platform) => (
                      <SelectItem key={platform} value={platform}>{getStatusLabel(platform)}</SelectItem>
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
              <Label>عنوان / نام کاور</Label>
              <Input {...form.register("title")} />
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

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="space-y-2"><Label>بازدید</Label><Input type="number" {...form.register("views")} /></div>
              <div className="space-y-2"><Label>لایک</Label><Input type="number" {...form.register("likes")} /></div>
              <div className="space-y-2"><Label>کامنت</Label><Input type="number" {...form.register("comments")} /></div>
              <div className="space-y-2"><Label>اشتراک</Label><Input type="number" {...form.register("shares")} /></div>
            </div>

            <div className="space-y-2">
              <Label>لینک پست</Label>
              <Input {...form.register("link")} dir="ltr" />
            </div>

            <PersianDateField control={form.control} name="publishedDate" label="تاریخ انتشار" />

            <MediaUpload label="تصویر کاور" value={form.watch("coverImageUrl") ?? ""} onChange={(value) => form.setValue("coverImageUrl", value)} kind="image" />
            <MediaUpload label="رسانه (ویدیو/تصویر)" value={form.watch("mediaUrl") ?? ""} onChange={(value) => form.setValue("mediaUrl", value)} />

            <div className="space-y-2">
              <Label>توضیحات</Label>
              <Textarea
                {...form.register("description")}
                rows={4}
                placeholder="خلاصه پست، متن کپشن، نکات مهم یا توضیح محتوا"
              />
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
