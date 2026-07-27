"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { ExternalLink, Loader2, MessageSquare, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listAllContentMessagesAction,
  type AdminContentMessageListItem,
} from "@/lib/actions/content-message-actions";
import { getAuditRoleLabel } from "@/lib/audit/labels";
import type { AuditUserPresence } from "@/lib/audit/types";
import { adminHref, formatPersianDateTime, formatPersianNumber } from "@/lib/utils";

function resolveUserLabel(name?: string | null, email?: string | null) {
  return name?.trim() || email?.trim() || "ناشناس";
}

function MessageRow({ message }: { message: AdminContentMessageListItem }) {
  const recipientLabel = resolveUserLabel(message.recipientName, message.recipientEmail);
  const senderLabel = message.senderName?.trim() || "مدیر سیستم";
  const senderRole = message.senderRole ? getAuditRoleLabel(message.senderRole) : null;

  return (
    <article
      className={`rounded-xl border p-4 ${
        message.isUnread ? "border-amber-500/40 bg-amber-500/5" : "bg-card"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="text-[10px]">
              {message.contentTypeLabel}
            </Badge>
            {message.isUnread ? (
              <Badge variant="warning" className="text-[10px]">
                خوانده‌نشده
              </Badge>
            ) : (
              <Badge variant="success" className="text-[10px]">
                خوانده‌شده
              </Badge>
            )}
          </div>
          <h3 className="font-medium leading-snug">{message.contentTitle || "بدون عنوان"}</h3>
          <div className="space-y-0.5 text-xs text-muted-foreground">
            <p>
              فرستنده: {senderLabel}
              {senderRole ? ` (${senderRole})` : ""}
            </p>
            <p>
              گیرنده: {recipientLabel}
              {message.recipientEmail &&
              message.recipientName?.trim() &&
              message.recipientEmail !== message.recipientName ? (
                <span className="ms-1" dir="ltr">
                  ({message.recipientEmail})
                </span>
              ) : null}
            </p>
            <p>{formatPersianDateTime(message.createdAt)}</p>
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" className="gap-1.5 shrink-0" asChild>
          <Link href={adminHref(message.adminPath, message.campaignId)} prefetch={false}>
            <ExternalLink className="h-3.5 w-3.5" />
            مشاهده کارت
          </Link>
        </Button>
      </div>
      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed">{message.body}</p>
    </article>
  );
}

export function AuditMessagesPanel({
  users = [],
}: {
  users?: AuditUserPresence[];
}) {
  const [messages, setMessages] = useState<AdminContentMessageListItem[]>([]);
  const [search, setSearch] = useState("");
  const [recipientUserId, setRecipientUserId] = useState<string>("all");
  const [isPending, startTransition] = useTransition();
  const [hasLoaded, setHasLoaded] = useState(false);

  const load = useCallback((filterUserId?: string) => {
    startTransition(async () => {
      const result = await listAllContentMessagesAction({
        recipientUserId: filterUserId && filterUserId !== "all" ? filterUserId : null,
        limit: 300,
      });
      if (!result.success) {
        toast.error(result.error ?? "بارگذاری پیام‌ها ناموفق بود");
        return;
      }
      setMessages(result.messages ?? []);
      setHasLoaded(true);
    });
  }, []);

  useEffect(() => {
    load(recipientUserId);
  }, [load, recipientUserId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter((message) => {
      const haystack = [
        message.body,
        message.contentTitle,
        message.contentTypeLabel,
        message.senderName,
        message.recipientName,
        message.recipientEmail,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [messages, search]);

  const unreadCount = useMemo(
    () => messages.filter((message) => message.isUnread).length,
    [messages]
  );

  const userOptions = useMemo(
    () =>
      [...users].sort((a, b) =>
        resolveUserLabel(a.name, a.email).localeCompare(
          resolveUserLabel(b.name, b.email),
          "fa"
        )
      ),
    [users]
  );

  return (
    <div className="space-y-4" dir="rtl">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="h-4 w-4" />
                همه پیام‌های کاربران
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                پیام‌های ارسال‌شده روی کارت‌های محتوا برای همه کاربران
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={isPending}
              onClick={() => load(recipientUserId)}
            >
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              بروزرسانی
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="جستجو در متن، فرستنده، گیرنده یا عنوان…"
              className="max-w-md"
            />
            <Select value={recipientUserId} onValueChange={setRecipientUserId}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="فیلتر گیرنده" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه گیرندگان</SelectItem>
                {userOptions.map((user) => (
                  <SelectItem key={user.userId} value={user.userId}>
                    {resolveUserLabel(user.name, user.email)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span>نمایش: {formatPersianNumber(filtered.length)}</span>
            <span>کل بارگذاری‌شده: {formatPersianNumber(messages.length)}</span>
            {unreadCount > 0 && (
              <span className="text-amber-700 dark:text-amber-400">
                خوانده‌نشده: {formatPersianNumber(unreadCount)}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {!hasLoaded && isPending ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border py-16 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          در حال بارگذاری پیام‌ها…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border py-16 text-center text-muted-foreground">
          پیامی یافت نشد.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((message) => (
            <MessageRow key={message.id} message={message} />
          ))}
        </div>
      )}
    </div>
  );
}
