"use client";

import { useMemo, useState, useTransition } from "react";
import { FileSpreadsheet, FileText, Plus } from "lucide-react";
import { toast } from "sonner";
import { AdminOwnerBadge } from "@/components/admin/admin-owner-badge";
import { AdminPlanLabelsBadges } from "@/components/admin/admin-plan-labels-badges";
import { AdminViewModeToggle } from "@/components/admin/admin-view-mode-toggle";
import { AdminItemActions } from "@/components/admin/admin-item-actions";
import {
  AdminContentFilterBar,
  collectAdminFilterUsers,
  DEFAULT_ADMIN_CONTENT_FILTER,
  matchesAdminContentFilter,
  type AdminContentFilterState,
} from "@/components/admin/admin-content-filter-bar";
import {
  BulkItemShell,
  SectionBulkEditBar,
  useSectionBulkEdit,
} from "@/components/admin/section-bulk-edit";
import { PlanLabelSelect } from "@/components/admin/plan-label-select";
import { ContentScoreControl } from "@/components/admin/content-score-control";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DocumentUpload } from "@/components/ui/document-upload";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { deleteCampaignFileAction, saveCampaignFileAction } from "@/lib/actions/admin-actions";
import { CONTENT_TITLE_MAX_LENGTH } from "@/lib/content-constraints";
import type { ContentTopic } from "@/lib/content-topics";
import { useAdminViewMode } from "@/lib/hooks/use-admin-view-mode";
import { useAdminInfiniteScroll } from "@/lib/hooks/use-admin-infinite-scroll";
import { AdminInfiniteScrollSentinel } from "@/components/admin/admin-infinite-scroll-sentinel";
import type { AdminUser, CampaignFile } from "@/lib/types";
import { formatPersianNumber } from "@/lib/utils";

interface FilesAdminProps {
  campaignId: string;
  initialFiles: CampaignFile[];
  contentPlans?: string[];
  contentTopics?: ContentTopic[];
  canScore?: boolean;
  isFullAdmin?: boolean;
  users?: AdminUser[];
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${formatPersianNumber(bytes)} B`;
  if (bytes < 1024 * 1024) return `${formatPersianNumber(Math.round(bytes / 1024))} KB`;
  return `${formatPersianNumber(Math.round(bytes / (1024 * 1024)))} MB`;
}

function fileIcon(mimeType: string) {
  if (mimeType.includes("sheet") || mimeType.includes("excel")) {
    return FileSpreadsheet;
  }
  return FileText;
}

export function FilesAdmin({
  campaignId,
  initialFiles,
  contentPlans = [],
  contentTopics = [],
  canScore = false,
  isFullAdmin = false,
  users = [],
}: FilesAdminProps) {
  const [files, setFiles] = useState(initialFiles);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [planLabels, setPlanLabels] = useState<string[]>([]);
  const [contentFilter, setContentFilter] = useState<AdminContentFilterState>(DEFAULT_ADMIN_CONTENT_FILTER);
  const { viewMode, setViewMode } = useAdminViewMode("files");
  const [upload, setUpload] = useState({
    url: "",
    fileName: "",
    fileSize: 0,
    mimeType: "",
  });
  const [isPending, startTransition] = useTransition();

  const filterUsers = useMemo(() => collectAdminFilterUsers(files), [files]);
  const filteredFiles = useMemo(
    () => files.filter((item) => matchesAdminContentFilter(item, contentFilter)),
    [files, contentFilter]
  );
  const paginationResetKey = `${contentFilter.userKey}:${contentFilter.planLabels.join(",")}:${viewMode}`;
  const { visibleCount, hasMore, isLoadingMore, loadMore } = useAdminInfiniteScroll(
    filteredFiles.length,
    paginationResetKey
  );
  const visibleFiles = useMemo(
    () => filteredFiles.slice(0, visibleCount),
    [filteredFiles, visibleCount]
  );
  const visibleIds = useMemo(() => visibleFiles.map((item) => item.id), [visibleFiles]);
  const bulk = useSectionBulkEdit(visibleIds);

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setPlanLabels([]);
    setUpload({ url: "", fileName: "", fileSize: 0, mimeType: "" });
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (file: CampaignFile) => {
    setEditingId(file.id);
    setTitle(file.title);
    setDescription(file.description ?? "");
    setPlanLabels(file.planLabels?.length ? file.planLabels : file.planLabel ? [file.planLabel] : []);
    setUpload({
      url: file.fileUrl,
      fileName: file.fileName,
      fileSize: file.fileSize,
      mimeType: file.mimeType,
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!title.trim()) {
      toast.error("عنوان فایل الزامی است");
      return;
    }
    if (!upload.url) {
      toast.error("ابتدا فایل را آپلود کنید");
      return;
    }

    startTransition(async () => {
      const result = await saveCampaignFileAction({
        id: editingId ?? undefined,
        campaignId,
        title: title.trim(),
        description: description.trim() || undefined,
        fileUrl: upload.url,
        fileName: upload.fileName,
        fileSize: upload.fileSize,
        mimeType: upload.mimeType,
        published: true,
        sortOrder: editingId
          ? files.find((item) => item.id === editingId)?.sortOrder ?? files.length + 1
          : files.length + 1,
        planLabels,
        planLabel: planLabels[0] ?? null,
      });

      if (!result.success) {
        toast.error("ذخیره فایل ناموفق بود");
        return;
      }

      const savedId =
        "id" in result && typeof result.id === "string" && result.id
          ? result.id
          : editingId;
      if (!savedId) {
        toast.error("ذخیره فایل ناموفق بود");
        return;
      }

      const now = new Date().toISOString();
      const nextFile: CampaignFile = {
        id: savedId,
        campaignId,
        title: title.trim(),
        description: description.trim() || null,
        fileUrl: upload.url,
        fileName: upload.fileName,
        fileSize: upload.fileSize,
        mimeType: upload.mimeType,
        published: true,
        sortOrder: editingId
          ? files.find((item) => item.id === editingId)?.sortOrder ?? files.length + 1
          : files.length + 1,
        planLabels,
        planLabel: planLabels[0] ?? null,
        score: editingId ? files.find((item) => item.id === editingId)?.score : undefined,
        ownerUserId: editingId ? files.find((item) => item.id === editingId)?.ownerUserId : undefined,
        ownerName: editingId ? files.find((item) => item.id === editingId)?.ownerName : undefined,
        createdAt: editingId
          ? files.find((item) => item.id === editingId)?.createdAt ?? now
          : now,
        updatedAt: now,
      };

      setFiles((prev) =>
        editingId
          ? prev.map((item) => (item.id === editingId ? { ...item, ...nextFile } : item))
          : [...prev, nextFile]
      );
      toast.success(editingId ? "فایل به‌روزرسانی شد" : "فایل اضافه شد");
      setDialogOpen(false);
      resetForm();
    });
  };

  const handleDelete = (file: CampaignFile) => {
    startTransition(async () => {
      await deleteCampaignFileAction(file.id);
      setFiles((prev) => prev.filter((item) => item.id !== file.id));
      toast.success("فایل حذف شد");
      setDialogOpen(false);
      resetForm();
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">فایل‌های کمپین</h1>
          <p className="text-sm text-muted-foreground">
            PDF، Word، Excel و سایر فایل‌های قابل دانلود
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AdminViewModeToggle value={viewMode} onChange={setViewMode} />
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            فایل جدید
          </Button>
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
        contentType="file"
        bulkMode={bulk.bulkMode}
        onBulkModeChange={bulk.setBulkMode}
        selectedIds={[...bulk.selectedIds]}
        visibleCount={visibleFiles.length}
        allVisibleSelected={bulk.allVisibleSelected}
        onToggleAllVisible={bulk.toggleAllVisible}
        onClearSelection={bulk.clearSelection}
        contentPlans={contentPlans}
        contentTopics={contentTopics}
        isFullAdmin={isFullAdmin}
        users={users}
      />

      {filteredFiles.length === 0 ? (
        <div className="rounded-xl border py-12 text-center text-muted-foreground">
          {files.length === 0 ? "هنوز فایلی آپلود نشده است." : "موردی با این فیلتر پیدا نشد."}
        </div>
      ) : viewMode === "list" ? (
        <div className="overflow-hidden rounded-xl border">
          {visibleFiles.map((file) => (
            <div
              key={file.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 last:border-b-0"
            >
              <div className="flex min-w-0 items-start gap-3">
                {bulk.bulkMode && (
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4"
                    checked={bulk.isSelected(file.id)}
                    onChange={() => bulk.toggle(file.id)}
                  />
                )}
                <div className="min-w-0">
                  <p className="truncate font-medium">{file.title}</p>
                  <p className="text-xs text-muted-foreground">{file.fileName}</p>
                  <AdminPlanLabelsBadges
                    planLabels={file.planLabels}
                    planLabel={file.planLabel}
                    className="mt-1"
                  />
                </div>
              </div>
              {!bulk.bulkMode && (
                <AdminItemActions
                  onView={() => window.open(file.fileUrl, "_blank")}
                  onEdit={() => openEdit(file)}
                  onDelete={() => handleDelete(file)}
                  deleteLabel="این فایل"
                />
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {visibleFiles.map((file) => {
            const Icon = fileIcon(file.mimeType);
            return (
              <BulkItemShell
                key={file.id}
                enabled={bulk.bulkMode}
                selected={bulk.isSelected(file.id)}
                onToggle={() => bulk.toggle(file.id)}
              >
                <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-muted p-2">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{file.title}</p>
                        <AdminOwnerBadge ownerUserId={file.ownerUserId} ownerName={file.ownerName} />
                      </div>
                      <p className="text-xs text-muted-foreground">{file.fileName}</p>
                      <AdminPlanLabelsBadges
                        planLabels={file.planLabels}
                        planLabel={file.planLabel}
                        className="mt-1"
                      />
                      {file.description && (
                        <p className="mt-1 text-sm text-muted-foreground">{file.description}</p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatFileSize(file.fileSize)}
                      </p>
                      <div className="mt-2">
                        <ContentScoreControl
                          campaignId={campaignId}
                          contentType="file"
                          contentId={file.id}
                          score={file.score}
                          canScore={canScore}
                          compact
                          onScoreSaved={(score) =>
                            setFiles((prev) =>
                              prev.map((item) => (item.id === file.id ? { ...item, score } : item))
                            )
                          }
                        />
                      </div>
                    </div>
                  </div>

                  {!bulk.bulkMode && (
                    <AdminItemActions
                      onView={() => window.open(file.fileUrl, "_blank")}
                      onEdit={() => openEdit(file)}
                      onDelete={() => handleDelete(file)}
                      deleteLabel="این فایل"
                    />
                  )}
                </div>
              </BulkItemShell>
            );
          })}
        </div>
      )}

      <AdminInfiniteScrollSentinel
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        onLoadMore={loadMore}
        remaining={filteredFiles.length - visibleCount}
      />

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "ویرایش فایل" : "افزودن فایل"}</DialogTitle>
            <DialogDescription className="sr-only">
              آپلود فایل PDF، Word، Excel یا متنی برای کمپین
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>عنوان</Label>
              <Input
                value={title}
                maxLength={CONTENT_TITLE_MAX_LENGTH}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="عنوان فایل"
              />
            </div>
            <div>
              <Label>توضیحات (اختیاری)</Label>
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={2}
              />
            </div>
            <PlanLabelSelect
              topics={contentTopics}
              plans={contentPlans}
              values={planLabels}
              onChangeMultiple={setPlanLabels}
            />
            <DocumentUpload
              label="فایل"
              value={upload.url}
              fileName={upload.fileName}
              fileSize={upload.fileSize}
              mimeType={upload.mimeType}
              onChange={setUpload}
              disabled={isPending}
            />
            <Button onClick={handleSave} disabled={isPending} className="w-full">
              {isPending ? "در حال ذخیره..." : "ذخیره فایل"}
            </Button>
            {editingId && (
              <Button
                type="button"
                variant="destructive"
                className="w-full"
                disabled={isPending}
                onClick={() => {
                  const current = files.find((item) => item.id === editingId);
                  if (current) handleDelete(current);
                }}
              >
                حذف فایل
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
