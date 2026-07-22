"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ClipboardCheck, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAdminCampaign } from "@/components/admin/admin-campaign-provider";
import { DirectiveActionButton } from "@/components/admin/directive-action-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  confirmDirectiveSeenAction,
  listUnreadDirectivesAction,
} from "@/lib/actions/directive-actions";
import { emitDirectivesUnreadChanged } from "@/lib/directives-unread";
import type { CampaignDirective, DirectiveAttachment } from "@/lib/types";
import { cn, formatPersianDate, formatPersianDateTime, formatPersianNumber } from "@/lib/utils";

function extraAttachments(item: CampaignDirective): DirectiveAttachment[] {
  const letterUrl = item.letterFileUrl?.trim();
  if (!letterUrl) return item.attachments;
  return item.attachments.filter((file) => file.fileUrl !== letterUrl);
}

function OfficialLetterPreview({ item }: { item: CampaignDirective }) {
  if (!item.letterFileUrl) return null;

  const isImage = Boolean(item.letterMimeType?.startsWith("image/"));

  return (
    <div className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-3 py-3">
      <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">نامه رسمی</p>
      {isImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.letterFileUrl}
          alt={item.letterFileName || "نامه رسمی"}
          className="max-h-72 w-full rounded-md object-contain bg-background/60"
        />
      )}
      <a
        href={item.letterFileUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-start gap-2 text-sm text-primary hover:underline"
      >
        <Download className="mt-0.5 h-4 w-4 shrink-0" />
        <span className="min-w-0">
          <span className="block font-medium text-foreground">
            {item.letterFileName || "نامه رسمی"}
          </span>
          <span className="block text-xs text-muted-foreground">باز کردن در تب جدید</span>
        </span>
      </a>
    </div>
  );
}

function AttachmentList({ attachments }: { attachments: DirectiveAttachment[] }) {
  if (attachments.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">پیوست‌ها</p>
      <ul className="space-y-3">
        {attachments.map((file) => {
          const isImage = file.mimeType.startsWith("image/");
          const isVideo = file.mimeType.startsWith("video/");

          return (
            <li key={file.id} className="space-y-2 rounded-lg border px-3 py-2">
              {isImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={file.fileUrl}
                  alt={file.title || file.fileName}
                  className="max-h-48 w-full rounded-md object-contain bg-muted"
                />
              ) : null}
              {isVideo ? (
                <video
                  src={file.fileUrl}
                  controls
                  className="max-h-48 w-full rounded-md bg-black"
                />
              ) : null}
              <a
                href={file.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-start gap-2 text-sm text-primary hover:underline"
              >
                <Download className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="min-w-0">
                  <span className="block font-medium text-foreground">
                    {file.title || file.fileName}
                  </span>
                  {file.title && file.title !== file.fileName && (
                    <span className="block text-xs text-muted-foreground">{file.fileName}</span>
                  )}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Full-panel blocking gate: unread directives must be acknowledged with «دیدم»
 * before the user can continue using the admin panel.
 */
export function DirectiveAckGate() {
  const router = useRouter();
  const { campaignId } = useAdminCampaign();
  const [queue, setQueue] = useState<CampaignDirective[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [isPending, startTransition] = useTransition();

  const refreshQueue = useCallback(async () => {
    if (!campaignId) {
      setQueue([]);
      setLoaded(true);
      emitDirectivesUnreadChanged(0);
      return;
    }

    try {
      const result = await listUnreadDirectivesAction(campaignId);
      if (!result.success) {
        setQueue([]);
        emitDirectivesUnreadChanged(0);
        return;
      }
      const sorted = [...result.directives].sort((a, b) => {
        const aUrgent = a.priority === "urgent" ? 0 : 1;
        const bUrgent = b.priority === "urgent" ? 0 : 1;
        if (aUrgent !== bUrgent) return aUrgent - bUrgent;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      setQueue(sorted);
      emitDirectivesUnreadChanged(sorted.length);
    } catch {
      setQueue([]);
      emitDirectivesUnreadChanged(0);
    } finally {
      setLoaded(true);
    }
  }, [campaignId]);

  useEffect(() => {
    setLoaded(false);
    void refreshQueue();
  }, [refreshQueue]);

  useEffect(() => {
    const onFocus = () => {
      void refreshQueue();
    };
    window.addEventListener("focus", onFocus);
    const timer = window.setInterval(() => {
      void refreshQueue();
    }, 90_000);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearInterval(timer);
    };
  }, [refreshQueue]);

  const current = queue[0] ?? null;
  const remaining = queue.length;
  const position = remaining > 0 ? 1 : 0;

  useEffect(() => {
    if (!current) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [current]);

  const confirmSeen = () => {
    if (!current || !campaignId) return;

    startTransition(async () => {
      const result = await confirmDirectiveSeenAction(current.id, campaignId);
      if (!result.success) {
        toast.error(result.error ?? "ثبت مشاهده ناموفق بود");
        return;
      }

      setQueue((prev) => {
        const next = prev.filter((row) => row.id !== current.id);
        emitDirectivesUnreadChanged(next.length, current.id);
        return next;
      });
      toast.success("مشاهده ثبت شد");
      router.refresh();
    });
  };

  if (!loaded || !current) return null;

  const extras = extraAttachments(current);
  const start = current.startDate;
  const end = current.endDate ?? current.dueDate;
  const isUrgent = current.priority === "urgent";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="directive-ack-title"
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div
        className={cn(
          "flex max-h-[100dvh] w-full max-w-2xl flex-col overflow-hidden bg-card shadow-2xl sm:max-h-[92vh] sm:rounded-2xl",
          isUrgent ? "ring-2 ring-red-500/60" : "ring-1 ring-border"
        )}
      >
        <header
          className={cn(
            "shrink-0 space-y-2 border-b px-5 py-4",
            isUrgent
              ? "bg-red-600 text-white"
              : "bg-gradient-to-l from-red-600/10 to-transparent"
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ClipboardCheck className="h-5 w-5 shrink-0" />
              <span>دستورکار جدید — مشاهده الزامی</span>
            </div>
            {remaining > 1 && (
              <Badge
                variant={isUrgent ? "secondary" : "destructive"}
                className={cn(isUrgent && "bg-white/20 text-white hover:bg-white/25")}
              >
                {formatPersianNumber(position)} از {formatPersianNumber(remaining)}
              </Badge>
            )}
          </div>
          <p
            className={cn(
              "text-sm",
              isUrgent ? "text-white/90" : "text-muted-foreground"
            )}
          >
            برای ادامه کار با پنل، باید این دستورکار را ببینید و دکمه «دیدم» را بزنید.
          </p>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="directive-ack-title" className="text-xl font-bold leading-snug">
                {current.title}
              </h2>
              {isUrgent && <Badge variant="destructive">فوری</Badge>}
            </div>
            <p className="whitespace-pre-wrap text-sm leading-7 text-foreground/90">
              {current.body}
            </p>
          </div>

          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span>
              انتشار: {formatPersianDateTime(current.publishedAt ?? current.createdAt)}
            </span>
            {start && <span>شروع: {formatPersianDate(start)}</span>}
            {end && <span>پایان: {formatPersianDate(end)}</span>}
            {current.createdByName && <span>از طرف: {current.createdByName}</span>}
          </div>

          <OfficialLetterPreview item={current} />
          <AttachmentList attachments={extras} />

          {current.actionType !== "none" && (
            <div className="space-y-2">
              <p className="text-sm font-semibold">اقدام مرتبط</p>
              <DirectiveActionButton item={current} />
            </div>
          )}
        </div>

        <footer className="shrink-0 space-y-2 border-t bg-muted/40 px-5 py-4">
          <Button
            size="lg"
            className="h-12 w-full text-base font-bold"
            disabled={isPending}
            onClick={confirmSeen}
          >
            {isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Check className="h-5 w-5" />
            )}
            دیدم
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            با زدن این دکمه، مشاهده شما برای مدیر ثبت می‌شود
          </p>
        </footer>
      </div>
    </div>
  );
}
