"use client";

import { useRef, useState } from "react";
import { ImageIcon, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface ImageFileDropzoneProps {
  value: File | null;
  onChange: (file: File | null) => void;
  label: string;
  required?: boolean;
  optionalHint?: string;
  disabled?: boolean;
}

export function ImageFileDropzone({
  value,
  onChange,
  label,
  required = false,
  optionalHint,
  disabled = false,
}: ImageFileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const setFile = (file: File | null) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
    onChange(file);
  };

  const handleFile = (file: File | null) => {
    if (!file || !file.type.startsWith("image/")) return;
    setFile(file);
  };

  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required ? " *" : optionalHint ? ` (${optionalHint})` : ""}
      </Label>

      <div
        onDragOver={(event) => {
          if (disabled) return;
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          if (disabled) return;
          event.preventDefault();
          setIsDragging(false);
          handleFile(event.dataTransfer.files?.[0] ?? null);
        }}
        className={cn(
          "rounded-xl border-2 border-dashed p-3 transition-colors",
          isDragging && "border-primary bg-primary/5",
          disabled && "pointer-events-none opacity-50"
        )}
      >
        {value && previewUrl ? (
          <div className="space-y-2">
            <div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="" className="h-full w-full object-cover" />
            </div>
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className="truncate">{value.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 shrink-0 px-2"
                onClick={() => setFile(null)}
              >
                <X className="h-3.5 w-3.5" />
                حذف
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <ImageIcon className="h-8 w-8 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">تصویر را بکشید و رها کنید یا انتخاب کنید</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              انتخاب تصویر
            </Button>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          handleFile(event.target.files?.[0] ?? null);
          if (inputRef.current) inputRef.current.value = "";
        }}
      />
    </div>
  );
}
