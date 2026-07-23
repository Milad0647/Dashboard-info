"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Check, ClipboardCheck, Eye } from "lucide-react";
import { toast } from "sonner";
import { DirectiveActionButton } from "@/components/admin/directive-action-button";
import { DirectiveFileLink } from "@/components/admin/directive-file-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { confirmDirectiveSeenAction } from "@/lib/actions/directive-actions";
import {
  DIRECTIVES_UNREAD_EVENT,
  emitDirectivesUnreadChanged,
  readDirectivesConfirmedIdFromEvent,
} from "@/lib/directives-unread";
import { DIRECTIVE_OUTLINE_BUTTON_CLASS, DIRECTIVE_PRIMARY_BUTTON_CLASS, DIRECTIVE_TOAST_OPTIONS } from "@/lib/directive-ui";
import type { CampaignDirective, DirectiveAttachment } from "@/lib/types";
import { adminHref, cn, formatPersianDate, formatPersianDateTime, formatPersianNumber } from "@/lib/utils";

interface DashboardDirectivesPanelProps {
  campaignId: string;
  canManage: boolean;
  inboxDirectives: CampaignDirective[];
}

const PREVIEW_LIMIT = 5;

function extraAttachments(item: CampaignDirective): DirectiveAttachment[] {
  const letterUrl = item.letterFileUrl?.trim();
  if (!letterUrl) return item.attachments;
  return item.attachments.filter((file) => file.fileUrl !== letterUrl);
}

function OfficialLetterPreview({ item }: { item: CampaignDirective }) {
  if (!item.letterFileUrl) {
    return <p className="text-sm text-muted-foreground">نامه رسمی آپلود نشده</p>;
  }

  const isImage = Boolean(item.letterMimeType?.startsWith("image/"));

  return (
    <div className="space-y-2 rounded-lg border px-3 py-3">
      {isImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.letterFileUrl}
          alt={item.letterFileName || "نامه رسمی"}
          className="max-h-56 w-full rounded-md object-contain bg-muted/30"
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
  if (attachments.length === 0) {
    return <p className="text-sm text-muted-foreground">پیوستی ندارد</p>;
  }

  return (
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
                className="max-h-56 w-full rounded-md object-contain bg-muted"
              />
            ) : null}
            {isVideo ? (
              <video
                src={file.fileUrl}
                controls
                className="max-h-56 w-full rounded-md bg-black"
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
  );
}

function DirectiveDateRange({ item }: { item: CampaignDirective }) {
  const start = item.startDate;
  const end = item.endDate ?? item.dueDate;
  if (!start && !end) return null;
  return (
    <>
      {start && <span>شروع: {formatPersianDate(start)}</span>}
      {end && <span>پایان: {formatPersianDate(end)}</span>}
    </>
  );
}

export function DashboardDirectivesPanel({
  campaignId,
  canManage,
  inboxDirectives: initialInbox,
}: DashboardDirectivesPanelProps) {
  const [inboxRows, setInboxRows] = useState(initialInbox);
  const [detailItem, setDetailItem] = useState<CampaignDirective | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setInboxRows(initialInbox);
  }, [initialInbox]);

  useEffect(() => {
    const onUnreadEvent = (event: Event) => {
      const confirmedId = readDirectivesConfirmedIdFromEvent(event);
      if (!confirmedId) return;
      const seenAt = new Date().toISOString();
      setInboxRows((prev) =>
        prev.map((row) =>
          row.id === confirmedId ? { ...row, confirmed: true, seenAt } : row
        )
      );
      setDetailItem((current) =>
        current?.id === confirmedId ? { ...current, confirmed: true, seenAt } : current
      );
    };
    window.addEventListener(DIRECTIVES_UNREAD_EVENT, onUnreadEvent);
    return () => window.removeEventListener(DIRECTIVES_UNREAD_EVENT, onUnreadEvent);
  }, []);

  const unreadCount = useMemo(
    () => inboxRows.filter((row) => !row.confirmed).length,
    [inboxRows]
  );

  const previewRows = useMemo(() => {
    const sorted = [...inboxRows].sort((a, b) => {
      const aUnread = a.confirmed ? 1 : 0;
      const bUnread = b.confirmed ? 1 : 0;
      if (aUnread !== bUnread) return aUnread - bUnread;
      const aUrgent = a.priority === "urgent" ? 0 : 1;
      const bUrgent = b.priority === "urgent" ? 0 : 1;
      if (aUrgent !== bUrgent) return aUrgent - bUrgent;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return sorted.slice(0, PREVIEW_LIMIT);
  }, [inboxRows]);

  const confirmSeen = (item: CampaignDirective) => {
    startTransition(async () => {
      const result = await confirmDirectiveSeenAction(item.id, campaignId);
      if (!result.success) {
        toast.error(result.error ?? "ثبت مشاهده ناموفق بود");
        return;
      }
      setInboxRows((prev) => {
        const next = prev.map((row) =>
          row.id === item.id
            ? { ...row, confirmed: true, seenAt: new Date().toISOString() }
            : row
        );
        emitDirectivesUnreadChanged(next.filter((row) => !row.confirmed).length, item.id);
        return next;
      });
      setDetailItem((current) =>
        current?.id === item.id
          ? { ...current, confirmed: true, seenAt: new Date().toISOString() }
          : current
      );
      toast.success("مشاهده ثبت شد", DIRECTIVE_TOAST_OPTIONS);
    });
  };

  const directivesHref = adminHref("/admin/directives", campaignId);

  return (
    <>
      <Card className="border-red-500/50 bg-red-500/[0.06] shadow-md shadow-red-600/10">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0 pb-3">
          <div className="min-w-0 space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg font-extrabold text-red-700 dark:text-red-400">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-600 text-white shadow-sm">
                <ClipboardCheck className="h-5 w-5 shrink-0" />
              </span>
              دستورکارها
              {unreadCount > 0 && (
                <Badge variant="destructive">{formatPersianNumber(unreadCount)} جدید</Badge>
              )}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {unreadCount > 0
                ? "دستورکارهای جدید را ببینید و دکمه «دیدم» را بزنید"
                : inboxRows.length > 0
                  ? "همه دستورکارهای شما دیده‌شده‌اند"
                  : canManage
                    ? "هنوز دستورکاری برای شما نیست — از صفحه دستورکارها می‌توانید ایجاد کنید"
                    : "هنوز دستورکاری برای شما ارسال نشده است"}
            </p>
          </div>
          <Link href={directivesHref}>
            <Button
              size="sm"
              className={cn(
                unreadCount > 0 ? DIRECTIVE_PRIMARY_BUTTON_CLASS : DIRECTIVE_OUTLINE_BUTTON_CLASS
              )}
              variant={unreadCount > 0 ? "default" : "outline"}
            >
              مشاهده همه
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="space-y-3">
          {previewRows.length === 0 ? (
            <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              دستورکاری برای نمایش نیست
            </div>
          ) : (
            previewRows.map((item) => (
              <article
                key={item.id}
                className={cn(
                  "rounded-xl border bg-background p-4",
                  item.priority === "urgent" && "border-destructive/40",
                  !item.confirmed && "border-red-500/30"
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{item.title}</h3>
                      {item.priority === "urgent" && <Badge variant="destructive">فوری</Badge>}
                      {!item.confirmed ? (
                        <Badge>جدید</Badge>
                      ) : (
                        <Badge variant="secondary">دیده‌شده</Badge>
                      )}
                    </div>
                    <p className="line-clamp-2 whitespace-pre-wrap text-sm text-muted-foreground">
                      {item.body}
                    </p>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>
                        انتشار: {formatPersianDateTime(item.publishedAt ?? item.createdAt)}
                      </span>
                      <DirectiveDateRange item={item} />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => setDetailItem(item)}>
                      <Eye className="h-4 w-4" />
                      جزئیات
                    </Button>
                    {!item.confirmed && (
                      <Button
                        size="sm"
                        disabled={isPending}
                        onClick={() => confirmSeen(item)}
                        className={DIRECTIVE_PRIMARY_BUTTON_CLASS}
                      >
                        <Check className="h-4 w-4" />
                        دیدم
                      </Button>
                    )}
                  </div>
                </div>
              </article>
            ))
          )}

          {inboxRows.length > PREVIEW_LIMIT && (
            <p className="text-center text-xs text-muted-foreground">
              و{" "}
              {formatPersianNumber(inboxRows.length - PREVIEW_LIMIT)} مورد دیگر در صفحه
              دستورکارها
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(detailItem)} onOpenChange={(open) => !open && setDetailItem(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          {detailItem && (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2">
                  {detailItem.title}
                  {detailItem.priority === "urgent" && (
                    <Badge variant="destructive">فوری</Badge>
                  )}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="whitespace-pre-wrap text-sm leading-7">{detailItem.body}</p>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>
                    انتشار:{" "}
                    {formatPersianDateTime(detailItem.publishedAt ?? detailItem.createdAt)}
                  </span>
                  <DirectiveDateRange item={detailItem} />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">نامه رسمی</p>
                  <OfficialLetterPreview item={detailItem} />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">پیوست‌ها</p>
                  <AttachmentList attachments={extraAttachments(detailItem)} />
                </div>
                {detailItem.actionType !== "none" && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">اقدام</p>
                    <DirectiveActionButton item={detailItem} />
                  </div>
                )}
                {!detailItem.confirmed && (
                  <Button
                    className={cn("w-full sm:w-auto", DIRECTIVE_PRIMARY_BUTTON_CLASS)}
                    disabled={isPending}
                    onClick={() => confirmSeen(detailItem)}
                  >
                    <Check className="h-4 w-4" />
                    دیدم
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
