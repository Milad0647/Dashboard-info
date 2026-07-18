"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, formatPersianNumber } from "@/lib/utils";
import { FileText, Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

interface DocumentUploadProps {
  value: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  onChange: (payload: { url: string; fileName: string; fileSize: number; mimeType: string }) => void;
  label?: string;
  disabled?: boolean;
  /**
   * letter = PDF or image (official directive letter).
   * document = PDF/Office/text only (default).
   * attachment = image, video, or PDF/Office/text (activity downloadable files).
   */
  variant?: "document" | "letter" | "attachment";
  /**
   * card = large aspect-video dropzone (same feel as video upload).
   * compact = smaller dashed box (default).
   */
  layout?: "compact" | "card";
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${formatPersianNumber(bytes)} B`;
  if (bytes < 1024 * 1024) return `${formatPersianNumber(Math.round(bytes / 1024))} KB`;
  return `${formatPersianNumber(Math.round(bytes / (1024 * 1024)))} MB`;
}

const LETTER_ACCEPT =
  ".pdf,image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif,application/pdf";

const DOCUMENT_ACCEPT =
  ".pdf,.doc,.docx,.xls,.xlsx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain";

const ATTACHMENT_ACCEPT = [
  "image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif",
  "video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov",
  DOCUMENT_ACCEPT,
].join(",");

const MAX_ATTACHMENT_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_ATTACHMENT_VIDEO_BYTES = 100 * 1024 * 1024;
const MAX_ATTACHMENT_DOCUMENT_BYTES = 25 * 1024 * 1024;

function resolveAttachmentUploadKind(file: File): "image" | "video" | "document" | null {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (
    file.type === "application/pdf" ||
    file.type === "application/msword" ||
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.type === "application/vnd.ms-excel" ||
    file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    file.type === "text/plain" ||
    /\.(pdf|doc|docx|xls|xlsx|txt)$/i.test(file.name)
  ) {
    return "document";
  }
  return null;
}

export function DocumentUpload({
  value,
  fileName,
  fileSize,
  mimeType,
  onChange,
  label,
  disabled,
  variant = "document",
  layout = "compact",
}: DocumentUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const isLetter = variant === "letter";
  const isAttachment = variant === "attachment";
  const isCard = layout === "card";
  const hintText = isLetter
    ? "PDF یا تصویر نامه رسمی — حداکثر ۲۵ مگابایت"
    : isAttachment
      ? "تصویر، ویدیو، PDF، Word یا Excel — تصویر تا ۱۰، سند تا ۲۵، ویدیو تا ۱۰۰ مگابایت"
      : "PDF، Word، Excel یا فایل متنی — حداکثر ۲۵ مگابایت";
  const dragText = "فایل را بکشید و رها کنید یا انتخاب کنید";
  const accept = isLetter ? LETTER_ACCEPT : isAttachment ? ATTACHMENT_ACCEPT : DOCUMENT_ACCEPT;

  const handleUpload = async (file: File) => {
    if (isLetter) {
      const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
      const isImage = file.type.startsWith("image/");
      if (!isPdf && !isImage) {
        toast.error("فقط PDF یا تصویر مجاز است");
        return;
      }
    }

    let kind: "image" | "video" | "document" = "document";
    if (isAttachment) {
      const resolved = resolveAttachmentUploadKind(file);
      if (!resolved) {
        toast.error("فقط تصویر، ویدیو، PDF، Word یا Excel مجاز است");
        return;
      }
      kind = resolved;
      const maxBytes =
        kind === "image"
          ? MAX_ATTACHMENT_IMAGE_BYTES
          : kind === "video"
            ? MAX_ATTACHMENT_VIDEO_BYTES
            : MAX_ATTACHMENT_DOCUMENT_BYTES;
      if (file.size > maxBytes) {
        toast.error(
          kind === "image"
            ? "حجم تصویر بیشتر از ۱۰ مگابایت است"
            : kind === "video"
              ? "حجم ویدیو بیشتر از ۱۰۰ مگابایت است"
              : "حجم فایل بیشتر از ۲۵ مگابایت است"
        );
        return;
      }
    } else if (isLetter && file.type.startsWith("image/")) {
      kind = "image";
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("kind", kind);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "آپلود ناموفق بود");
      }

      const data = (await response.json()) as {
        url: string;
        fileName: string;
        fileSize: number;
        mimeType: string;
      };

      onChange(data);
      toast.success("فایل با موفقیت آپلود شد");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "آپلود ناموفق بود");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}

      <div
        role={isCard ? "button" : undefined}
        tabIndex={isCard ? 0 : undefined}
        onClick={
          isCard
            ? () => {
                if (uploading || disabled) return;
                inputRef.current?.click();
              }
            : undefined
        }
        onKeyDown={
          isCard
            ? (event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                if (uploading || disabled) return;
                inputRef.current?.click();
              }
            : undefined
        }
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          const file = event.dataTransfer.files?.[0];
          if (file) void handleUpload(file);
        }}
        className={cn(
          "rounded-xl border-2 border-dashed transition-colors",
          isCard ? "relative w-full cursor-pointer overflow-hidden p-0" : "p-4",
          isDragging && "border-primary bg-primary/5",
          disabled && "pointer-events-none opacity-50"
        )}
      >
        {isCard ? (
          <div className="relative aspect-video w-full overflow-hidden rounded-[10px] bg-muted">
            {value ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
                <FileText className="h-10 w-10 text-primary" />
                <p className="max-w-full truncate text-sm font-medium">{fileName ?? "فایل آپلود شده"}</p>
                <p className="text-xs text-muted-foreground">
                  {mimeType ?? "document"}
                  {fileSize ? ` — ${formatFileSize(fileSize)}` : ""}
                </p>
                <span className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-sm">
                  <Upload className="h-3.5 w-3.5" />
                  تعویض فایل
                </span>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-3 text-center text-sm text-muted-foreground">
                <FileText className="h-10 w-10" />
                <span className="text-sm">{dragText}</span>
                <span className="text-xs">{hintText}</span>
                <span className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-sm">
                  {uploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  انتخاب فایل
                </span>
              </div>
            )}
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-center">
            <FileText className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{hintText}</p>
            <Button
              type="button"
              variant="outline"
              disabled={uploading || disabled}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              انتخاب فایل
            </Button>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleUpload(file);
        }}
      />

      {!isCard && value && (
        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
          <p className="font-medium">{fileName ?? "فایل آپلود شده"}</p>
          <p className="text-xs text-muted-foreground">
            {mimeType ?? "document"} {fileSize ? `— ${formatFileSize(fileSize)}` : ""}
          </p>
          <Input value={value} readOnly dir="ltr" className="mt-2 text-xs" />
        </div>
      )}
    </div>
  );
}
