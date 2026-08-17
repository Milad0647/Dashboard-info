"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AdminItemActions } from "@/components/admin/admin-item-actions";
import {
  SendContentMessageButton,
  type SendContentMessageTarget,
} from "@/components/admin/send-content-message-button";
import { ImageZoom } from "@/components/ui/image-zoom";
import { toCardThumbnailUrl } from "@/lib/card-image";
import { cn } from "@/lib/utils";

interface AdminContentPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  /** Optional low-size cover; falls back like public billboard cards. */
  previewImageUrl?: string | null;
  /** When set, replaces the default single-image preview (e.g. multi-media gallery). */
  mediaPreview?: ReactNode;
  /** Extra class for the dialog shell (e.g. a wider poster lightbox). */
  contentClassName?: string;
  /** Extra class for the default image frame. */
  imageContainerClassName?: string;
  /** Extra actions in the footer (e.g. download). */
  extraActions?: ReactNode;
  meta?: ReactNode;
  details?: Array<{ label: string; value?: ReactNode | null }>;
  onEdit?: () => void;
  onDelete?: () => void;
  deleteLabel?: string;
  /** When set, admin/کارفرما can send a message about this card. */
  messageTarget?: SendContentMessageTarget | null;
  canSendMessage?: boolean;
}

export function AdminContentPreviewDialog({
  open,
  onOpenChange,
  title,
  description,
  imageUrl,
  previewImageUrl,
  mediaPreview,
  contentClassName,
  imageContainerClassName,
  extraActions,
  meta,
  details = [],
  onEdit,
  onDelete,
  deleteLabel,
  messageTarget,
  canSendMessage = false,
}: AdminContentPreviewDialogProps) {
  const [zoomFailed, setZoomFailed] = useState(false);
  const showFooter = Boolean(
    onEdit || onDelete || extraActions || (canSendMessage && messageTarget)
  );
  const displayUrl = (imageUrl?.trim() || previewImageUrl?.trim() || "").trim();
  const fallbackSrc = displayUrl ? toCardThumbnailUrl(displayUrl) : "";

  useEffect(() => {
    setZoomFailed(false);
  }, [imageUrl, previewImageUrl]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn(
            "!flex max-h-[92vh] max-w-2xl flex-col gap-0 overflow-hidden p-0",
            contentClassName
          )}
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
        <DialogHeader className="shrink-0 border-b px-6 py-4 pe-12">
          <DialogTitle className="break-words text-base">{title}</DialogTitle>
          <DialogDescription className="sr-only">پیش‌نمایش محتوا</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden px-6 py-4">
          {mediaPreview ? (
            mediaPreview
          ) : imageUrl ? (
            <div
              className={cn(
                "relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-muted",
                imageContainerClassName
              )}
            >
              {!zoomFailed ? (
                <ImageZoom
                  src={imageUrl ?? ""}
                  previewSrc={imageUrl}
                  alt={title}
                  className="absolute inset-0 h-full w-full"
                  imgClassName="object-contain"
                  sizes="(max-width: 768px) 100vw, 42rem"
                  loading="eager"
                  preferFullImage
                  onError={() => setZoomFailed(true)}
                />
              ) : fallbackSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={fallbackSrc}
                  alt={title}
                  loading="eager"
                  decoding="async"
                  fetchPriority="high"
                  className="absolute inset-0 h-full w-full object-contain"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  تصویری ثبت نشده است
                </div>
              )}
            </div>
          ) : (
            <div className="flex aspect-[4/3] items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
              تصویری ثبت نشده است
            </div>
          )}

          {description ? (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
              {description}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">بدون توضیحات</p>
          )}

          {meta}

          {details.length > 0 && (
            <div className="grid gap-3 rounded-lg border bg-muted/20 p-4 text-sm sm:grid-cols-2">
              {details.map((detail) =>
                detail.value !== null && detail.value !== undefined && detail.value !== "" ? (
                  <div key={detail.label} className="space-y-1">
                    <p className="text-xs text-muted-foreground">{detail.label}</p>
                    <div className="break-words">{detail.value}</div>
                  </div>
                ) : null
              )}
            </div>
          )}
        </div>

        {showFooter && (
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t px-6 py-3">
            <div className="flex flex-wrap items-center gap-2">
              {canSendMessage && messageTarget ? (
                <SendContentMessageButton target={messageTarget} />
              ) : null}
              {extraActions}
            </div>
            {(onEdit || onDelete) && (
              <AdminItemActions
                onEdit={
                  onEdit
                    ? () => {
                        onOpenChange(false);
                        onEdit();
                      }
                    : undefined
                }
                onDelete={
                  onDelete
                    ? () => {
                        onOpenChange(false);
                        onDelete();
                      }
                    : undefined
                }
                deleteLabel={deleteLabel}
              />
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
