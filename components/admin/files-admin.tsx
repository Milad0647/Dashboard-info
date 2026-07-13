"use client";

import { useMemo, useState, useTransition } from "react";
import { Download, FileSpreadsheet, FileText, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AdminOwnerBadge } from "@/components/admin/admin-owner-badge";
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
import type { ContentTopic } from "@/lib/content-topics";
import { useAdminViewMode } from "@/lib/hooks/use-admin-view-mode";
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
  const filteredIds = useMemo(() => filteredFiles.map((item) => item.id), [filteredFiles]);
  const bulk = useSectionBulkEdit(filteredIds);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setPlanLabels([]);
    setUpload({ url: "", fileName: "", fileSize: 0, mimeType: "" });
  };

  const handleCreate = () => {
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
        campaignId,
        title: title.trim(),
        description: description.trim() || undefined,
        fileUrl: upload.url,
        fileName: upload.fileName,
        fileSize: upload.fileSize,
        mimeType: upload.mimeType,
        published: true,
        sortOrder: files.length + 1,
        planLabels,
        planLabel: planLabels[0] ?? null,
      });

      if (!result.success || !("id" in result) || !result.id) {
        toast.error("ذخیره فایل ناموفق بود");
        return;
      }

      const now = new Date().toISOString();
      setFiles((prev) => [
        ...prev,
        {
          id: result.id ?? crypto.randomUUID(),
          campaignId,
          title: title.trim(),
          description: description.trim() || null,
          fileUrl: upload.url,
          fileName: upload.fileName,
          fileSize: upload.fileSize,
          mimeType: upload.mimeType,
          published: true,
          sortOrder: prev.length + 1,
          planLabels,
          planLabel: planLabels[0] ?? null,
          createdAt: now,
          updatedAt: now,
        },
      ]);
      toast.success("فایل اضافه شد");
      setDialogOpen(false);
      resetForm();
    });
  };

  const handleDelete = (file: CampaignFile) => {
    startTransition(async () => {
      await deleteCampaignFileAction(file.id);
      setFiles((prev) => prev.filter((item) => item.id !== file.id));
      toast.success("فایل حذف شد");
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
          <Button onClick={() => setDialogOpen(true)}>
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
        visibleCount={filteredFiles.length}
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
          {filteredFiles.map((file) => (
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
                </div>
              </div>
              {!bulk.bulkMode && (
                <AdminItemActions
                  onView={() => window.open(file.fileUrl, "_blank")}
                  onDelete={() => handleDelete(file)}
                />
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredFiles.map((file) => {
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
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <a href={file.fileUrl} target="_blank" rel="noopener noreferrer">
                          <Download className="h-4 w-4" />
                          دانلود
                        </a>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(file)}
                        disabled={isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
              </BulkItemShell>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>افزودن فایل</DialogTitle>
            <DialogDescription className="sr-only">
              آپلود فایل PDF، Word، Excel یا متنی برای کمپین
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>عنوان</Label>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="عنوان فایل" />
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
            <Button onClick={handleCreate} disabled={isPending} className="w-full">
              {isPending ? "در حال ذخیره..." : "ذخیره فایل"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
