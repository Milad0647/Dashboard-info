"use client";

import { useRef, useState } from "react";
import { ImageIcon, Loader2, Trash2, Upload, Video } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  PROBLEM_REPORT_MAX_ATTACHMENTS,
  type ProblemReportAttachment,
  type ProblemReportAttachmentKind,
} from "@/lib/audit/problem-types";
import { cn, formatPersianNumber } from "@/lib/utils";

const ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif,video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${formatPersianNumber(bytes)} B`;
  if (bytes < 1024 * 1024) return `${formatPersianNumber(Math.round(bytes / 1024))} KB`;
  return `${formatPersianNumber(Math.round(bytes / (1024 * 1024)))} MB`;
}

function resolveKind(file: File): ProblemReportAttachmentKind | null {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (/\.(jpe?g|png|webp|gif)$/i.test(file.name)) return "image";
  if (/\.(mp4|webm|mov)$/i.test(file.name)) return "video";
  return null;
}

interface ProblemReportAttachmentsFieldProps {
  value: ProblemReportAttachment[];
  onChange: (attachments: ProblemReportAttachment[]) => void;
  disabled?: boolean;
}

export function ProblemReportAttachmentsField({
  value,
  onChange,
  disabled,
}: ProblemReportAttachmentsFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;

    const remaining = PROBLEM_REPORT_MAX_ATTACHMENTS - value.length;
    if (remaining <= 0) {
      toast.error(`حداکثر ${formatPersianNumber(PROBLEM_REPORT_MAX_ATTACHMENTS)} فایل مجاز است`);
      return;
    }

    const selected = list.slice(0, remaining);
    if (list.length > remaining) {
      toast.error(`فقط ${formatPersianNumber(remaining)} فایل دیگر می‌توانید اضافه کنید`);
    }

    setUploading(true);
    const uploaded: ProblemReportAttachment[] = [];

    try {
      for (const file of selected) {
        const kind = resolveKind(file);
        if (!kind) {
          toast.error(`فرمت «${file.name}» مجاز نیست — فقط تصویر یا ویدیو`);
          continue;
        }

        const maxBytes = kind === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
        if (file.size > maxBytes) {
          toast.error(
            kind === "image"
              ? `حجم تصویر «${file.name}» بیشتر از ۱۰ مگابایت است`
              : `حجم ویدیو «${file.name}» بیشتر از ۱۰۰ مگابایت است`
          );
          continue;
        }

        const formData = new FormData();
        formData.append("file", file);
        formData.append("kind", kind);

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? `آپلود «${file.name}» ناموفق بود`);
        }

        const data = (await response.json()) as {
          url: string;
          fileName: string;
          fileSize: number;
          mimeType: string;
        };

        uploaded.push({
          url: data.url,
          kind,
          fileName: data.fileName || file.name,
          fileSize: data.fileSize ?? file.size,
          mimeType: data.mimeType || file.type,
        });
      }

      if (uploaded.length > 0) {
        onChange([...value, ...uploaded]);
        toast.success(
          uploaded.length === 1
            ? "فایل با موفقیت آپلود شد"
            : `${formatPersianNumber(uploaded.length)} فایل آپلود شد`
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "آپلود ناموفق بود");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const removeAt = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="text-sm font-medium">اسکرین‌شات یا ویدیو (اختیاری)</label>
        <span className="text-xs text-muted-foreground">
          {formatPersianNumber(value.length)}/{formatPersianNumber(PROBLEM_REPORT_MAX_ATTACHMENTS)}
        </span>
      </div>

      <div
        className={cn(
          "rounded-xl border-2 border-dashed p-4 transition-colors",
          disabled && "pointer-events-none opacity-50"
        )}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          if (disabled || uploading) return;
          const files = event.dataTransfer.files;
          if (files?.length) void handleUpload(files);
        }}
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <Upload className="h-7 w-7 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            تصویر یا ویدیوی مشکل را بکشید و رها کنید یا انتخاب کنید
          </p>
          <p className="text-xs text-muted-foreground">
            تصویر تا ۱۰، ویدیو تا ۱۰۰ مگابایت — حداکثر{" "}
            {formatPersianNumber(PROBLEM_REPORT_MAX_ATTACHMENTS)} فایل
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || uploading || value.length >= PROBLEM_REPORT_MAX_ATTACHMENTS}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            انتخاب فایل
          </Button>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(event) => {
          const files = event.target.files;
          if (files?.length) void handleUpload(files);
        }}
      />

      {value.length > 0 && (
        <ul className="space-y-2">
          {value.map((item, index) => (
            <li
              key={`${item.url}-${index}`}
              className="flex items-center gap-3 rounded-lg border bg-muted/30 p-2"
            >
              <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-md bg-muted">
                {item.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element -- local upload preview
                  <img src={item.url} alt={item.fileName} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Video className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {item.kind === "image" ? "تصویر" : "ویدیو"}
                  {item.fileSize ? ` — ${formatFileSize(item.fileSize)}` : ""}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0"
                disabled={disabled || uploading}
                onClick={() => removeAt(index)}
                aria-label="حذف فایل"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface ProblemReportAttachmentsViewProps {
  attachments: ProblemReportAttachment[];
  className?: string;
}

export function ProblemReportAttachmentsView({
  attachments,
  className,
}: ProblemReportAttachmentsViewProps) {
  if (attachments.length === 0) return null;

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
        <ImageIcon className="h-3.5 w-3.5" />
        پیوست‌ها ({formatPersianNumber(attachments.length)})
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {attachments.map((item, index) => (
          <div
            key={`${item.url}-${index}`}
            className="overflow-hidden rounded-lg border bg-muted/20"
          >
            {item.kind === "image" ? (
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="block">
                {/* eslint-disable-next-line @next/next/no-img-element -- local upload preview */}
                <img
                  src={item.url}
                  alt={item.fileName}
                  className="aspect-video w-full object-cover"
                />
              </a>
            ) : (
              <video
                src={item.url}
                controls
                preload="metadata"
                className="aspect-video w-full bg-black"
              />
            )}
            <div className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-muted-foreground">
              {item.kind === "image" ? (
                <ImageIcon className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <Video className="h-3.5 w-3.5 shrink-0" />
              )}
              <span className="truncate">{item.fileName}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
