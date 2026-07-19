"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AdminVideoAddCard, AdminVideoCompactCard } from "@/components/admin/admin-video-compact-card";
import { AdminVideoEditor } from "@/components/admin/admin-video-editor";
import { AdminItemActions } from "@/components/admin/admin-item-actions";
import { AdminViewModeToggle } from "@/components/admin/admin-view-mode-toggle";
import { GenerateMissingVideoCoversButton } from "@/components/admin/generate-missing-video-covers-button";
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
import {
  BulkItemShell,
  SectionBulkEditBar,
  useSectionBulkEdit,
} from "@/components/admin/section-bulk-edit";
import { deleteVideoAction, saveVideoVersionAction } from "@/lib/actions/admin-actions";
import { videoNeedsAutoCover } from "@/lib/client/video-cover";
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
import { VideoModal } from "@/components/media/video-modal";
import type { AdminUser, MediaCategory, Video, VideoVersion } from "@/lib/types";
import { cn } from "@/lib/utils";
import { pickDefaultVideoCategoryId } from "@/lib/video-types";

interface VideosAdminProps {
  campaignId: string;
  initialCategories: MediaCategory[];
  initialVideos: Video[];
  initialVersions: VideoVersion[];
  contentPlans?: string[];
  contentTopics?: ContentTopic[];
  canScore?: boolean;
  isFullAdmin?: boolean;
  canTransferOwnership?: boolean;
  users?: AdminUser[];
}

const editorDialogClass =
  "!flex min-h-0 max-h-[92vh] max-w-2xl flex-col gap-0 overflow-hidden p-0 !top-4 !translate-x-[-50%] !translate-y-0 sm:!top-6";

export function VideosAdmin({
  campaignId,
  initialCategories,
  initialVideos,
  initialVersions,
  contentPlans = [],
  contentTopics = [],
  canScore = false,
  isFullAdmin = false,
  canTransferOwnership = false,
  users = [],
}: VideosAdminProps) {
  const { requestCreate, tutorialModal } = useSectionCreateGate("videos");
  const router = useRouter();
  const searchParams = useSearchParams();
  const openedFromQueryRef = useRef<string | null>(null);
  const [videos, setVideos] = useState(initialVideos);
  const [versions, setVersions] = useState(initialVersions);
  const [editorOpen, setEditorOpen] = useState(false);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [draftVideo, setDraftVideo] = useState<Video | null>(null);
  const [previewVideo, setPreviewVideo] = useState<Video | null>(null);
  const [highlightFields, setHighlightFields] = useState<EditSuggestionMissingField[]>([]);
  const [contentFilter, setContentFilter] = useState<AdminContentFilterState>(DEFAULT_ADMIN_CONTENT_FILTER);
  const { viewMode, setViewMode } = useAdminViewMode("videos");
  const [, startTransition] = useTransition();

  useEffect(() => {
    setVideos(initialVideos);
    setVersions(initialVersions);
  }, [initialVideos, initialVersions]);

  useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId || openedFromQueryRef.current === editId) return;
    if (!videos.some((video) => video.id === editId)) return;

    openedFromQueryRef.current = editId;
    setHighlightFields(parseEditSuggestionMissingFields(searchParams.get("missing")));
    setActiveVideoId(editId);
    setDraftVideo(null);
    setEditorOpen(true);
  }, [searchParams, videos]);

  const versionsByVideoId = useMemo(() => {
    const map = new Map<string, VideoVersion[]>();
    for (const version of versions) {
      const list = map.get(version.videoId) ?? [];
      list.push(version);
      map.set(version.videoId, list);
    }
    return map;
  }, [versions]);

  const filterUsers = useMemo(() => collectAdminFilterUsers(videos), [videos]);
  const filteredVideos = useMemo(
    () => videos.filter((item) => matchesAdminContentFilter(item, contentFilter)),
    [videos, contentFilter]
  );
  const paginationResetKey = `${contentFilter.userKey}:${contentFilter.planLabels.join(",")}:${viewMode}`;
  const { visibleCount, hasMore, isLoadingMore, loadMore } = useAdminInfiniteScroll(
    filteredVideos.length,
    paginationResetKey
  );
  const visibleVideos = useMemo(
    () => filteredVideos.slice(0, visibleCount),
    [filteredVideos, visibleCount]
  );
  const visibleIds = useMemo(() => visibleVideos.map((item) => item.id), [visibleVideos]);
  const bulk = useSectionBulkEdit(visibleIds);

  const missingCoverTargets = useMemo(() => {
    return videos.flatMap((video) => {
      const display = resolveDisplayVersion(versionsByVideoId.get(video.id) ?? []);
      if (!display || !videoNeedsAutoCover(display.videoUrl, display.thumbnailUrl)) {
        return [];
      }
      return [
        {
          id: display.id,
          label: video.title,
          videoUrl: display.videoUrl,
          thumbnailUrl: display.thumbnailUrl,
          applyCover: async (coverUrl: string) => {
            await saveVideoVersionAction({
              ...display,
              videoId: display.videoId,
              thumbnailUrl: coverUrl,
            });
            setVersions((prev) =>
              prev.map((item) =>
                item.id === display.id ? { ...item, thumbnailUrl: coverUrl } : item
              )
            );
          },
        },
      ];
    });
  }, [videos, versionsByVideoId]);

  const activeVideo = useMemo(() => {
    if (!activeVideoId) return null;
    if (draftVideo?.id === activeVideoId) return draftVideo;
    return videos.find((video) => video.id === activeVideoId) ?? null;
  }, [activeVideoId, draftVideo, videos]);

  const isDraftVideo = Boolean(draftVideo && activeVideoId === draftVideo.id);
  const activeVersions = activeVideoId ? versionsByVideoId.get(activeVideoId) ?? [] : [];
  const refresh = () => router.refresh();

  const clearEditQuery = () => {
    if (!searchParams.get("edit") && !searchParams.get("missing")) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("edit");
    params.delete("missing");
    const query = params.toString();
    router.replace(query ? `/admin/videos?${query}` : "/admin/videos");
  };

  const openEditor = (videoId: string, fields: EditSuggestionMissingField[] = []) => {
    if (draftVideo && draftVideo.id !== videoId) {
      setDraftVideo(null);
    }
    setHighlightFields(fields);
    setActiveVideoId(videoId);
    setEditorOpen(true);
  };

  /** Soft close: keep unsaved create draft so Add can reopen it (cleared on refresh). */
  const closeEditor = () => {
    setEditorOpen(false);
    setHighlightFields([]);
    openedFromQueryRef.current = null;
    clearEditQuery();
    if (draftVideo && activeVideoId === draftVideo.id) {
      return;
    }
    setActiveVideoId(null);
    setDraftVideo(null);
  };

  /** Hard clear after save, discard, or leaving create entirely. */
  const discardEditor = () => {
    setEditorOpen(false);
    setActiveVideoId(null);
    setDraftVideo(null);
    setHighlightFields([]);
    openedFromQueryRef.current = null;
    clearEditQuery();
  };

  const handleCreateVideo = () => {
    void requestCreate(() => {
      if (draftVideo) {
        setHighlightFields([]);
        setActiveVideoId(draftVideo.id);
        setEditorOpen(true);
        return;
      }

      const videoId = crypto.randomUUID();
      const categoryId = pickDefaultVideoCategoryId(initialCategories);
      const now = new Date().toISOString();
      const newVideo: Video = {
        id: videoId,
        campaignId,
        categoryId,
        title: `ویدیو ${videos.length + 1}`,
        description: "",
        published: true,
        sortOrder: videos.length + 1,
        planLabel: null,
        createdAt: now,
        updatedAt: now,
      };

      setDraftVideo(newVideo);
      openEditor(videoId);
    });
  };

  const handleDelete = (video: Video) => {
    if (!window.confirm(`حذف «${video.title}»؟`)) return;
    startTransition(async () => {
      await deleteVideoAction(video.id);
      setVideos((prev) => prev.filter((item) => item.id !== video.id));
      toast.success("حذف شد");
      refresh();
    });
  };

  return (
    <div className="space-y-6">
      {tutorialModal}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">ویدیوها</h1>
          <p className="text-sm text-muted-foreground">
            نمای فشرده — روی کارت کلیک کنید یا با + ویدیو جدید بسازید
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <GenerateMissingVideoCoversButton
            targets={missingCoverTargets}
            onComplete={refresh}
          />
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
        contentType="video"
        bulkMode={bulk.bulkMode}
        onBulkModeChange={bulk.setBulkMode}
        selectedIds={[...bulk.selectedIds]}
        visibleCount={visibleVideos.length}
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

      {filteredVideos.length === 0 && videos.length === 0 ? (
        <div className="rounded-xl border px-4 py-8 text-center text-sm text-muted-foreground">
          هنوز ویدیویی ثبت نشده است.
          <div className="mt-3 flex justify-center">
            <AdminVideoAddCard compact onClick={handleCreateVideo} />
          </div>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {!bulk.bulkMode && <AdminVideoAddCard onClick={handleCreateVideo} />}
          {visibleVideos.map((video) => (
            <BulkItemShell
              key={video.id}
              enabled={bulk.bulkMode}
              selected={bulk.isSelected(video.id)}
              onToggle={() => bulk.toggle(video.id)}
            >
              <AdminVideoCompactCard
                video={video}
                versions={versionsByVideoId.get(video.id) ?? []}
                onClick={() => openEditor(video.id)}
                onView={() => setPreviewVideo(video)}
                onEdit={() => openEditor(video.id)}
                onDelete={() => handleDelete(video)}
                canScore={canScore}
                onScoreSaved={(score) => {
                  setVideos((prev) =>
                    prev.map((item) => (item.id === video.id ? { ...item, score } : item))
                  );
                }}
              />
            </BulkItemShell>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          {visibleVideos.map((video) => {
            const displayVersion = resolveDisplayVersion(versionsByVideoId.get(video.id) ?? []);
            return (
              <div
                key={video.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 last:border-b-0"
              >
                <div className="flex min-w-0 items-start gap-3">
                  {bulk.bulkMode && (
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4"
                      checked={bulk.isSelected(video.id)}
                      onChange={() => bulk.toggle(video.id)}
                    />
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-medium">{video.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {video.ownerName ?? "—"}
                      {displayVersion ? "" : " · بدون ویدیو"}
                    </p>
                  </div>
                </div>
                {!bulk.bulkMode && (
                  <AdminItemActions
                    onView={() => setPreviewVideo(video)}
                    onEdit={() => openEditor(video.id)}
                    onDelete={() => handleDelete(video)}
                  />
                )}
              </div>
            );
          })}
          {filteredVideos.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">موردی یافت نشد.</div>
          )}
        </div>
      )}

      <AdminInfiniteScrollSentinel
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        onLoadMore={loadMore}
        remaining={filteredVideos.length - visibleCount}
      />

      <Dialog open={editorOpen} onOpenChange={(open) => (open ? setEditorOpen(true) : closeEditor())}>
        <DialogContent
          forceMount={Boolean(draftVideo) || undefined}
          className={cn(editorDialogClass, !editorOpen && "!hidden")}
          onPointerDownOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <DialogHeader className="shrink-0 border-b px-6 py-4 pr-12">
            <DialogTitle>{activeVideo?.title ?? "ویرایش ویدیو"}</DialogTitle>
            <DialogDescription className="sr-only">
              ویرایش عنوان و وضعیت انتشار ویدیو
            </DialogDescription>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 pb-4 pt-4">
            {activeVideo ? (
              <AdminVideoEditor
                video={activeVideo}
                versions={activeVersions}
                categories={initialCategories}
                contentPlans={contentPlans}
                contentTopics={contentTopics}
                canScore={canScore}
                canTransferOwnership={canTransferOwnership || isFullAdmin}
                users={users}
                isNew={isDraftVideo}
                highlightFields={highlightFields}
                onClose={discardEditor}
                onSaved={(savedVideo) => {
                  setVideos((prev) => {
                    const exists = prev.some((item) => item.id === savedVideo.id);
                    return exists
                      ? prev.map((item) => (item.id === savedVideo.id ? savedVideo : item))
                      : [...prev, savedVideo];
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

      {previewVideo && (() => {
        const previewVersions = versionsByVideoId.get(previewVideo.id) ?? [];
        const display = resolveDisplayVersion(previewVersions);
        if (!display) return null;
        return (
          <VideoModal
            open
            onOpenChange={(open) => !open && setPreviewVideo(null)}
            title={previewVideo.title}
            versions={previewVersions}
            initialVersionId={display.id}
            description={previewVideo.description}
            category={initialCategories.find((category) => category.id === previewVideo.categoryId)?.title}
            topics={previewVideo.planLabels ?? (previewVideo.planLabel ? [previewVideo.planLabel] : [])}
            ownerName={previewVideo.ownerName}
          />
        );
      })()}
    </div>
  );
}
