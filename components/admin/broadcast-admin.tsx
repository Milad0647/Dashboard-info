"use client";

import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  CONTENT_TITLE_MAX_LENGTH,
  CONTENT_TITLE_MAX_LENGTH_MESSAGE,
} from "@/lib/content-constraints";
import { FileText, Play, Plus, Upload, Video } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AdminBroadcastAddCard,
  AdminBroadcastCompactCard,
} from "@/components/admin/admin-broadcast-compact-card";
import {
  AdminContentFilterBar,
  DEFAULT_ADMIN_CONTENT_FILTER,
  sortAdminContentItems,
  type AdminContentFilterState,
} from "@/components/admin/admin-content-filter-bar";
import { AdminItemActions } from "@/components/admin/admin-item-actions";
import { AdminViewModeToggle } from "@/components/admin/admin-view-mode-toggle";
import { DocumentUpload } from "@/components/ui/document-upload";
import { MediaUpload } from "@/components/ui/media-upload";
import { VideoModal } from "@/components/media/video-modal";
import { VideoThumbnail } from "@/components/media/video-thumbnail";
import { PersianDateField } from "@/components/ui/persian-date-input";
import { deleteBroadcastReportAction, saveBroadcastReportAction } from "@/lib/actions/extended-actions";
import { resolveBroadcastMediaType, type BroadcastMediaType } from "@/lib/broadcast-media";
import { useAdminEditDeepLink } from "@/lib/hooks/use-admin-edit-deep-link";
import { useAdminViewMode } from "@/lib/hooks/use-admin-view-mode";
import { useSectionCreateGate } from "@/lib/hooks/use-section-create-gate";
import { todayISO } from "@/lib/jalali";
import type { BroadcastReport, VideoVersion } from "@/lib/types";
import { cn, formatPersianDate } from "@/lib/utils";

const schema = z.object({
  title: z.string().min(1).max(CONTENT_TITLE_MAX_LENGTH, CONTENT_TITLE_MAX_LENGTH_MESSAGE),
  reportDate: z.string(),
  mediaType: z.enum(["pdf", "video"]),
  pdfUrl: z.string().min(1),
  fileName: z.string().min(1),
  coverImageUrl: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface BroadcastAdminProps {
  campaignId: string;
  initialReports: BroadcastReport[];
}

function emptyFormValues(): FormValues {
  return {
    title: "",
    reportDate: todayISO(),
    mediaType: "pdf",
    pdfUrl: "",
    fileName: "",
    coverImageUrl: "",
    notes: "",
  };
}

function reportToFormValues(report: BroadcastReport): FormValues {
  return {
    title: report.title,
    reportDate: report.reportDate,
    mediaType: resolveBroadcastMediaType(report),
    pdfUrl: report.pdfUrl,
    fileName: report.fileName,
    coverImageUrl: report.summaryData.coverImageUrl ?? "",
    notes: report.summaryData.notes ?? "",
  };
}

function toBroadcastVideoVersion(report: BroadcastReport): VideoVersion {
  const cover = report.summaryData.coverImageUrl?.trim() || "";
  return {
    id: report.id,
    videoId: report.id,
    versionNumber: 1,
    videoUrl: report.pdfUrl,
    thumbnailUrl: cover,
    status: "final",
    isFinal: true,
    date: report.reportDate,
    createdAt: report.createdAt,
  };
}

export function BroadcastAdmin({ campaignId, initialReports }: BroadcastAdminProps) {
  const { requestCreate, tutorialModal } = useSectionCreateGate("broadcast");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rows, setRows] = useState(initialReports);
  const [previewReport, setPreviewReport] = useState<BroadcastReport | null>(null);
  const [isPending, startTransition] = useTransition();
  const [contentFilter, setContentFilter] = useState<AdminContentFilterState>(DEFAULT_ADMIN_CONTENT_FILTER);
  const { viewMode, setViewMode } = useAdminViewMode("broadcast");
  const sortedRows = useMemo(
    () =>
      sortAdminContentItems(rows, contentFilter.sortOrder, (item) => item.reportDate || item.updatedAt || item.createdAt),
    [rows, contentFilter.sortOrder]
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyFormValues(),
  });

  const { highlightFields, setHighlightFields, resetDeepLink } = useAdminEditDeepLink({
    items: rows,
    getId: (row) => row.id,
    basePath: "/admin/broadcast",
    onOpen: (report, fields) => {
      setEditingId(report.id);
      form.reset(reportToFormValues(report));
      setHighlightFields(fields);
      setOpen(true);
    },
  });

  const watchedTitle = form.watch("title");
  const watchedReportDate = form.watch("reportDate");
  const watchedPdfUrl = form.watch("pdfUrl");
  const watchedMediaType = form.watch("mediaType");
  const watchedFileName = form.watch("fileName");
  const watchedCoverImageUrl = form.watch("coverImageUrl");
  const highlightTitle = highlightFields.includes("title") && !watchedTitle?.trim();
  const highlightDate = highlightFields.includes("date") && !watchedReportDate?.trim();
  const highlightFile = highlightFields.includes("file") && !watchedPdfUrl?.trim();

  const setMediaType = (nextType: BroadcastMediaType) => {
    const currentType = form.getValues("mediaType");
    if (currentType === nextType) return;
    form.setValue("mediaType", nextType);
    form.setValue("pdfUrl", "");
    form.setValue("fileName", "");
    form.setValue("coverImageUrl", "");
  };

  const openCreate = () => {
    void requestCreate(() => {
      setEditingId(null);
      setHighlightFields([]);
      form.reset(emptyFormValues());
      setOpen(true);
    });
  };

  const openEdit = (report: BroadcastReport) => {
    setEditingId(report.id);
    setHighlightFields([]);
    form.reset(reportToFormValues(report));
    setOpen(true);
  };

  const closeDialog = () => {
    setOpen(false);
    setEditingId(null);
    resetDeepLink();
  };

  const handleView = (report: BroadcastReport) => {
    if (resolveBroadcastMediaType(report) === "video") {
      setPreviewReport(report);
      return;
    }
    if (report.pdfUrl) window.open(report.pdfUrl, "_blank");
  };

  const handleDelete = (report: BroadcastReport) => {
    startTransition(async () => {
      await deleteBroadcastReportAction(report.id);
      setRows((prev) => prev.filter((row) => row.id !== report.id));
      toast.success("حذف شد");
    });
  };

  const onSubmit = form.handleSubmit((data) => {
    startTransition(async () => {
      const summaryData = {
        notes: data.notes,
        mediaType: data.mediaType,
        ...(data.mediaType === "video" && data.coverImageUrl?.trim()
          ? { coverImageUrl: data.coverImageUrl.trim() }
          : {}),
      };

      const payload = {
        campaignId,
        id: editingId ?? undefined,
        title: data.title,
        reportDate: data.reportDate,
        pdfUrl: data.pdfUrl,
        fileName: data.fileName,
        published: true,
        summaryData,
      };

      const result = await saveBroadcastReportAction(payload);
      if (!result.success) {
        toast.error("ذخیره نشد");
        return;
      }

      const savedId = "id" in result ? result.id : (editingId ?? crypto.randomUUID());

      const nextRow: BroadcastReport = {
        id: savedId,
        campaignId,
        title: data.title,
        reportDate: data.reportDate,
        pdfUrl: data.pdfUrl,
        fileName: data.fileName,
        summaryData,
        published: true,
        sortOrder: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setRows((prev) =>
        editingId ? prev.map((row) => (row.id === editingId ? { ...row, ...nextRow } : row)) : [...prev, nextRow]
      );
      toast.success("ذخیره شد");
      closeDialog();
    });
  });

  const previewVersion = previewReport ? toBroadcastVideoVersion(previewReport) : null;

  return (
    <div className="space-y-4">
      {tutorialModal}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">گزارش پخش صدا و سیما</h1>
          <p className="text-sm text-muted-foreground">
            آپلود و انتشار گزارش PDF یا ویدیو — روی کارت کلیک کنید یا با + گزارش جدید بسازید
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AdminViewModeToggle value={viewMode} onChange={setViewMode} />
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            افزودن گزارش
          </Button>
        </div>
      </div>

      <AdminContentFilterBar
        filter={contentFilter}
        onChange={setContentFilter}
        users={[]}
        plans={[]}
      />

      {sortedRows.length === 0 ? (
        <div className="rounded-xl border px-4 py-8 text-center text-sm text-muted-foreground">
          هنوز گزارشی ثبت نشده است.
          <div className="mt-3 flex justify-center">
            <AdminBroadcastAddCard compact onClick={openCreate} />
          </div>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          <AdminBroadcastAddCard onClick={openCreate} />
          {sortedRows.map((report) => (
            <AdminBroadcastCompactCard
              key={report.id}
              report={report}
              onClick={() => openEdit(report)}
              onView={() => handleView(report)}
              onEdit={() => openEdit(report)}
              onDelete={() => handleDelete(report)}
            />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          {sortedRows.map((report) => {
            const type = resolveBroadcastMediaType(report);
            return (
              <div
                key={report.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 last:border-b-0"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-md bg-muted">
                    {type === "video" ? (
                      <>
                        <VideoThumbnail
                          videoUrl={report.pdfUrl}
                          thumbnailUrl={report.summaryData.coverImageUrl}
                          alt={report.title}
                          className="object-cover"
                          sizes="96px"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                          <Play className="h-5 w-5 text-white" />
                        </div>
                      </>
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{report.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatPersianDate(report.reportDate)}
                      {report.fileName ? ` · ${report.fileName}` : ""}
                    </p>
                  </div>
                </div>
                <AdminItemActions
                  onView={() => handleView(report)}
                  onEdit={() => openEdit(report)}
                  onDelete={() => handleDelete(report)}
                />
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? setOpen(true) : closeDialog())}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "ویرایش گزارش" : "گزارش جدید"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className={cn(highlightTitle && "text-destructive")}>عنوان گزارش</Label>
              <Input
                {...form.register("title")}
                maxLength={CONTENT_TITLE_MAX_LENGTH}
                placeholder="مثلاً گزارش روزانه پخش"
                className={cn(highlightTitle && "border-destructive focus-visible:ring-destructive")}
              />
              {highlightTitle && (
                <p className="text-xs text-destructive">عنوان خالی است؛ لطفاً تکمیل کنید.</p>
              )}
            </div>

            <div className={cn(highlightDate && "rounded-lg border border-destructive bg-destructive/5 p-3")}>
              <PersianDateField control={form.control} name="reportDate" label="تاریخ گزارش" />
              {highlightDate && (
                <p className="mt-1 text-xs text-destructive">تاریخ گزارش خالی است؛ لطفاً انتخاب کنید.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>نوع فایل</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={watchedMediaType === "pdf" ? "default" : "outline"}
                  onClick={() => setMediaType("pdf")}
                >
                  <FileText className="h-4 w-4" />
                  PDF
                </Button>
                <Button
                  type="button"
                  variant={watchedMediaType === "video" ? "default" : "outline"}
                  onClick={() => setMediaType("video")}
                >
                  <Video className="h-4 w-4" />
                  ویدیو
                </Button>
              </div>
            </div>

            <div
              className={cn(
                highlightFile && "rounded-lg border border-destructive bg-destructive/5 p-3"
              )}
            >
              {watchedMediaType === "video" ? (
                <MediaUpload
                  label="فایل ویدیو"
                  kind="video"
                  fileOnly
                  value={watchedPdfUrl}
                  coverImageUrl={watchedCoverImageUrl}
                  onChange={(url) => form.setValue("pdfUrl", url, { shouldDirty: true, shouldValidate: true })}
                  onCoverImageUrlChange={(url) =>
                    form.setValue("coverImageUrl", url, { shouldDirty: true })
                  }
                  onUploadedMeta={(meta) => {
                    form.setValue("pdfUrl", meta.url, { shouldDirty: true, shouldValidate: true });
                    form.setValue("fileName", meta.fileName || "broadcast.mp4", { shouldDirty: true });
                    if (!form.getValues("title")) {
                      form.setValue(
                        "title",
                        meta.fileName?.replace(/\.(mp4|webm|mov|ogg)$/i, "") ?? "ویدیو پخش",
                        { shouldDirty: true }
                      );
                    }
                  }}
                  accept="video/mp4,video/webm,video/quicktime"
                  showPreview={false}
                  showLinkInput={false}
                  dropzoneContent={
                    <div
                      className={cn(
                        "relative aspect-video w-full overflow-hidden rounded-[10px] bg-muted",
                        highlightFile && "ring-2 ring-destructive ring-offset-2"
                      )}
                    >
                      {watchedPdfUrl ? (
                        watchedCoverImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={watchedCoverImageUrl}
                            alt={watchedTitle || "ویدیو"}
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <video
                            key={watchedPdfUrl}
                            src={watchedPdfUrl}
                            className="h-full w-full object-contain"
                            controls
                            playsInline
                            preload="metadata"
                          />
                        )
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center gap-2 px-3 text-center text-sm text-muted-foreground">
                          <Video className="h-10 w-10" />
                          <span className="text-sm">ویدیو را بکشید و رها کنید یا انتخاب کنید</span>
                          <span className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-sm">
                            <Upload className="h-3.5 w-3.5" />
                            انتخاب ویدیو
                          </span>
                        </div>
                      )}
                      {watchedPdfUrl && watchedCoverImageUrl ? (
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
                          <Play className="h-12 w-12 text-white drop-shadow-lg" />
                        </div>
                      ) : null}
                      {watchedFileName ? (
                        <div className="absolute inset-x-0 bottom-0 bg-black/55 px-2 py-1 text-[10px] text-white">
                          <span className="block truncate">{watchedFileName}</span>
                        </div>
                      ) : null}
                    </div>
                  }
                />
              ) : (
                <DocumentUpload
                  label="فایل PDF گزارش"
                  layout="card"
                  value={watchedPdfUrl}
                  fileName={watchedFileName}
                  onChange={(payload) => {
                    form.setValue("pdfUrl", payload.url, { shouldDirty: true, shouldValidate: true });
                    form.setValue("fileName", payload.fileName || "report.pdf", { shouldDirty: true });
                    form.setValue("coverImageUrl", "");
                    if (!form.getValues("title")) {
                      form.setValue("title", payload.fileName?.replace(/\.pdf$/i, "") ?? "گزارش پخش", {
                        shouldDirty: true,
                      });
                    }
                  }}
                />
              )}
              {highlightFile && (
                <p className="mt-2 text-xs text-destructive">
                  {watchedMediaType === "video"
                    ? "ویدیو هنوز آپلود نشده است."
                    : "فایل PDF هنوز آپلود نشده است."}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>یادداشت (اختیاری)</Label>
              <Textarea {...form.register("notes")} placeholder="نکات تکمیلی برای نمایش در داشبورد" />
            </div>

            <Button type="submit" disabled={isPending} className="w-full">
              ذخیره
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {previewVersion && previewReport && (
        <VideoModal
          open={Boolean(previewReport)}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setPreviewReport(null);
          }}
          title={previewReport.title}
          versions={[previewVersion]}
          initialVersionId={previewVersion.id}
          description={previewReport.summaryData.notes}
          category="ویدیو پخش"
        />
      )}
    </div>
  );
}
