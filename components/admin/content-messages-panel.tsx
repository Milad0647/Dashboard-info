"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import { ExternalLink, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  listMyContentMessagesAction,
  markMyContentMessagesSeenAction,
  replyContentMessageAction,
  type ContentMessageListItem,
} from "@/lib/actions/content-message-actions";
import { emitContentMessagesUnreadChanged } from "@/lib/content-messages-unread";
import { formatPersianDateTime } from "@/lib/utils";

function MessageCard({
  message,
  showRecipientHint,
  canReply,
  replying,
  onReply,
}: {
  message: ContentMessageListItem;
  showRecipientHint?: boolean;
  canReply?: boolean;
  replying?: boolean;
  onReply?: (messageId: string, body: string) => void;
}) {
  const [reply, setReply] = useState("");
  const followUpLabel =
    message.followUpStatus === "awaiting_user"
      ? "در انتظار پاسخ کاربر"
      : message.followUpStatus === "user_replied"
        ? "کاربر پاسخ داده"
        : message.followUpStatus === "resolved"
          ? "بسته‌شده"
          : "باز";
  return (
    <article
      className={`rounded-xl border p-4 ${
        message.isUnread && !showRecipientHint ? "border-primary/40 bg-primary/5" : "bg-card"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="text-[10px]">
              {message.contentTypeLabel}
            </Badge>
            {showRecipientHint && (
              <Badge variant="secondary" className="text-[10px]">
                {followUpLabel}
              </Badge>
            )}
            {message.isUnread && !showRecipientHint && (
              <Badge variant="default" className="text-[10px]">
                جدید
              </Badge>
            )}
          </div>
          <h3 className="font-medium leading-snug">{message.contentTitle || "بدون عنوان"}</h3>
          <p className="text-xs text-muted-foreground">
            {showRecipientHint
              ? `ارسال‌شده · ${formatPersianDateTime(message.createdAt)}`
              : `از ${message.senderName ?? "مدیر / کارفرما"} · ${formatPersianDateTime(message.createdAt)}`}
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" className="gap-1.5 shrink-0" asChild>
          <Link href={message.adminPath} prefetch={false}>
            <ExternalLink className="h-3.5 w-3.5" />
            مشاهده کارت
          </Link>
        </Button>
      </div>
      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed">{message.body}</p>
      {message.replies && message.replies.length > 0 && (
        <div className="mt-3 space-y-2 rounded-lg border bg-muted/40 p-3">
          {message.replies.map((replyItem) => (
            <div key={replyItem.id} className="rounded-md bg-background p-2 text-sm">
              <p className="text-xs text-muted-foreground">
                {replyItem.senderName ?? "کاربر"} · {formatPersianDateTime(replyItem.createdAt)}
              </p>
              <p className="mt-1 whitespace-pre-wrap">{replyItem.body}</p>
            </div>
          ))}
        </div>
      )}
      {canReply && onReply && (
        <div className="mt-3 space-y-2">
          <textarea
            className="w-full rounded-md border bg-background p-2 text-sm"
            rows={3}
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            placeholder="پاسخ شما به مدیر/کارفرما..."
          />
          <Button
            type="button"
            size="sm"
            disabled={replying}
            onClick={() => {
              const text = reply.trim();
              if (text.length < 3) {
                toast.error("متن پاسخ حداقل ۳ کاراکتر باشد");
                return;
              }
              onReply(message.id, text);
              setReply("");
            }}
          >
            ارسال پاسخ
          </Button>
        </div>
      )}
    </article>
  );
}

export function ContentMessagesPanel({
  campaignId,
  initialReceived = [],
  initialSent = [],
  canSend = false,
}: {
  campaignId: string;
  initialReceived?: ContentMessageListItem[];
  initialSent?: ContentMessageListItem[];
  canSend?: boolean;
}) {
  const [received, setReceived] = useState(initialReceived);
  const [sent, setSent] = useState(initialSent);
  const [canSendMessages, setCanSendMessages] = useState(canSend);
  const [replyingMessageId, setReplyingMessageId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const unreadCount = received.filter((item) => item.isUnread).length;
  const defaultTab = unreadCount > 0 || !canSend ? "inbox" : "sent";

  const refresh = useCallback(() => {
    startTransition(async () => {
      const result = await listMyContentMessagesAction({ campaignId });
      if (!result.success) {
        toast.error(result.error ?? "بارگذاری پیام‌ها ناموفق بود");
        return;
      }
      setReceived(result.received ?? []);
      setSent(result.sent ?? []);
      setCanSendMessages(Boolean(result.canSend));
      const nextUnread = (result.received ?? []).filter((item) => item.isUnread).length;
      emitContentMessagesUnreadChanged(nextUnread);
    });
  }, [campaignId]);

  const handleReply = (messageId: string, body: string) => {
    setReplyingMessageId(messageId);
    startTransition(async () => {
      const result = await replyContentMessageAction({ parentMessageId: messageId, body });
      setReplyingMessageId(null);
      if (!result.success) {
        toast.error(result.error ?? "ارسال پاسخ ناموفق بود");
        return;
      }
      toast.success("پاسخ ارسال شد");
      refresh();
    });
  };

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (unreadCount === 0) return;

    const timer = window.setTimeout(() => {
      void markMyContentMessagesSeenAction().then((result) => {
        if (!result.success) return;
        setReceived((prev) =>
          prev.map((item) => ({
            ...item,
            seenAt: item.seenAt ?? new Date().toISOString(),
            isUnread: false,
          }))
        );
        emitContentMessagesUnreadChanged(0);
      });
    }, 800);

    return () => window.clearTimeout(timer);
  }, [unreadCount, received.length]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">پیام‌های من</h1>
          <p className="text-sm text-muted-foreground">
            پیام‌های دریافتی و ارسال‌شده درباره کارت‌های محتوا — جدا از بخش آپلود محتوا
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={refresh}>
          بروزرسانی
        </Button>
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="inbox" className="gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" />
            دریافتی
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ms-1 h-5 min-w-5 px-1.5 text-[10px]">
                {unreadCount}
              </Badge>
            )}
          </TabsTrigger>
          {canSendMessages && <TabsTrigger value="sent">ارسال‌شده</TabsTrigger>}
        </TabsList>

        <TabsContent value="inbox" className="mt-4 space-y-3">
          {received.length === 0 ? (
            <div className="rounded-xl border py-12 text-center text-muted-foreground">
              پیامی برای شما ثبت نشده است.
            </div>
          ) : (
            received.map((message) => (
              <MessageCard
                key={message.id}
                message={message}
                canReply={!message.parentMessageId}
                replying={isPending && replyingMessageId === message.id}
                onReply={handleReply}
              />
            ))
          )}
        </TabsContent>

        {canSendMessages && (
          <TabsContent value="sent" className="mt-4 space-y-3">
            {sent.length === 0 ? (
              <div className="rounded-xl border py-12 text-center text-muted-foreground">
                هنوز پیامی ارسال نکرده‌اید. از اعلان‌ها یا پیش‌نمایش هر کارت می‌توانید پیام بفرستید.
              </div>
            ) : (
              sent.map((message) => (
                <MessageCard key={message.id} message={message} showRecipientHint />
              ))
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
