"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AdminVideoAddCard, AdminVideoCompactCard } from "@/components/admin/admin-video-compact-card";
import { AdminVideoEditor } from "@/components/admin/admin-video-editor";
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
import { deleteVideoAction } from "@/lib/actions/admin-actions";
import type { ContentTopic } from "@/lib/content-topics";
import { useAdminViewMode } from "@/lib/hooks/use-admin-view-mode";
import { resolveDisplayVersion } from "@/lib/media-utils";
import type { MediaCategory, Video, VideoVersion } from "@/lib/types";
import { pickDefaultVideoCategoryId } from "@/lib/video-types";

interface VideosAdminProps {
  campaignId: string;
  initialCategories: MediaCategory[];
  initialVideos: Video[];
  initialVersions: VideoVersion[];
  contentPlans?: string[];
  contentTopics?: ContentTopic[];
  canScore?: boolean;
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
}: VideosAdminProps) {
  const router = useRouter();
  const [videos, setVideos] = useState(initialVideos);
  const [versions, setVersions] = useState(initialVersions);
  const [editorOpen, setEditorOpen] = useState(false);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [draftVideo, setDraftVideo] = useState<Video | null>(null);
  const [previewVideo, setPreviewVideo] = useState<Video | null>(null);
  const [contentFilter, setContentFilter] = useState<AdminContentFilterState>(DEFAULT_ADMIN_CONTENT_FILTER);
  const { viewMode, setViewMode } = useAdminViewMode("videos");
  const [, startTransition] = useTransition();

  useEffect(() => {
    setVideos(initialVideos);
    setVersions(initialVersions);
  }, [initialVideos, initialVersions]);

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

  const activeVideo = useMemo(() => {
    if (!activeVideoId) return null;
    if (draftVideo?.id === activeVideoId) return draftVideo;
    return videos.find((video) => video.id === activeVideoId) ?? null;
  }, [activeVideoId, draftVideo, videos]);

  const isDraftVideo = Boolean(draftVideo && activeVideoId === draftVideo.id);
  const activeVersions = activeVideoId ? versionsByVideoId.get(activeVideoId) ?? [] : [];
  const refresh = () => router.refresh();

  const openEditor = (videoId: string) => {
    setActiveVideoId(videoId);
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setActiveVideoId(null);
    setDraftVideo(null);
  };

  const handleCreateVideo = () => {
    const videoId = crypto.randomUUID();
    const categoryId = pickDefaultVideoCategoryId(initialCategories);
    const now = new Date().toISOString();
    const newVideo: Video = {
      id: videoId,
      campaignId,
      categoryId,
      title: `ویدیو ${videos.length + 1}`,
      description: "",
      published: false,
      sortOrder: videos.length + 1,
      planLabel: null,
      createdAt: now,
      updatedAt: now,
    };

    setDraftVideo(newVideo);
    openEditor(videoId);
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">ویدیوها</h1>
          <p className="text-sm text-muted-foreground">
            نمای فشرده — روی کارت کلیک کنید یا با + ویدیو جدید بسازید
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

      {filteredVideos.length === 0 && videos.length === 0 ? (
        <div className="rounded-xl border px-4 py-8 text-center text-sm text-muted-foreground">
          هنوز ویدیویی ثبت نشده است.
          <div className="mt-3 flex justify-center">
            <AdminVideoAddCard compact onClick={handleCreateVideo} />
          </div>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filteredVideos.map((video) => (
            <AdminVideoCompactCard
              key={video.id}
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
          ))}
          <AdminVideoAddCard onClick={handleCreateVideo} />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          {filteredVideos.map((video) => {
            const displayVersion = resolveDisplayVersion(versionsByVideoId.get(video.id) ?? []);
            return (
              <div
                key={video.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{video.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {video.ownerName ?? "—"}
                    {displayVersion ? ` · نسخه ${displayVersion.versionNumber}` : " · بدون ویدیو"}
                  </p>
                </div>
                <AdminItemActions
                  onView={() => setPreviewVideo(video)}
                  onEdit={() => openEditor(video.id)}
                  onDelete={() => handleDelete(video)}
                />
              </div>
            );
          })}
          {filteredVideos.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">موردی یافت نشد.</div>
          )}
        </div>
      )}

      <Dialog open={editorOpen} onOpenChange={(open) => (open ? setEditorOpen(true) : closeEditor())}>
        <DialogContent className={editorDialogClass}>
          <DialogHeader className="shrink-0 border-b px-6 py-4 pr-12">
            <DialogTitle>{activeVideo?.title ?? "ویرایش ویدیو"}</DialogTitle>
            <DialogDescription className="sr-only">
              ویرایش عنوان، نسخه‌ها و وضعیت انتشار ویدیو
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
                isNew={isDraftVideo}
                onClose={closeEditor}
                onSaved={(savedVideo) => {
                  setVideos((prev) => {
                    const exists = prev.some((item) => item.id === savedVideo.id);
                    return exists
                      ? prev.map((item) => (item.id === savedVideo.id ? savedVideo : item))
                      : [...prev, savedVideo];
                  });
                  setDraftVideo(null);
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

      <Dialog open={Boolean(previewVideo)} onOpenChange={(open) => !open && setPreviewVideo(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{previewVideo?.title ?? "نمایش ویدیو"}</DialogTitle>
            <DialogDescription className="sr-only">پیش‌نمایش ویدیو</DialogDescription>
          </DialogHeader>
          {previewVideo && (
            <div className="space-y-3">
              {resolveDisplayVersion(versionsByVideoId.get(previewVideo.id) ?? [])?.videoUrl ? (
                <video
                  src={resolveDisplayVersion(versionsByVideoId.get(previewVideo.id) ?? [])?.videoUrl}
                  controls
                  className="max-h-80 w-full rounded-lg bg-muted"
                />
              ) : (
                <p className="text-sm text-muted-foreground">ویدیویی برای پیش‌نمایش وجود ندارد.</p>
              )}
              <AdminItemActions
                onEdit={() => {
                  setPreviewVideo(null);
                  openEditor(previewVideo.id);
                }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
