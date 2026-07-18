"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import {
  BulkItemShell,
  SectionBulkEditBar,
  useSectionBulkEdit,
} from "@/components/admin/section-bulk-edit";
import { deletePosterAction } from "@/lib/actions/admin-actions";
import type { ContentTopic } from "@/lib/content-topics";
import {
  parseEditSuggestionMissingFields,
  type EditSuggestionMissingField,
} from "@/lib/edit-suggestions";
import { useAdminViewMode } from "@/lib/hooks/use-admin-view-mode";
import { useSectionCreateGate } from "@/lib/hooks/use-section-create-gate";
import { useAdminInfiniteScroll } from "@/lib/hooks/use-admin-infinite-scroll";
import { AdminInfiniteScrollSentinel } from "@/components/admin/admin-infinite-scroll-sentinel";
import { resolveDisplayVersion } from "@/lib/media-utils";
import { cn, formatPersianDate } from "@/lib/utils";
import type { AdminUser, MediaCategory, Poster, PosterVersion } from "@/lib/types";

interface PostersAdminProps {
  campaignId: string;
  initialCategories: MediaCategory[];
  initialPosters: Poster[];
  initialVersions: PosterVersion[];
  contentPlans?: string[];
  contentTopics?: ContentTopic[];
  canScore?: boolean;
  isFullAdmin?: boolean;
  users?: AdminUser[];
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
  isFullAdmin = false,
  users = [],
}: PostersAdminProps) {
  const { requestCreate, tutorialModal } = useSectionCreateGate("posters");
  const router = useRouter();
  const searchParams = useSearchParams();
  const openedFromQueryRef = useRef<string | null>(null);
  const [posters, setPosters] = useState(initialPosters);
  const [versions, setVersions] = useState(initialVersions);
  const [editorOpen, setEditorOpen] = useState(false);
  const [activePosterId, setActivePosterId] = useState<string | null>(null);
  const [draftPoster, setDraftPoster] = useState<Poster | null>(null);
  const [previewPoster, setPreviewPoster] = useState<Poster | null>(null);
  const [highlightFields, setHighlightFields] = useState<EditSuggestionMissingField[]>([]);
  const [contentFilter, setContentFilter] = useState<AdminContentFilterState>(DEFAULT_ADMIN_CONTENT_FILTER);
  const { viewMode, setViewMode } = useAdminViewMode("posters");
  const [, startTransition] = useTransition();

  useEffect(() => {
    setPosters(initialPosters);
    setVersions(initialVersions);
  }, [initialPosters, initialVersions]);

  useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId || openedFromQueryRef.current === editId) return;
    if (!posters.some((poster) => poster.id === editId)) return;

    openedFromQueryRef.current = editId;
    setHighlightFields(parseEditSuggestionMissingFields(searchParams.get("missing")));
    setActivePosterId(editId);
    setDraftPoster(null);
    setEditorOpen(true);
  }, [posters, searchParams]);

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
  const paginationResetKey = `${contentFilter.userKey}:${contentFilter.planLabels.join(",")}:${viewMode}`;
  const { visibleCount, hasMore, isLoadingMore, loadMore } = useAdminInfiniteScroll(
    filteredPosters.length,
    paginationResetKey
  );
  const visiblePosters = useMemo(
    () => filteredPosters.slice(0, visibleCount),
    [filteredPosters, visibleCount]
  );
  const visibleIds = useMemo(() => visiblePosters.map((item) => item.id), [visiblePosters]);
  const bulk = useSectionBulkEdit(visibleIds);

  const activePoster = useMemo(() => {
    if (!activePosterId) return null;
    if (draftPoster?.id === activePosterId) return draftPoster;
    return posters.find((poster) => poster.id === activePosterId) ?? null;
  }, [activePosterId, draftPoster, posters]);

  const isDraftPoster = Boolean(draftPoster && activePosterId === draftPoster.id);
  const activeVersions = activePosterId ? versionsByPosterId.get(activePosterId) ?? [] : [];
  const refresh = () => router.refresh();

  const clearEditQuery = () => {
    if (!searchParams.get("edit") && !searchParams.get("missing")) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("edit");
    params.delete("missing");
    const query = params.toString();
    router.replace(query ? `/admin/posters?${query}` : "/admin/posters");
  };

  const openEditor = (posterId: string, fields: EditSuggestionMissingField[] = []) => {
    if (draftPoster && draftPoster.id !== posterId) {
      setDraftPoster(null);
    }
    setHighlightFields(fields);
    setActivePosterId(posterId);
    setEditorOpen(true);
  };

  /** Soft close: keep unsaved create draft so Add can reopen it (cleared on refresh). */
  const closeEditor = () => {
    setEditorOpen(false);
    setHighlightFields([]);
    openedFromQueryRef.current = null;
    clearEditQuery();
    if (draftPoster && activePosterId === draftPoster.id) {
      return;
    }
    setActivePosterId(null);
    setDraftPoster(null);
  };

  /** Hard clear after save, discard, or leaving create entirely. */
  const discardEditor = () => {
    setEditorOpen(false);
    setActivePosterId(null);
    setDraftPoster(null);
    setHighlightFields([]);
    openedFromQueryRef.current = null;
    clearEditQuery();
  };

  const handleCreatePoster = () => {
    void requestCreate(() => {
      if (draftPoster) {
        setHighlightFields([]);
        setActivePosterId(draftPoster.id);
        setEditorOpen(true);
        return;
      }

      const posterId = crypto.randomUUID();
      const categoryId = initialCategories[0]?.id ?? "";
      const now = new Date().toISOString();
      const newPoster: Poster = {
        id: posterId,
        campaignId,
        categoryId,
        title: `پوستر ${posters.length + 1}`,
        description: "",
        published: true,
        sortOrder: posters.length + 1,
        planLabel: null,
        createdAt: now,
        updatedAt: now,
      };

      setDraftPoster(newPoster);
      openEditor(posterId);
    });
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
      {tutorialModal}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">پوسترها</h1>
          <p className="text-sm text-muted-foreground">
            نمای فشرده — روی کارت کلیک کنید یا با + پوستر جدید بسازید
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AdminViewModeToggle value={viewMode} onChange={setViewMode} />
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
        contentType="poster"
        bulkMode={bulk.bulkMode}
        onBulkModeChange={bulk.setBulkMode}
        selectedIds={[...bulk.selectedIds]}
        visibleCount={visiblePosters.length}
        allVisibleSelected={bulk.allVisibleSelected}
        onToggleAllVisible={bulk.toggleAllVisible}
        onClearSelection={bulk.clearSelection}
        contentPlans={contentPlans}
        contentTopics={contentTopics}
        mediaCategories={initialCategories}
        isFullAdmin={isFullAdmin}
        users={users}
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
          {!bulk.bulkMode && <AdminPosterAddCard onClick={handleCreatePoster} />}
          {visiblePosters.map((poster) => (
            <BulkItemShell
              key={poster.id}
              enabled={bulk.bulkMode}
              selected={bulk.isSelected(poster.id)}
              onToggle={() => bulk.toggle(poster.id)}
            >
              <AdminPosterCompactCard
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
            </BulkItemShell>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          {visiblePosters.map((poster) => {
            const displayVersion = resolveDisplayVersion(versionsByPosterId.get(poster.id) ?? []);
            return (
              <div
                key={poster.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 last:border-b-0"
              >
                <div className="flex min-w-0 items-start gap-3">
                  {bulk.bulkMode && (
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4"
                      checked={bulk.isSelected(poster.id)}
                      onChange={() => bulk.toggle(poster.id)}
                    />
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-medium">{poster.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {poster.ownerName ?? "—"}
                      {displayVersion ? "" : " · بدون تصویر"}
                    </p>
                  </div>
                </div>
                {!bulk.bulkMode && (
                  <AdminItemActions
                    onView={() => setPreviewPoster(poster)}
                    onEdit={() => openEditor(poster.id)}
                    onDelete={() => handleDelete(poster)}
                  />
                )}
              </div>
            );
          })}
          {filteredPosters.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">موردی یافت نشد.</div>
          )}
        </div>
      )}

      <AdminInfiniteScrollSentinel
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        onLoadMore={loadMore}
        remaining={filteredPosters.length - visibleCount}
      />

      <Dialog open={editorOpen} onOpenChange={(open) => (open ? setEditorOpen(true) : closeEditor())}>
        <DialogContent
          forceMount={Boolean(draftPoster) || undefined}
          className={cn(editorDialogClass, !editorOpen && "!hidden")}
          onPointerDownOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <DialogHeader className="shrink-0 border-b px-6 py-4 pr-12">
            <DialogTitle>{activePoster?.title ?? "ویرایش پوستر"}</DialogTitle>
            <DialogDescription className="sr-only">
              ویرایش عنوان و وضعیت انتشار پوستر
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
                highlightFields={highlightFields}
                onClose={discardEditor}
                onSaved={(savedPoster) => {
                  setPosters((prev) => {
                    const exists = prev.some((item) => item.id === savedPoster.id);
                    return exists
                      ? prev.map((item) => (item.id === savedPoster.id ? savedPoster : item))
                      : [...prev, savedPoster];
                  });
                  discardEditor();
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
              {(() => {
                const displayVersion = resolveDisplayVersion(versionsByPosterId.get(previewPoster.id) ?? []);

                return (
                  <>
                    <ImageZoom
                      src={displayVersion?.imageUrl ?? ""}
                      alt={previewPoster.title}
                      className="w-full rounded-lg bg-muted"
                      imgClassName="max-h-80 w-full object-contain"
                    />
                    <div className="grid gap-2 rounded-lg border bg-muted/20 p-3 text-sm sm:grid-cols-2">
                      <div>
                        <p className="text-xs text-muted-foreground">تاریخ</p>
                        <p>{displayVersion?.date ? formatPersianDate(displayVersion.date) : "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">مالک</p>
                        <p>{previewPoster.ownerName ?? "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">برچسب‌ها</p>
                        <p>{previewPoster.planLabels?.length ? previewPoster.planLabels.join("، ") : "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">امتیاز</p>
                        <p>{previewPoster.score ?? "—"}</p>
                      </div>
                      {displayVersion?.notes ? (
                        <div className="sm:col-span-2">
                          <p className="text-xs text-muted-foreground">یادداشت</p>
                          <p className="whitespace-pre-wrap break-words">{displayVersion.notes}</p>
                        </div>
                      ) : null}
                    </div>
                  </>
                );
              })()}
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
