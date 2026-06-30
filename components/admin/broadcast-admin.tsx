"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { adminOwnerTableColumn } from "@/components/admin/admin-owner-badge";
import { DocumentUpload } from "@/components/ui/document-upload";
import { PersianDateField } from "@/components/ui/persian-date-input";
import { deleteBroadcastReportAction, saveBroadcastReportAction } from "@/lib/actions/extended-actions";
import { todayISO } from "@/lib/jalali";
import type { BroadcastReport } from "@/lib/types";
import { formatPersianDate } from "@/lib/utils";

const schema = z.object({
  title: z.string().min(1),
  reportDate: z.string(),
  pdfUrl: z.string().min(1),
  fileName: z.string().min(1),
  notes: z.string().optional(),
  published: z.boolean(),
});

interface BroadcastAdminProps {
  campaignId: string;
  initialReports: BroadcastReport[];
}

export function BroadcastAdmin({ campaignId, initialReports }: BroadcastAdminProps) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rows, setRows] = useState(initialReports);
  const [isPending, startTransition] = useTransition();

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      reportDate: todayISO(),
      pdfUrl: "",
      fileName: "",
      notes: "",
      published: false,
    },
  });

  const openCreate = () => {
    setEditingId(null);
    form.reset({
      title: "",
      reportDate: todayISO(),
      pdfUrl: "",
      fileName: "",
      notes: "",
      published: false,
    });
    setOpen(true);
  };

  const openEdit = (report: BroadcastReport) => {
    setEditingId(report.id);
    form.reset({
      title: report.title,
      reportDate: report.reportDate,
      pdfUrl: report.pdfUrl,
      fileName: report.fileName,
      notes: report.summaryData.notes ?? "",
      published: report.published,
    });
    setOpen(true);
  };

  const onSubmit = form.handleSubmit((data) => {
    startTransition(async () => {
      const payload = {
        campaignId,
        id: editingId ?? undefined,
        title: data.title,
        reportDate: data.reportDate,
        pdfUrl: data.pdfUrl,
        fileName: data.fileName,
        published: data.published,
        summaryData: { notes: data.notes },
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
        summaryData: payload.summaryData,
        published: data.published,
        sortOrder: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setRows((prev) =>
        editingId ? prev.map((row) => (row.id === editingId ? { ...row, ...nextRow } : row)) : [...prev, nextRow]
      );
      toast.success("ذخیره شد");
      setOpen(false);
    });
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">گزارش پخش صدا و سیما</h1>
          <p className="text-sm text-muted-foreground">آپلود و انتشار گزارش PDF روزانه</p>
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
          { key: "fileName", label: "فایل" },
          { key: "published", label: "وضعیت", render: (item) => (item.published ? "منتشر" : "پیش‌نویس") },
        ]}
        onEdit={openEdit}
        onDelete={(item) => {
          startTransition(async () => {
            await deleteBroadcastReportAction(item.id);
            setRows((prev) => prev.filter((row) => row.id !== item.id));
            toast.success("حذف شد");
          });
        }}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "ویرایش گزارش" : "گزارش جدید"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>عنوان گزارش</Label>
              <Input {...form.register("title")} placeholder="مثلاً گزارش روزانه پخش" />
            </div>

            <PersianDateField control={form.control} name="reportDate" label="تاریخ گزارش" />

            <DocumentUpload
              label="فایل PDF گزارش"
              value={form.watch("pdfUrl")}
              fileName={form.watch("fileName")}
              onChange={(payload) => {
                form.setValue("pdfUrl", payload.url);
                form.setValue("fileName", payload.fileName || "report.pdf");
                if (!form.getValues("title")) {
                  form.setValue("title", payload.fileName?.replace(/\.pdf$/i, "") ?? "گزارش پخش");
                }
              }}
            />

            <div className="space-y-2">
              <Label>یادداشت (اختیاری)</Label>
              <Textarea {...form.register("notes")} placeholder="نکات تکمیلی برای نمایش در داشبورد" />
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={form.watch("published")} onCheckedChange={(value) => form.setValue("published", value)} />
              <Label>منتشر شود</Label>
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
