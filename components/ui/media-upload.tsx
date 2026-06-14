"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MediaPlaceholder } from "@/components/ui/media-placeholder";
import { cn } from "@/lib/utils";
import { Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

interface MediaUploadProps {
  value: string;
  onChange: (url: string) => void;
  onUploaded?: (url: string) => void;
  label?: string;
  kind?: "image" | "video";
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
    kind === "video" ? "لینک آپارات/ویدیو یا فایل را بکشید و رها کنید" : "تصویر را بکشید و رها کنید یا لینک وارد کنید";

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

        {dropzone && (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            فایل را اینجا بکشید و رها کنید
          </p>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept ?? (kind === "video" ? "video/*" : "image/*")}
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
    </div>
  );
}
