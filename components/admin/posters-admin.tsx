"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AdminPosterAddCard, AdminPosterCompactCard } from "@/components/admin/admin-poster-compact-card";
import { AdminMediaCategories } from "@/components/admin/admin-media-categories";
import { AdminPosterEditor } from "@/components/admin/admin-poster-editor";
import { savePosterAction } from "@/lib/actions/admin-actions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { MediaCategory, Poster, PosterVersion } from "@/lib/types";

interface PostersAdminProps {
  campaignId: string;
  initialCategories: MediaCategory[];
  initialPosters: Poster[];
  initialVersions: PosterVersion[];
}

const editorDialogClass =
  "relative flex max-h-[92vh] max-w-2xl flex-col overflow-hidden p-0 !top-4 !translate-x-[-50%] !translate-y-0 sm:!top-6";

export function PostersAdmin({
  campaignId,
  initialCategories,
  initialPosters,
  initialVersions,
}: PostersAdminProps) {
  const router = useRouter();
  const [editorOpen, setEditorOpen] = useState(false);
  const [activePosterId, setActivePosterId] = useState<string | null>(null);
  const [draftPoster, setDraftPoster] = useState<Poster | null>(null);
  const [isPending, startTransition] = useTransition();

  const activePoster = activePosterId
    ? initialPosters.find((poster) => poster.id === activePosterId) ?? draftPoster
    : null;

  const refresh = () => router.refresh();

  useEffect(() => {
    if (editorOpen) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [editorOpen]);

  const openEditor = (posterId: string, draft?: Poster) => {
    setActivePosterId(posterId);
    setDraftPoster(draft ?? null);
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setActivePosterId(null);
    setDraftPoster(null);
  };

  const handleCreatePoster = () => {
    if (initialCategories.length === 0) {
      toast.error("ابتدا یک دسته بسازید");
      return;
    }

    const posterId = crypto.randomUUID();
    const draft: Poster = {
      id: posterId,
      campaignId,
      categoryId: initialCategories[0].id,
      title: `پوستر ${initialPosters.length + 1}`,
      description: "",
      published: false,
      sortOrder: initialPosters.length + 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    startTransition(async () => {
      await savePosterAction({
        id: posterId,
        campaignId,
        categoryId: initialCategories[0].id,
        title: draft.title,
        description: "",
        published: false,
        sortOrder: draft.sortOrder,
      });
      openEditor(posterId, draft);
      toast.success("پوستر جدید — تصویر را آپلود کنید");
      refresh();
    });
  };

  const activeVersions = activePosterId
    ? initialVersions.filter((version) => version.posterId === activePosterId)
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">پوسترها</h1>
        <p className="text-sm text-muted-foreground">
          نمای فشرده — روی کارت کلیک کنید یا با + پوستر جدید بسازید
        </p>
      </div>

      <AdminMediaCategories
        campaignId={campaignId}
        type="poster"
        categories={initialCategories}
        label="پوستر"
      />

      {initialCategories.length === 0 ? (
        <div className="rounded-xl border py-12 text-center text-muted-foreground">
          ابتدا یک دسته‌بندی بسازید.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {initialPosters.map((poster) => (
            <AdminPosterCompactCard
              key={poster.id}
              poster={poster}
              versions={initialVersions.filter((version) => version.posterId === poster.id)}
              onClick={() => openEditor(poster.id)}
            />
          ))}
          <AdminPosterAddCard onClick={handleCreatePoster} disabled={isPending} />
        </div>
      )}

      <Dialog open={editorOpen} onOpenChange={(open) => !open && closeEditor()}>
        <DialogContent className={editorDialogClass}>
          <DialogHeader className="shrink-0 border-b px-6 py-4 pr-12">
            <DialogTitle>{activePoster?.title ?? "ویرایش پوستر"}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-hidden px-6 pb-4 pt-4">
            {activePoster ? (
              <AdminPosterEditor
                poster={activePoster}
                versions={activeVersions}
                categories={initialCategories}
                onClose={closeEditor}
              />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">در حال بارگذاری...</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
