"use client";

import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FileText, MessageSquare, Plus, Users } from "lucide-react";
import { toast } from "sonner";
import {
  CONTENT_TITLE_MAX_LENGTH,
  CONTENT_TITLE_MAX_LENGTH_MESSAGE,
} from "@/lib/content-constraints";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AdminCreatedAtText } from "@/components/admin/admin-created-at";
import {
  AdminContentFilterBar,
  DEFAULT_ADMIN_CONTENT_FILTER,
  sortAdminContentItems,
  type AdminContentFilterState,
} from "@/components/admin/admin-content-filter-bar";
import { AdminItemActions } from "@/components/admin/admin-item-actions";
import { AdminViewModeToggle } from "@/components/admin/admin-view-mode-toggle";
import { DocumentUpload } from "@/components/ui/document-upload";
import { PersianDateField } from "@/components/ui/persian-date-input";
import {
  deleteSmsSendReportAction,
  saveSmsSendReportAction,
} from "@/lib/actions/extended-actions";
import { useAdminEditDeepLink } from "@/lib/hooks/use-admin-edit-deep-link";
import { useAdminViewMode } from "@/lib/hooks/use-admin-view-mode";
import { useSectionCreateGate } from "@/lib/hooks/use-section-create-gate";
import { todayISO } from "@/lib/jalali";
import type { SmsSendReport } from "@/lib/types";
import { cn, formatPersianDate, formatPersianNumber } from "@/lib/utils";

const schema = z.object({
  title: z.string().min(1).max(CONTENT_TITLE_MAX_LENGTH, CONTENT_TITLE_MAX_LENGTH_MESSAGE),
  sendDate: z.string().min(1),
  recipientCount: z.coerce.number().int().min(1, "حداقل یک گیرنده لازم است"),
  messageBody: z.string().min(1, "متن پیام الزامی است"),
  evidenceFileUrl: z.string().optional(),
  evidenceFileName: z.string().optional(),
  evidenceMimeType: z.string().optional(),
  evidenceFileSize: z.coerce.number().optional(),
});

type FormValues = z.infer<typeof schema>;

interface SmsReportsAdminProps {
  campaignId: string;
  initialReports: SmsSendReport[];
}

function emptyFormValues(): FormValues {
  return {
    title: "",
    sendDate: todayISO(),
    recipientCount: 1,
    messageBody: "",
    evidenceFileUrl: "",
    evidenceFileName: "",
    evidenceMimeType: "",
    evidenceFileSize: 0,
  };
}

function reportToFormValues(report: SmsSendReport): FormValues {
  return {
    title: report.title,
    sendDate: report.sendDate,
    recipientCount: report.recipientCount,
    messageBody: report.messageBody,
    evidenceFileUrl: report.evidenceFileUrl ?? "",
    evidenceFileName: report.evidenceFileName ?? "",
    evidenceMimeType: report.evidenceMimeType ?? "",
    evidenceFileSize: report.evidenceFileSize ?? 0,
  };
}

function truncateMessage(text: string, max = 90): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

export function SmsReportsAdmin({ campaignId, initialReports }: SmsReportsAdminProps) {
  const { requestCreate, tutorialModal } = useSectionCreateGate("smsReports");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rows, setRows] = useState(initialReports);
  const [isPending, startTransition] = useTransition();
  const [contentFilter, setContentFilter] = useState<AdminContentFilterState>(DEFAULT_ADMIN_CONTENT_FILTER);
  const { viewMode, setViewMode } = useAdminViewMode("smsReports");
  const sortedRows = useMemo(
    () =>
      sortAdminContentItems(rows, contentFilter.sortOrder, (item) => item.sendDate || item.updatedAt || item.createdAt),
    [rows, contentFilter.sortOrder]
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyFormValues(),
  });

  const { highlightFields, setHighlightFields, resetDeepLink } = useAdminEditDeepLink({
    items: rows,
    getId: (row) => row.id,
    basePath: "/admin/sms-reports",
    onOpen: (report, fields) => {
      setEditingId(report.id);
      form.reset(reportToFormValues(report));
      setHighlightFields(fields);
      setOpen(true);
    },
  });

  const watchedTitle = form.watch("title");
  const watchedEvidenceUrl = form.watch("evidenceFileUrl");
  const watchedEvidenceName = form.watch("evidenceFileName");
  const highlightTitle = highlightFields.includes("title") && !watchedTitle?.trim();

  const openCreate = () => {
    void requestCreate(() => {
      setEditingId(null);
      setHighlightFields([]);
      form.reset(emptyFormValues());
      setOpen(true);
    });
  };

  const openEdit = (report: SmsSendReport) => {
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

  const handleViewEvidence = (report: SmsSendReport) => {
    if (report.evidenceFileUrl) {
      window.open(report.evidenceFileUrl, "_blank");
      return;
    }
    toast.message("مستند پیوست نشده است");
  };

  const handleDelete = (report: SmsSendReport) => {
    startTransition(async () => {
      const result = await deleteSmsSendReportAction(report.id);
      if (!result.success) {
        toast.error(result.error ?? "حذف نشد");
        return;
      }
      setRows((prev) => prev.filter((row) => row.id !== report.id));
      toast.success("حذف شد");
    });
  };

  const onSubmit = form.handleSubmit((data) => {
    startTransition(async () => {
      const payload = {
        campaignId,
        id: editingId ?? undefined,
        title: data.title.trim(),
        sendDate: data.sendDate,
        recipientCount: data.recipientCount,
        messageBody: data.messageBody.trim(),
        evidenceFileUrl: data.evidenceFileUrl?.trim() || null,
        evidenceFileName: data.evidenceFileName?.trim() || null,
        evidenceMimeType: data.evidenceMimeType?.trim() || null,
        evidenceFileSize: data.evidenceFileSize ?? 0,
        published: true,
      };

      const result = await saveSmsSendReportAction(payload);
      if (!result.success) {
        toast.error("error" in result ? result.error : "ذخیره نشد");
        return;
      }

      const savedId = "id" in result ? result.id : (editingId ?? crypto.randomUUID());
      const nextRow: SmsSendReport = {
        id: savedId,
        campaignId,
        title: payload.title,
        sendDate: payload.sendDate,
        recipientCount: payload.recipientCount,
        messageBody: payload.messageBody,
        evidenceFileUrl: payload.evidenceFileUrl,
        evidenceFileName: payload.evidenceFileName,
        evidenceMimeType: payload.evidenceMimeType,
        evidenceFileSize: payload.evidenceFileSize,
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
          <h1 className="text-2xl font-bold">ارسال پیام</h1>
          <p className="text-sm text-muted-foreground">
            ثبت گزارش ارسال پیامک به مخاطبان — عنوان، تعداد گیرندگان، متن پیام و مستند اختیاری
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AdminViewModeToggle value={viewMode} onChange={setViewMode} />
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            ثبت ارسال جدید
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
          هنوز گزارشی از ارسال پیام ثبت نشده است.
          <div className="mt-3 flex justify-center">
            <Button variant="outline" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              اولین گزارش را ثبت کنید
            </Button>
          </div>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sortedRows.map((report) => (
            <button
              key={report.id}
              type="button"
              onClick={() => openEdit(report)}
              className="rounded-xl border bg-card p-4 text-right transition hover:border-primary/40 hover:shadow-sm"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <AdminItemActions
                  onView={report.evidenceFileUrl ? () => handleViewEvidence(report) : undefined}
                  onEdit={() => openEdit(report)}
                  onDelete={() => handleDelete(report)}
                />
              </div>
              <p className="truncate font-medium">{report.title}</p>
              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                {formatPersianNumber(report.recipientCount)} نفر
                <span>·</span>
                {formatPersianDate(report.sendDate)}
              </p>
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                {truncateMessage(report.messageBody)}
              </p>
              {report.evidenceFileName ? (
                <p className="mt-2 flex items-center gap-1 truncate text-xs text-primary">
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  {report.evidenceFileName}
                </p>
              ) : null}
              <AdminCreatedAtText createdAt={report.createdAt} className="mt-2 text-xs" />
            </button>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          {sortedRows.map((report) => (
            <div
              key={report.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 last:border-b-0"
            >
              <div className="flex min-w-0 items-start gap-3">
                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium">{report.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatPersianNumber(report.recipientCount)} نفر · {formatPersianDate(report.sendDate)}
                    {report.evidenceFileName ? ` · ${report.evidenceFileName}` : ""}
                  </p>
                  <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                    {truncateMessage(report.messageBody, 120)}
                  </p>
                  <AdminCreatedAtText createdAt={report.createdAt} className="text-xs" />
                </div>
              </div>
              <AdminItemActions
                onView={report.evidenceFileUrl ? () => handleViewEvidence(report) : undefined}
                onEdit={() => openEdit(report)}
                onDelete={() => handleDelete(report)}
              />
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? setOpen(true) : closeDialog())}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "ویرایش گزارش ارسال" : "ثبت ارسال پیام"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className={cn(highlightTitle && "text-destructive")}>عنوان</Label>
              <Input
                {...form.register("title")}
                maxLength={CONTENT_TITLE_MAX_LENGTH}
                placeholder="مثلاً پیامک اطلاع‌رسانی مرحله اول"
                className={cn(highlightTitle && "border-destructive focus-visible:ring-destructive")}
              />
              {form.formState.errors.title ? (
                <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
              ) : null}
            </div>

            <PersianDateField control={form.control} name="sendDate" label="تاریخ ارسال" />

            <div className="space-y-2">
              <Label>تعداد گیرندگان</Label>
              <Input
                type="number"
                min={1}
                step={1}
                {...form.register("recipientCount")}
                placeholder="مثلاً ۵۰۰۰"
              />
              {form.formState.errors.recipientCount ? (
                <p className="text-xs text-destructive">{form.formState.errors.recipientCount.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>متن پیام ارسال‌شده</Label>
              <Textarea
                {...form.register("messageBody")}
                rows={5}
                placeholder="متن دقیق پیامکی که برای مخاطبان ارسال شده را وارد کنید"
              />
              {form.formState.errors.messageBody ? (
                <p className="text-xs text-destructive">{form.formState.errors.messageBody.message}</p>
              ) : null}
            </div>

            <DocumentUpload
              label="مستند ارسال (اختیاری)"
              layout="compact"
              variant="attachment"
              value={watchedEvidenceUrl ?? ""}
              fileName={watchedEvidenceName}
              onChange={(payload) => {
                form.setValue("evidenceFileUrl", payload.url, { shouldDirty: true });
                form.setValue("evidenceFileName", payload.fileName, { shouldDirty: true });
                form.setValue("evidenceMimeType", payload.mimeType, { shouldDirty: true });
                form.setValue("evidenceFileSize", payload.fileSize, { shouldDirty: true });
              }}
            />

            <Button type="submit" disabled={isPending} className="w-full">
              ذخیره
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
