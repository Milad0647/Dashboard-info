"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  CONTENT_TITLE_MAX_LENGTH,
  CONTENT_TITLE_MAX_LENGTH_MESSAGE,
} from "@/lib/content-constraints";
import { FileText, Plus, Video } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { adminOwnerTableColumn } from "@/components/admin/admin-owner-badge";
import { DocumentUpload } from "@/components/ui/document-upload";
import { MediaUpload } from "@/components/ui/media-upload";
import { PersianDateField } from "@/components/ui/persian-date-input";
import { deleteBroadcastReportAction, saveBroadcastReportAction } from "@/lib/actions/extended-actions";
import { resolveBroadcastMediaType, type BroadcastMediaType } from "@/lib/broadcast-media";
import { useAdminEditDeepLink } from "@/lib/hooks/use-admin-edit-deep-link";
import { useSectionCreateGate } from "@/lib/hooks/use-section-create-gate";
import { todayISO } from "@/lib/jalali";
import type { BroadcastReport } from "@/lib/types";
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

export function BroadcastAdmin({ campaignId, initialReports }: BroadcastAdminProps) {
  const { requestCreate, tutorialModal } = useSectionCreateGate("broadcast");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rows, setRows] = useState(initialReports);
  const [isPending, startTransition] = useTransition();

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

  return (
    <div className="space-y-4">
      {tutorialModal}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">گزارش پخش صدا و سیما</h1>
          <p className="text-sm text-muted-foreground">آپلود و انتشار گزارش PDF یا ویدیو</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          افزودن گزارش
        </Button>
      </div>

      <AdminDataTable
        data={rows}
        searchKeys={["title", "fileName"]}
        columns={[
          { key: "title", label: "عنوان" },
          adminOwnerTableColumn<BroadcastReport>(),
          { key: "reportDate", label: "تاریخ", render: (item) => formatPersianDate(item.reportDate) },
          {
            key: "fileName",
            label: "فایل",
            render: (item) => {
              const type = resolveBroadcastMediaType(item);
              return (
                <span className="inline-flex items-center gap-1.5">
                  {type === "video" ? (
                    <Video className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  {item.fileName}
                </span>
              );
            },
          },
        ]}
        onView={(item) => {
          if (item.pdfUrl) window.open(item.pdfUrl, "_blank");
        }}
        onEdit={openEdit}
        onDelete={(item) => {
          startTransition(async () => {
            await deleteBroadcastReportAction(item.id);
            setRows((prev) => prev.filter((row) => row.id !== item.id));
            toast.success("حذف شد");
          });
        }}
      />

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
                  value={form.watch("pdfUrl")}
                  coverImageUrl={form.watch("coverImageUrl")}
                  onChange={(url) => form.setValue("pdfUrl", url)}
                  onCoverImageUrlChange={(url) => form.setValue("coverImageUrl", url)}
                  onUploadedMeta={(meta) => {
                    form.setValue("pdfUrl", meta.url);
                    form.setValue("fileName", meta.fileName || "broadcast.mp4");
                    if (!form.getValues("title")) {
                      form.setValue(
                        "title",
                        meta.fileName?.replace(/\.(mp4|webm|mov|ogg)$/i, "") ?? "ویدیو پخش"
                      );
                    }
                  }}
                  accept="video/mp4,video/webm,video/quicktime"
                  showLinkInput={false}
                />
              ) : (
                <DocumentUpload
                  label="فایل PDF گزارش"
                  value={form.watch("pdfUrl")}
                  fileName={form.watch("fileName")}
                  onChange={(payload) => {
                    form.setValue("pdfUrl", payload.url);
                    form.setValue("fileName", payload.fileName || "report.pdf");
                    form.setValue("coverImageUrl", "");
                    if (!form.getValues("title")) {
                      form.setValue("title", payload.fileName?.replace(/\.pdf$/i, "") ?? "گزارش پخش");
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
    </div>
  );
}
