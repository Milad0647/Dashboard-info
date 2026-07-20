"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { adminOwnerTableColumn } from "@/components/admin/admin-owner-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { updateSubmissionAction, deleteSubmissionAction } from "@/lib/actions/admin-actions";
import { useSectionCreateGate } from "@/lib/hooks/use-section-create-gate";
import type { CampaignSubmission } from "@/lib/types";
import { formatPersianDate, formatPersianNumber, getStatusLabel, maskEmail, maskPhone } from "@/lib/utils";

interface SubmissionsAdminProps {
  campaignId: string;
  initialSubmissions: CampaignSubmission[];
}

export function SubmissionsAdmin({ campaignId, initialSubmissions }: SubmissionsAdminProps) {
  const { requestCreate, tutorialModal } = useSectionCreateGate("submissions");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [selected, setSelected] = useState<CampaignSubmission | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setSubmissions(initialSubmissions);
  }, [initialSubmissions]);

  const updateStatus = (id: string, status: "pending" | "approved" | "rejected", published?: boolean) => {
    startTransition(async () => {
      await updateSubmissionAction(id, { status, published });
      setSubmissions((prev) =>
        prev.map((s) =>
          s.id === id
            ? { ...s, status, published: published ?? (status === "approved"), updatedAt: new Date().toISOString() }
            : s
        )
      );
      toast.success("وضعیت بروزرسانی شد");
      setSelected(null);
    });
  };

  const runExcelUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("campaignId", campaignId);

      const response = await fetch("/api/submissions/import-excel", {
        method: "POST",
        body: formData,
      });

      const body = (await response.json().catch(() => null)) as {
        success?: boolean;
        created?: number;
        updated?: number;
        total?: number;
        error?: string;
      } | null;

      if (!response.ok || !body?.success) {
        throw new Error(body?.error ?? "آپلود Excel ناموفق بود");
      }

      toast.success(
        `${formatPersianNumber(body.created ?? 0)} مورد جدید · ${formatPersianNumber(body.updated ?? 0)} بروزرسانی از ${formatPersianNumber(body.total ?? 0)} ردیف`
      );
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "آپلود Excel ناموفق بود");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleExcelUpload = (file: File) => {
    void requestCreate(() => {
      void runExcelUpload(file);
    });
  };

  const openExcelPicker = () => {
    void requestCreate(() => {
      inputRef.current?.click();
    });
  };

  return (
    <div className="space-y-6">
      {tutorialModal}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-bold">مشارکت کاربران</h1>
          <p className="break-words text-sm text-muted-foreground">
            بررسی ارسال‌ها یا import از فایل Excel (ستون‌های uuid، title، caption، media_type، author_name و ...)
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="shrink-0 self-start"
          disabled={uploading}
          onClick={openExcelPicker}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          آپلود Excel
        </Button>
      </div>

      <div className="rounded-xl border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
        <div className="flex items-start gap-3">
          <FileSpreadsheet className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="space-y-1">
            <p className="font-medium text-foreground">فرمت فایل posts_*.xlsx</p>
            <p>
              هر بار فایل جدید آپلود کنید؛ ردیف‌های تکراری با همان uuid بروزرسانی می‌شوند و موارد جدید اضافه می‌شوند.
            </p>
          </div>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) handleExcelUpload(file);
        }}
      />

      <AdminDataTable
        data={submissions}
        searchKeys={["title", "participantName", "submissionType"]}
        columns={[
          { key: "title", label: "عنوان" },
          adminOwnerTableColumn<CampaignSubmission>(),
          { key: "participantName", label: "شرکت‌کننده" },
          { key: "submissionType", label: "نوع" },
          {
            key: "status",
            label: "وضعیت",
            render: (i) => <Badge status={i.status}>{getStatusLabel(i.status)}</Badge>,
          },
          {
            key: "createdAt",
            label: "تاریخ ثبت",
            render: (i) => formatPersianDate(i.createdAt),
          },
        ]}
        onView={(item) => setSelected(item)}
        onEdit={(item) => setSelected(item)}
        onDelete={(item) => {
          startTransition(async () => {
            await deleteSubmissionAction(item.id);
            setSubmissions((p) => p.filter((s) => s.id !== item.id));
            toast.success("حذف شد");
          });
        }}
      />

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>جزئیات ارسال</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">عنوان</p>
                <p className="break-words font-medium">{selected.title || "—"}</p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">نوع</p>
                  <p className="break-words">{selected.submissionType || "—"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">شرکت‌کننده</p>
                  <p className="break-words">{selected.participantName || "—"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">تلفن</p>
                  <p dir="ltr" className="break-all text-left">
                    {maskPhone(selected.participantPhone)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">ایمیل</p>
                  <p dir="ltr" className="break-all text-left">
                    {maskEmail(selected.participantEmail)}
                  </p>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">متن</p>
                <p className="whitespace-pre-wrap break-words rounded-lg bg-muted/40 p-3">
                  {selected.text?.trim() || "—"}
                </p>
              </div>
              {selected.mediaUrl && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">رسانه</p>
                  <a
                    href={selected.mediaUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex break-all text-primary underline"
                    dir="ltr"
                  >
                    مشاهده فایل
                  </a>
                </div>
              )}
              <div className="flex flex-wrap gap-2 border-t pt-4">
                <Button
                  size="sm"
                  onClick={() => updateStatus(selected.id, "approved", true)}
                  disabled={isPending}
                >
                  تأیید و انتشار
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => updateStatus(selected.id, "pending", false)}
                  disabled={isPending}
                >
                  در انتظار
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => updateStatus(selected.id, "rejected", false)}
                  disabled={isPending}
                >
                  رد
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
