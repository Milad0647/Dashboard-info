"use client";

import { useMemo, useState, useTransition } from "react";
import { FileArchive, Film, HardDrive, ImageIcon, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  AdminContentFilterBar,
  collectAdminFilterUsers,
  DEFAULT_ADMIN_CONTENT_FILTER,
  matchesAdminContentFilter,
  type AdminContentFilterState,
} from "@/components/admin/admin-content-filter-bar";
import { PlanLabelSelect } from "@/components/admin/plan-label-select";
import { ContentScoreControl } from "@/components/admin/content-score-control";
import { AdminOwnerBadge } from "@/components/admin/admin-owner-badge";
import { AdminPlanLabelsBadges } from "@/components/admin/admin-plan-labels-badges";
import { AdminItemActions } from "@/components/admin/admin-item-actions";
import { AdminViewModeToggle } from "@/components/admin/admin-view-mode-toggle";
import {
  BulkItemShell,
  SectionBulkEditBar,
  useSectionBulkEdit,
} from "@/components/admin/section-bulk-edit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MediaUpload } from "@/components/ui/media-upload";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteRawMediaUploadAction,
  saveRawMediaUploadAction,
} from "@/lib/actions/admin-actions";
import { useAdminViewMode } from "@/lib/hooks/use-admin-view-mode";
import { CONTENT_TITLE_MAX_LENGTH } from "@/lib/content-constraints";
import type { ContentTopic } from "@/lib/content-topics";
import {
  buildRawMediaStorageSummary,
  canAcceptRawMediaUpload,
  formatStorageBytes,
  RAW_MEDIA_MAX_FILE_BYTES,
} from "@/lib/raw-media-storage";
import type { AdminUser, RawMediaKind, RawMediaUpload } from "@/lib/types";
import { formatPersianDateTime, formatPersianNumber } from "@/lib/utils";

interface RawMediaAdminProps {
  campaignId: string;
  initialItems: RawMediaUpload[];
  contentPlans?: string[];
  contentTopics?: ContentTopic[];
  canScore?: boolean;
  isFullAdmin?: boolean;
  users?: AdminUser[];
}

export function RawMediaAdmin({
  campaignId,
  initialItems,
  contentPlans = [],
  contentTopics = [],
  canScore = false,
  isFullAdmin = false,
  users = [],
}: RawMediaAdminProps) {
  const [items, setItems] = useState(initialItems);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [mediaKind, setMediaKind] = useState<RawMediaKind>("image");
  const [planLabels, setPlanLabels] = useState<string[]>([]);
  const [contentFilter, setContentFilter] = useState<AdminContentFilterState>(DEFAULT_ADMIN_CONTENT_FILTER);
  const { viewMode, setViewMode } = useAdminViewMode("raw-media");
  const [upload, setUpload] = useState({
    url: "",
    fileName: "",
    fileSize: 0,
    mimeType: "",
  });
  const [isPending, startTransition] = useTransition();
  const [isExporting, setIsExporting] = useState(false);

  const storage = useMemo(() => buildRawMediaStorageSummary(items), [items]);
  const storageForQuota = useMemo(() => {
    if (!editingId) return storage;
    return buildRawMediaStorageSummary(items.filter((item) => item.id !== editingId));
  }, [editingId, items, storage]);
  const filterUsers = useMemo(() => collectAdminFilterUsers(items), [items]);
  const filteredItems = useMemo(
    () => items.filter((item) => matchesAdminContentFilter(item, contentFilter)),
    [items, contentFilter]
  );

  const handleDownloadAll = async () => {
    if (isExporting || items.length === 0) return;
    setIsExporting(true);
    try {
      const response = await fetch(
        `/api/campaign/raw-media/export?campaignId=${encodeURIComponent(campaignId)}`
      );
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { error?: string } | null;
        toast.error(result?.error ?? "خطا در ساخت فایل ZIP");
        return;
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition");
      const match = disposition?.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? `raw-media-${campaignId}.zip`;
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(blobUrl);
      toast.success("دانلود ZIP شروع شد");
    } catch {
      toast.error("خطا در دانلود ZIP");
    } finally {
      setIsExporting(false);
    }
  };
  const filteredIds = useMemo(() => filteredItems.map((item) => item.id), [filteredItems]);
  const bulk = useSectionBulkEdit(filteredIds);

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setMediaKind("image");
    setPlanLabels([]);
    setUpload({ url: "", fileName: "", fileSize: 0, mimeType: "" });
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (item: RawMediaUpload) => {
    setEditingId(item.id);
    setTitle(item.title);
    setDescription(item.description ?? "");
    setMediaKind(item.mediaKind);
    setPlanLabels(item.planLabels?.length ? item.planLabels : item.planLabel ? [item.planLabel] : []);
    setUpload({
      url: item.fileUrl,
      fileName: item.fileName,
      fileSize: item.fileSize,
      mimeType: item.mimeType,
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!title.trim()) {
      toast.error("عنوان الزامی است");
      return;
    }
    if (!upload.url) {
      toast.error("ابتدا فایل را آپلود کنید");
      return;
    }

    const quota = canAcceptRawMediaUpload(storageForQuota, upload.fileSize);
    if (!quota.ok) {
      toast.error(quota.error);
      return;
    }

    startTransition(async () => {
      const existing = editingId ? items.find((item) => item.id === editingId) : undefined;
      const result = await saveRawMediaUploadAction({
        id: editingId ?? undefined,
        campaignId,
        title: title.trim(),
        description: description.trim() || undefined,
        mediaKind,
        fileUrl: upload.url,
        fileName: upload.fileName,
        fileSize: upload.fileSize,
        mimeType: upload.mimeType,
        published: true,
        sortOrder: existing?.sortOrder ?? items.length + 1,
        planLabels,
        planLabel: planLabels[0] ?? null,
      });

      if (!result.success) {
        toast.error("ذخیره ناموفق بود");
        return;
      }

      const savedId =
        "id" in result && typeof result.id === "string" && result.id
          ? result.id
          : editingId;
      if (!savedId) {
        toast.error("ذخیره ناموفق بود");
        return;
      }

      const now = new Date().toISOString();
      const nextItem: RawMediaUpload = {
        id: savedId,
        campaignId,
        title: title.trim(),
        description: description.trim() || null,
        mediaKind,
        fileUrl: upload.url,
        fileName: upload.fileName,
        fileSize: upload.fileSize,
        mimeType: upload.mimeType,
        published: true,
        sortOrder: existing?.sortOrder ?? items.length + 1,
        planLabels,
        planLabel: planLabels[0] ?? null,
        score: existing?.score,
        ownerUserId: existing?.ownerUserId,
        ownerName: existing?.ownerName,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };

      setItems((prev) =>
        editingId
          ? prev.map((row) => (row.id === editingId ? { ...row, ...nextItem } : row))
          : [nextItem, ...prev]
      );
      toast.success(editingId ? "راش به‌روزرسانی شد" : "راش تصویر ذخیره شد");
      setDialogOpen(false);
      resetForm();
    });
  };

  const handleDelete = (item: RawMediaUpload) => {
    startTransition(async () => {
      await deleteRawMediaUploadAction(item.id);
      setItems((prev) => prev.filter((row) => row.id !== item.id));
      toast.success("حذف شد — فضای ذخیره‌سازی آزاد شد");
      setDialogOpen(false);
      resetForm();
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">راش تصویر</h1>
          <p className="text-sm text-muted-foreground">
            آپلود عکس و فیلم خام با حجم بالا — قابل دانلود توسط مدیر/کارفرما
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AdminViewModeToggle value={viewMode} onChange={setViewMode} />
          {items.length > 0 && (
            <Button
              variant="outline"
              disabled={isExporting || isPending}
              onClick={() => void handleDownloadAll()}
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileArchive className="h-4 w-4" />
              )}
              {isExporting ? "در حال آماده‌سازی…" : "دانلود همه (ZIP)"}
            </Button>
          )}
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            آپلود جدید
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <HardDrive className="h-4 w-4 text-primary" />
            فضای ذخیره‌سازی راش تصویر
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {formatStorageBytes(storage.usedBytes)} از {formatStorageBytes(storage.limitBytes)}
            </span>
            <span className="font-semibold">{formatPersianNumber(storage.percentUsed)}٪</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all ${
                storage.percentUsed >= 90
                  ? "bg-destructive"
                  : storage.percentUsed >= 70
                    ? "bg-amber-500"
                    : "bg-primary"
              }`}
              style={{ width: `${storage.percentUsed}%` }}
            />
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span>{formatPersianNumber(storage.fileCount)} فایل</span>
            <span>باقی‌مانده: {formatStorageBytes(storage.remainingBytes)}</span>
          </div>
        </CardContent>
      </Card>

      <AdminContentFilterBar
        filter={contentFilter}
        onChange={setContentFilter}
        users={isFullAdmin ? filterUsers : []}
        plans={contentPlans}
      />

      <SectionBulkEditBar
        campaignId={campaignId}
        contentType="raw_media"
        bulkMode={bulk.bulkMode}
        onBulkModeChange={bulk.setBulkMode}
        selectedIds={[...bulk.selectedIds]}
        visibleCount={filteredItems.length}
        allVisibleSelected={bulk.allVisibleSelected}
        onToggleAllVisible={bulk.toggleAllVisible}
        onClearSelection={bulk.clearSelection}
        contentPlans={contentPlans}
        contentTopics={contentTopics}
        isFullAdmin={isFullAdmin}
        users={users}
      />

      {filteredItems.length === 0 ? (
        <div className="rounded-xl border py-12 text-center text-muted-foreground">
          هنوز موردی برای راش تصویر آپلود نشده است.
        </div>
      ) : viewMode === "list" ? (
        <div className="overflow-hidden rounded-xl border">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 last:border-b-0"
            >
              <div className="flex min-w-0 items-start gap-3">
                {bulk.bulkMode && (
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4"
                    checked={bulk.isSelected(item.id)}
                    onChange={() => bulk.toggle(item.id)}
                  />
                )}
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.fileName} — {formatStorageBytes(item.fileSize)}
                  </p>
                  <AdminPlanLabelsBadges
                    planLabels={item.planLabels}
                    planLabel={item.planLabel}
                    className="mt-1"
                  />
                </div>
              </div>
              {!bulk.bulkMode && (
                <AdminItemActions
                  onView={() => window.open(item.fileUrl, "_blank")}
                  onEdit={() => openEdit(item)}
                  onDelete={() => handleDelete(item)}
                  deleteLabel="این راش"
                />
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {filteredItems.map((item) => (
            <BulkItemShell
              key={item.id}
              enabled={bulk.bulkMode}
              selected={bulk.isSelected(item.id)}
              onToggle={() => bulk.toggle(item.id)}
            >
              <Card>
                <CardContent className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {item.mediaKind === "video" ? (
                        <Film className="h-4 w-4 text-primary" />
                      ) : (
                        <ImageIcon className="h-4 w-4 text-primary" />
                      )}
                      <p className="font-semibold">{item.title}</p>
                      <Badge variant="outline">
                        {item.mediaKind === "video" ? "ویدیو" : "تصویر"}
                      </Badge>
                      <AdminPlanLabelsBadges planLabels={item.planLabels} planLabel={item.planLabel} />
                    </div>
                    {item.description && (
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {item.fileName} — {formatStorageBytes(item.fileSize)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatPersianDateTime(item.createdAt)}
                    </p>
                    <AdminOwnerBadge ownerUserId={item.ownerUserId} ownerName={item.ownerName} />
                    <ContentScoreControl
                      campaignId={campaignId}
                      contentType="raw_media"
                      contentId={item.id}
                      score={item.score}
                      canScore={canScore}
                      compact
                      onScoreSaved={(score) =>
                        setItems((prev) =>
                          prev.map((row) => (row.id === item.id ? { ...row, score } : row))
                        )
                      }
                    />
                  </div>
                  {!bulk.bulkMode && (
                    <AdminItemActions
                      onView={() => window.open(item.fileUrl, "_blank")}
                      onEdit={() => openEdit(item)}
                      onDelete={() => handleDelete(item)}
                      deleteLabel="این راش"
                    />
                  )}
                </CardContent>
              </Card>
            </BulkItemShell>
          ))}
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "ویرایش راش تصویر" : "آپلود راش تصویر"}</DialogTitle>
            <DialogDescription>
              عکس یا فیلم خام با حجم بالا — حداکثر هر فایل {formatStorageBytes(RAW_MEDIA_MAX_FILE_BYTES)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>عنوان</Label>
              <Input
                value={title}
                maxLength={CONTENT_TITLE_MAX_LENGTH}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="نام محتوا"
              />
            </div>
            <div className="space-y-2">
              <Label>توضیحات</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="اختیاری"
              />
            </div>
            <div className="space-y-2">
              <Label>نوع فایل</Label>
              <Select
                value={mediaKind}
                onValueChange={(value) => {
                  setMediaKind(value as RawMediaKind);
                  if (!editingId) {
                    setUpload({ url: "", fileName: "", fileSize: 0, mimeType: "" });
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="image">تصویر</SelectItem>
                  <SelectItem value="video">ویدیو</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <PlanLabelSelect topics={contentTopics} plans={contentPlans} values={planLabels} onChangeMultiple={setPlanLabels} />
            <MediaUpload
              label={mediaKind === "video" ? "ویدیو خام" : "تصویر خام"}
              kind={mediaKind}
              uploadKind={mediaKind === "video" ? "raw-video" : "raw-image"}
              value={upload.url}
              fileOnly
              maxFileSizeBytes={RAW_MEDIA_MAX_FILE_BYTES}
              onChange={(url) => setUpload((prev) => ({ ...prev, url }))}
              onUploadedMeta={(meta) =>
                setUpload({
                  url: meta.url,
                  fileName: meta.fileName,
                  fileSize: meta.fileSize,
                  mimeType: meta.mimeType,
                })
              }
            />
            <Button className="w-full" disabled={isPending} onClick={handleSave}>
              ذخیره
            </Button>
            {editingId && (
              <Button
                type="button"
                variant="destructive"
                className="w-full"
                disabled={isPending}
                onClick={() => {
                  const current = items.find((item) => item.id === editingId);
                  if (current) handleDelete(current);
                }}
              >
                حذف راش
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
