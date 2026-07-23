"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ClipboardCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAdminCampaign } from "@/components/admin/admin-campaign-provider";
import { DirectiveActionButton } from "@/components/admin/directive-action-button";
import { DirectiveFileLink } from "@/components/admin/directive-file-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  confirmDirectiveSeenAction,
  listUnreadDirectivesAction,
} from "@/lib/actions/directive-actions";
import { emitAdminModalLock } from "@/lib/admin-modal-lock";
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
      <DirectiveFileLink
        url={item.letterFileUrl}
        title={item.letterFileName || "نامه رسمی"}
        subtitle="دانلود / مشاهده نامه رسمی"
        fileName={item.letterFileName}
      />
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
              <DirectiveFileLink
                url={file.fileUrl}
                title={file.title || file.fileName}
                subtitle={
                  file.title && file.title !== file.fileName
                    ? file.fileName
                    : isImage || isVideo
                      ? `${isImage ? "تصویر" : "ویدیو"} — دانلود / مشاهده`
                      : "دانلود فایل"
                }
                fileName={file.fileName}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Ignore rapid alt-tab focus flaps; still refresh after real absence (incl. multi-hour return). */
const MIN_RETURN_REFRESH_MS = 2_000;
const POLL_MS = 90_000;
const LAST_ACTIVE_STORAGE_KEY = "directive-ack-last-active";

function readLastActiveAt(): number | null {
  try {
    const raw = window.sessionStorage.getItem(LAST_ACTIVE_STORAGE_KEY);
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function writeLastActiveAt(timestamp = Date.now()) {
  try {
    window.sessionStorage.setItem(LAST_ACTIVE_STORAGE_KEY, String(timestamp));
  } catch {
    // Ignore storage failures (private mode / quota).
  }
}

function sortUnreadDirectives(items: CampaignDirective[]): CampaignDirective[] {
  return [...items].sort((a, b) => {
    const aUrgent = a.priority === "urgent" ? 0 : 1;
    const bUrgent = b.priority === "urgent" ? 0 : 1;
    if (aUrgent !== bUrgent) return aUrgent - bUrgent;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

/**
 * Full-panel blocking gate: unread directives must be acknowledged with «دیدم»
 * before the user can continue using the admin panel.
 *
 * Triggers:
 * - Fresh login / any panel mount
 * - Window focus, tab visibility, or pageshow after being away
 * - Periodic poll for newly published directives
 *
 * Until every unread item is acknowledged, the overlay stays up (one at a time).
 */
export function DirectiveAckGate() {
  const router = useRouter();
  const { campaignId } = useAdminCampaign();
  const [queue, setQueue] = useState<CampaignDirective[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [isPending, startTransition] = useTransition();
  const hasLoadedOnceRef = useRef(false);

  const refreshQueue = useCallback(async () => {
    if (!campaignId) {
      setQueue([]);
      setLoaded(true);
      hasLoadedOnceRef.current = true;
      emitDirectivesUnreadChanged(0);
      return;
    }

    try {
      const result = await listUnreadDirectivesAction(campaignId);
      if (!result.success) {
        // Keep an already-loaded queue on transient auth/network errors.
        if (!hasLoadedOnceRef.current) {
          setQueue([]);
          emitDirectivesUnreadChanged(0);
          setLoaded(true);
        }
        return;
      }
      const sorted = sortUnreadDirectives(result.directives);
      setQueue(sorted);
      emitDirectivesUnreadChanged(sorted.length);
      hasLoadedOnceRef.current = true;
      setLoaded(true);
      writeLastActiveAt();
    } catch {
      if (!hasLoadedOnceRef.current) {
        setQueue([]);
        emitDirectivesUnreadChanged(0);
        setLoaded(true);
      }
    }
  }, [campaignId]);

  useEffect(() => {
    hasLoadedOnceRef.current = false;
    setLoaded(false);
    void refreshQueue();
  }, [refreshQueue]);

  useEffect(() => {
    let hiddenAt: number | null = document.visibilityState === "hidden" ? Date.now() : null;

    const maybeRefreshAfterReturn = () => {
      const now = Date.now();
      const lastActive = readLastActiveAt();
      const awayFromHidden = hiddenAt != null ? now - hiddenAt : 0;
      const awayFromStorage = lastActive != null ? now - lastActive : Number.POSITIVE_INFINITY;
      const awayMs = Math.max(awayFromHidden, awayFromStorage);

      // Covers login remounts, return after a few hours, and normal tab switches.
      if (awayMs >= MIN_RETURN_REFRESH_MS) {
        void refreshQueue();
      }
      writeLastActiveAt(now);
      hiddenAt = null;
    };

    const onFocus = () => {
      maybeRefreshAfterReturn();
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        writeLastActiveAt(hiddenAt);
        return;
      }
      maybeRefreshAfterReturn();
    };

    const onPageShow = () => {
      maybeRefreshAfterReturn();
    };

    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisibility);
    const timer = window.setInterval(() => {
      writeLastActiveAt();
      void refreshQueue();
    }, POLL_MS);

    writeLastActiveAt();

    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisibility);
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

  // Close every other admin Dialog/AlertDialog while this gate is visible.
  useEffect(() => {
    const blocking = Boolean(current);
    emitAdminModalLock(blocking, "directive-ack");
    return () => {
      if (blocking) emitAdminModalLock(false);
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
      className="fixed inset-0 z-[100]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="directive-ack-title"
    >
      {/* Separate blur layer — backdrop-filter on the interactive parent breaks clicks in some browsers */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-hidden="true" />

      <div className="relative flex h-full items-end justify-center p-0 sm:items-center sm:p-4">
        <div
          className={cn(
            "pointer-events-auto flex max-h-[100dvh] w-full max-w-2xl flex-col overflow-hidden bg-card shadow-2xl sm:max-h-[92vh] sm:rounded-2xl",
            isUrgent ? "ring-2 ring-red-500/60" : "ring-1 ring-border"
          )}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
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
              تا وقتی همه دستورکارهای دیده‌نشده را با «دیدم» تأیید نکنید، امکان ادامه کار با پنل نیست.
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
                <DirectiveActionButton item={current} openInNewTab />
              </div>
            )}
          </div>

          <footer className="shrink-0 space-y-2 border-t bg-muted/40 px-5 py-4">
            <Button
              type="button"
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
    </div>
  );
}
