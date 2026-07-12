"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AdminPosterAddCard, AdminPosterCompactCard } from "@/components/admin/admin-poster-compact-card";
import { AdminPosterEditor } from "@/components/admin/admin-poster-editor";
import { AdminItemActions } from "@/components/admin/admin-item-actions";
import { AdminViewModeToggle } from "@/components/admin/admin-view-mode-toggle";
import {
  AdminContentFilterBar,
  collectAdminFilterUsers,
  DEFAULT_ADMIN_CONTENT_FILTER,
  matchesAdminContentFilter,
  type AdminContentFilterState,
} from "@/components/admin/admin-content-filter-bar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ImageZoom } from "@/components/ui/image-zoom";
import { deletePosterAction } from "@/lib/actions/admin-actions";
import type { ContentTopic } from "@/lib/content-topics";
import { useAdminViewMode } from "@/lib/hooks/use-admin-view-mode";
import { resolveDisplayVersion } from "@/lib/media-utils";
import type { MediaCategory, Poster, PosterVersion } from "@/lib/types";

interface PostersAdminProps {
  campaignId: string;
  initialCategories: MediaCategory[];
  initialPosters: Poster[];
  initialVersions: PosterVersion[];
  contentPlans?: string[];
  contentTopics?: ContentTopic[];
  canScore?: boolean;
}

const editorDialogClass =
  "!flex min-h-0 max-h-[92vh] max-w-2xl flex-col gap-0 overflow-hidden p-0";

export function PostersAdmin({
  campaignId,
  initialCategories,
  initialPosters,
  initialVersions,
  contentPlans = [],
  contentTopics = [],
  canScore = false,
}: PostersAdminProps) {
  const router = useRouter();
  const [posters, setPosters] = useState(initialPosters);
  const [versions, setVersions] = useState(initialVersions);
  const [editorOpen, setEditorOpen] = useState(false);
  const [activePosterId, setActivePosterId] = useState<string | null>(null);
  const [draftPoster, setDraftPoster] = useState<Poster | null>(null);
  const [previewPoster, setPreviewPoster] = useState<Poster | null>(null);
  const [contentFilter, setContentFilter] = useState<AdminContentFilterState>(DEFAULT_ADMIN_CONTENT_FILTER);
  const { viewMode, setViewMode } = useAdminViewMode("posters");
  const [, startTransition] = useTransition();

  useEffect(() => {
    setPosters(initialPosters);
    setVersions(initialVersions);
  }, [initialPosters, initialVersions]);

  const versionsByPosterId = useMemo(() => {
    const map = new Map<string, PosterVersion[]>();
    for (const version of versions) {
      const list = map.get(version.posterId) ?? [];
      list.push(version);
      map.set(version.posterId, list);
    }
    return map;
  }, [versions]);

  const filterUsers = useMemo(() => collectAdminFilterUsers(posters), [posters]);
  const filteredPosters = useMemo(
    () => posters.filter((item) => matchesAdminContentFilter(item, contentFilter)),
    [posters, contentFilter]
  );

  const activePoster = useMemo(() => {
    if (!activePosterId) return null;
    if (draftPoster?.id === activePosterId) return draftPoster;
    return posters.find((poster) => poster.id === activePosterId) ?? null;
  }, [activePosterId, draftPoster, posters]);

  const isDraftPoster = Boolean(draftPoster && activePosterId === draftPoster.id);
  const activeVersions = activePosterId ? versionsByPosterId.get(activePosterId) ?? [] : [];
  const refresh = () => router.refresh();

  const openEditor = (posterId: string) => {
    setActivePosterId(posterId);
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setActivePosterId(null);
    setDraftPoster(null);
  };

  const handleCreatePoster = () => {
    const posterId = crypto.randomUUID();
    const categoryId = initialCategories[0]?.id ?? "";
    const now = new Date().toISOString();
    const newPoster: Poster = {
      id: posterId,
      campaignId,
      categoryId,
      title: `پوستر ${posters.length + 1}`,
      description: "",
      published: false,
      sortOrder: posters.length + 1,
      planLabel: null,
      createdAt: now,
      updatedAt: now,
    };

    setDraftPoster(newPoster);
    openEditor(posterId);
  };

  const handleDelete = (poster: Poster) => {
    if (!window.confirm(`حذف «${poster.title}»؟`)) return;
    startTransition(async () => {
      await deletePosterAction(poster.id);
      setPosters((prev) => prev.filter((item) => item.id !== poster.id));
      toast.success("حذف شد");
      refresh();
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">پوسترها</h1>
          <p className="text-sm text-muted-foreground">
            نمای فشرده — روی کارت کلیک کنید یا با + پوستر جدید بسازید
          </p>
        </div>
        <AdminViewModeToggle value={viewMode} onChange={setViewMode} />
      </div>

      <AdminContentFilterBar
        filter={contentFilter}
        onChange={setContentFilter}
        users={filterUsers}
        plans={contentPlans}
      />

      {filteredPosters.length === 0 && posters.length === 0 ? (
        <div className="rounded-xl border px-4 py-8 text-center text-sm text-muted-foreground">
          هنوز پوستری ثبت نشده است.
          <div className="mt-3 flex justify-center">
            <AdminPosterAddCard compact onClick={handleCreatePoster} />
          </div>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          <AdminPosterAddCard onClick={handleCreatePoster} />
          {filteredPosters.map((poster) => (
            <AdminPosterCompactCard
              key={poster.id}
              poster={poster}
              versions={versionsByPosterId.get(poster.id) ?? []}
              onClick={() => openEditor(poster.id)}
              onView={() => setPreviewPoster(poster)}
              onEdit={() => openEditor(poster.id)}
              onDelete={() => handleDelete(poster)}
              canScore={canScore}
              onScoreSaved={(score) => {
                setPosters((prev) =>
                  prev.map((item) => (item.id === poster.id ? { ...item, score } : item))
                );
              }}
            />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          {filteredPosters.map((poster) => {
            const displayVersion = resolveDisplayVersion(versionsByPosterId.get(poster.id) ?? []);
            return (
              <div
                key={poster.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{poster.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {poster.ownerName ?? "—"}
                    {displayVersion ? ` · نسخه ${displayVersion.versionNumber}` : " · بدون تصویر"}
                  </p>
                </div>
                <AdminItemActions
                  onView={() => setPreviewPoster(poster)}
                  onEdit={() => openEditor(poster.id)}
                  onDelete={() => handleDelete(poster)}
                />
              </div>
            );
          })}
          {filteredPosters.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">موردی یافت نشد.</div>
          )}
        </div>
      )}

      <Dialog open={editorOpen} onOpenChange={(open) => (open ? setEditorOpen(true) : closeEditor())}>
        <DialogContent className={editorDialogClass}>
          <DialogHeader className="shrink-0 border-b px-6 py-4 pr-12">
            <DialogTitle>{activePoster?.title ?? "ویرایش پوستر"}</DialogTitle>
            <DialogDescription className="sr-only">
              ویرایش عنوان، نسخه‌ها و وضعیت انتشار پوستر
            </DialogDescription>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 pb-4 pt-4">
            {activePoster ? (
              <AdminPosterEditor
                poster={activePoster}
                versions={activeVersions}
                categories={initialCategories}
                contentPlans={contentPlans}
                contentTopics={contentTopics}
                canScore={canScore}
                isNew={isDraftPoster}
                onClose={closeEditor}
                onSaved={(savedPoster) => {
                  setPosters((prev) => {
                    const exists = prev.some((item) => item.id === savedPoster.id);
                    return exists
                      ? prev.map((item) => (item.id === savedPoster.id ? savedPoster : item))
                      : [...prev, savedPoster];
                  });
                  setDraftPoster(null);
                  closeEditor();
                  refresh();
                }}
              />
            ) : (
              <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
                در حال بارگذاری...
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(previewPoster)} onOpenChange={(open) => !open && setPreviewPoster(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{previewPoster?.title ?? "نمایش پوستر"}</DialogTitle>
            <DialogDescription className="sr-only">پیش‌نمایش پوستر</DialogDescription>
          </DialogHeader>
          {previewPoster && (
            <div className="space-y-3">
              <ImageZoom
                src={
                  resolveDisplayVersion(versionsByPosterId.get(previewPoster.id) ?? [])?.imageUrl ??
                  ""
                }
                alt={previewPoster.title}
                className="w-full rounded-lg bg-muted"
                imgClassName="max-h-80 w-full object-contain"
              />
              <p className="text-sm text-muted-foreground">{previewPoster.description || "بدون توضیحات"}</p>
              <AdminItemActions
                onEdit={() => {
                  setPreviewPoster(null);
                  openEditor(previewPoster.id);
                }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
