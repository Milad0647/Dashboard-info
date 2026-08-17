"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { AdminPosterAddCard, AdminPosterCompactCard } from "@/components/admin/admin-poster-compact-card";
import { AdminPosterEditor } from "@/components/admin/admin-poster-editor";
import { AdminItemActions } from "@/components/admin/admin-item-actions";
import { SendContentMessageButton } from "@/components/admin/send-content-message-button";
import { AdminViewModeToggle } from "@/components/admin/admin-view-mode-toggle";
import {
  AdminContentFilterBar,
  adminContentFilterResetKey,
  buildAdminFilterSources,
  DEFAULT_ADMIN_CONTENT_FILTER,
  matchesAdminContentFilter,
  sortAdminContentItems,
  type AdminContentFilterState,
} from "@/components/admin/admin-content-filter-bar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AdminContentPreviewDialog } from "@/components/admin/admin-content-preview-dialog";
import { Button } from "@/components/ui/button";
import {
  BulkItemShell,
  SectionBulkEditBar,
  useSectionBulkEdit,
} from "@/components/admin/section-bulk-edit";
import { deletePosterAction } from "@/lib/actions/admin-actions";
import type { ContentTopic } from "@/lib/content-topics";
import { ScoringRulesProvider } from "@/lib/context/scoring-rules-context";
import {
  parseEditSuggestionMissingFields,
  type EditSuggestionMissingField,
} from "@/lib/edit-suggestions";
import { useAdminViewMode } from "@/lib/hooks/use-admin-view-mode";
import { useSectionCreateGate } from "@/lib/hooks/use-section-create-gate";
import { useAdminInfiniteScroll } from "@/lib/hooks/use-admin-infinite-scroll";
import { AdminInfiniteScrollSentinel } from "@/components/admin/admin-infinite-scroll-sentinel";
import { downloadMedia, getFilenameFromUrl, resolveDisplayVersion } from "@/lib/media-utils";
import { cn, formatPersianDate, formatPersianDateTime } from "@/lib/utils";
import type {
  AdminUser,
  CampaignScoringConfig,
  MediaCategory,
  Poster,
  PosterVersion,
} from "@/lib/types";

interface PostersAdminProps {
  campaignId: string;
  initialCategories: MediaCategory[];
  initialPosters: Poster[];
  initialVersions: PosterVersion[];
  contentPlans?: string[];
  contentTopics?: ContentTopic[];
  scoringRules?: CampaignScoringConfig | null;
  canScore?: boolean;
  isFullAdmin?: boolean;
  canTransferOwnership?: boolean;
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
  scoringRules = null,
  canScore = false,
  isFullAdmin = false,
  canTransferOwnership = false,
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

  const { users: filterUsers, locations: filterLocations } = useMemo(
    () => buildAdminFilterSources(posters, users, canTransferOwnership || isFullAdmin),
    [posters, users, canTransferOwnership, isFullAdmin]
  );
  const filteredPosters = useMemo(
    () =>
      sortAdminContentItems(
        posters.filter((item) => matchesAdminContentFilter(item, contentFilter)),
        contentFilter.sortOrder
      ),
    [posters, contentFilter]
  );
  const paginationResetKey = adminContentFilterResetKey(contentFilter);
  const { visibleCount, hasMore, isLoadingMore, loadMore } = useAdminInfiniteScroll(
    filteredPosters.length,
    paginationResetKey
  );
  const visiblePosters = useMemo(
    () => filteredPosters.slice(0, visibleCount),
    [filteredPosters, visibleCount]
  );
  const visibleIds = useMemo(() => visiblePosters.map((item) => item.id), [visiblePosters]);
  const filteredIds = useMemo(() => filteredPosters.map((item) => item.id), [filteredPosters]);
  const bulk = useSectionBulkEdit(visibleIds, filteredIds);

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
    <ScoringRulesProvider scoringRules={scoringRules}>
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
        users={canTransferOwnership || isFullAdmin ? filterUsers : []}
        plans={contentPlans}
        locations={filterLocations}
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
        canTransferOwnership={canTransferOwnership || isFullAdmin}
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
                onClick={() => (bulk.bulkMode ? setPreviewPoster(poster) : openEditor(poster.id))}
                onView={() => setPreviewPoster(poster)}
                onEdit={() => openEditor(poster.id)}
                onDelete={() => handleDelete(poster)}
                messageAction={
                  (canTransferOwnership || isFullAdmin) ? (
                    <SendContentMessageButton
                      compact
                      target={{
                        campaignId,
                        contentType: "poster",
                        contentId: poster.id,
                        contentTitle: poster.title,
                        ownerName: poster.ownerName,
                      }}
                    />
                  ) : undefined
                }
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
                  <div className="flex items-center gap-2">
                    {(canTransferOwnership || isFullAdmin) && (
                      <SendContentMessageButton
                        target={{
                          campaignId,
                          contentType: "poster",
                          contentId: poster.id,
                          contentTitle: poster.title,
                          ownerName: poster.ownerName,
                        }}
                      />
                    )}
                    <AdminItemActions
                      onView={() => setPreviewPoster(poster)}
                      onEdit={() => openEditor(poster.id)}
                      onDelete={() => handleDelete(poster)}
                    />
                  </div>
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
                canTransferOwnership={canTransferOwnership || isFullAdmin}
                users={users}
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

      {(() => {
        const displayVersion = previewPoster
          ? resolveDisplayVersion(versionsByPosterId.get(previewPoster.id) ?? [])
          : undefined;
        const previewSrc = displayVersion?.imageUrl?.trim() || "";

        return (
          <AdminContentPreviewDialog
            open={Boolean(previewPoster)}
            onOpenChange={(open) => !open && setPreviewPoster(null)}
            title={previewPoster?.title ?? "نمایش پوستر"}
            description={previewPoster?.description}
            contentClassName="max-w-4xl"
            mediaPreview={
              <PosterAdminPreviewImage
                src={previewSrc}
                thumbnailUrl={displayVersion?.thumbnailUrl}
                alt={previewPoster?.title ?? "پوستر"}
                downloadName={getFilenameFromUrl(
                  previewSrc,
                  `${previewPoster?.title ?? "poster"}.jpg`
                )}
              />
            }
            details={
              previewPoster
                ? [
                    {
                      label: "تاریخ",
                      value: displayVersion?.date ? formatPersianDate(displayVersion.date) : "—",
                    },
                    {
                      label: "تاریخ ثبت",
                      value: previewPoster.createdAt
                        ? formatPersianDateTime(previewPoster.createdAt)
                        : "—",
                    },
                    { label: "مالک", value: previewPoster.ownerName ?? "—" },
                    {
                      label: "برچسب‌ها",
                      value: previewPoster.planLabels?.length
                        ? previewPoster.planLabels.join("، ")
                        : "—",
                    },
                    ...(canScore ? [{ label: "امتیاز", value: previewPoster.score ?? "—" }] : []),
                    { label: "یادداشت", value: displayVersion?.notes || "—" },
                  ]
                : []
            }
            canSendMessage={canTransferOwnership || isFullAdmin}
            messageTarget={
              previewPoster
                ? {
                    campaignId,
                    contentType: "poster",
                    contentId: previewPoster.id,
                    contentTitle: previewPoster.title,
                    ownerName: previewPoster.ownerName,
                  }
                : null
            }
            onEdit={
              previewPoster
                ? () => {
                    const posterId = previewPoster.id;
                    setPreviewPoster(null);
                    openEditor(posterId);
                  }
                : undefined
            }
          />
        );
      })()}
    </div>
    </ScoringRulesProvider>
  );
}

function PosterAdminPreviewImage({
  src,
  thumbnailUrl,
  alt,
  downloadName,
}: {
  src: string;
  thumbnailUrl?: string | null;
  alt: string;
  downloadName: string;
}) {
  const [useThumb, setUseThumb] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const thumb = thumbnailUrl?.trim() || "";
  const displaySrc = useThumb && thumb ? thumb : src;

  useEffect(() => {
    setUseThumb(false);
    setExhausted(false);
  }, [src, thumb]);

  if (!src) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
        تصویری ثبت نشده است
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {exhausted ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-lg bg-muted px-4 text-center text-sm text-muted-foreground">
          پیش‌نمایش این فایل در مرورگر ممکن نیست
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg bg-zinc-950">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={displaySrc}
            src={displaySrc}
            alt={alt}
            loading="eager"
            decoding="async"
            className="mx-auto max-h-[75vh] w-full object-contain"
            onError={() => {
              if (!useThumb && thumb && thumb !== src) {
                setUseThumb(true);
                return;
              }
              setExhausted(true);
            }}
          />
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={() => void downloadMedia(src, downloadName)}
      >
        <Download className="h-4 w-4" />
        دانلود پوستر
      </Button>
    </div>
  );
}
