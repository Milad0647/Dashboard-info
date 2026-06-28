"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MediaPlaceholder } from "@/components/ui/media-placeholder";
import { isAparatVideoInput, isDirectVideoUrl, resolveVideoThumbnail } from "@/lib/media-utils";
import { cn } from "@/lib/utils";
import { Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

interface MediaUploadProps {
  value: string;
  onChange: (url: string) => void;
  onUploaded?: (url: string) => void;
  label?: string;
  kind?: "image" | "video" | "audio";
  accept?: string;
  dropzone?: boolean;
}

export function MediaUpload({
  value,
  onChange,
  onUploaded,
  label,
  kind = "image",
  accept,
  dropzone = true,
}: MediaUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleUpload = async (file: File) => {
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

      const data = (await response.json()) as { url: string };
      onChange(data.url);
      onUploaded?.(data.url);
      toast.success("فایل با موفقیت آپلود شد");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "آپلود ناموفق بود");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void handleUpload(file);
  };

  const placeholder =
    kind === "video"
      ? "کد embed آپارات را اینجا paste کنید، یا لینک/فایل ویدیو"
      : kind === "audio"
        ? "فایل صوتی را آپلود کنید یا لینک مستقیم وارد کنید"
        : "تصویر را بکشید و رها کنید یا لینک وارد کنید";

  const videoPreviewUrl = kind === "video" ? resolveVideoThumbnail(value) : null;

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}

      <div
        onDragOver={(event) => {
          if (!dropzone) return;
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={dropzone ? handleDrop : undefined}
        className={cn(
          "rounded-xl border-2 border-dashed p-3 transition-colors",
          dropzone && isDragging && "border-primary bg-primary/5",
          !dropzone && "border-transparent p-0"
        )}
      >
        {kind === "video" ? (
          <Textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onPaste={(event) => {
              const pasted = event.clipboardData.getData("text");
              if (!pasted.includes("aparat.com")) return;
              event.preventDefault();
              onChange(pasted.trim());
            }}
            dir="ltr"
            placeholder={placeholder}
            rows={4}
            className="min-h-24 font-mono text-xs"
          />
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={value}
              onChange={(event) => onChange(event.target.value)}
              dir="ltr"
              placeholder={placeholder}
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              className="shrink-0"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {dropzone ? "انتخاب فایل" : "آپلود"}
            </Button>
          </div>
        )}

        {kind === "audio" && (
          <div className="mt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              آپلود فایل صوتی
            </Button>
          </div>
        )}

        {kind === "video" && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              آپلود فایل
            </Button>
            {isAparatVideoInput(value) && (
              <span className="text-xs text-muted-foreground">کاور از آپارات گرفته می‌شود</span>
            )}
          </div>
        )}

        {dropzone && kind !== "video" && (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            فایل را اینجا بکشید و رها کنید
          </p>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept ?? (kind === "video" ? "video/*" : kind === "audio" ? "audio/*" : "image/*")}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleUpload(file);
        }}
      />

      {kind === "image" && (
        <div className="relative h-24 w-full overflow-hidden rounded-lg border bg-muted">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <MediaPlaceholder kind="image" className="h-24" />
          )}
        </div>
      )}

      {kind === "video" && (
        <div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-muted">
          {videoPreviewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={videoPreviewUrl} alt="" className="h-full w-full object-cover" />
          ) : value && isDirectVideoUrl(value) ? (
            <video src={value} className="h-full w-full object-cover" muted playsInline preload="metadata" />
          ) : (
            <MediaPlaceholder kind="video" className="h-full" />
          )}
        </div>
      )}

      {kind === "audio" && value && (
        <audio src={value} controls className="w-full" preload="metadata" />
      )}
    </div>
  );
}
