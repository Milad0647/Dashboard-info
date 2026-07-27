"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageCircle, X } from "lucide-react";
import { ChatPanel } from "@/components/admin/chat-panel";
import {
  getMyUnreadChatCountAction,
  listChatConversationsAction,
} from "@/lib/actions/chat-actions";
import { getSessionContextAction } from "@/lib/actions/extended-actions";
import {
  CHAT_UNREAD_EVENT,
  emitChatUnreadChanged,
  readChatUnreadFromEvent,
} from "@/lib/chat-unread";
import type { ChatConversationSummary } from "@/lib/chat/types";
import { cn, formatPersianNumber } from "@/lib/utils";

/**
 * Apple-style floating chat launcher shown on every admin panel page
 * (except login / full chat page), similar to website live-chat widgets.
 */
export function ChatFloatingWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [ready, setReady] = useState(false);
  const [canStartWithAnyone, setCanStartWithAnyone] = useState(false);
  const [conversations, setConversations] = useState<ChatConversationSummary[]>([]);
  const [loadingPanel, setLoadingPanel] = useState(false);

  const hidden =
    pathname === "/admin/login" ||
    pathname.startsWith("/admin/login/") ||
    pathname === "/admin/chat" ||
    pathname.startsWith("/admin/chat/");

  useEffect(() => {
    let cancelled = false;

    getSessionContextAction("").then((session) => {
      if (cancelled || !session) return;
      const isAdmin = session.type === "env_admin" || session.role === "admin";
      setCanStartWithAnyone(isAdmin || session.role === "client");
      setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (hidden) return;

    let cancelled = false;

    const refresh = async () => {
      try {
        const result = await getMyUnreadChatCountAction();
        if (cancelled || !result.success) return;
        const count = result.count ?? 0;
        setUnread(count);
        emitChatUnreadChanged(count);
      } catch {
        if (!cancelled) setUnread(0);
      }
    };

    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, 30_000);

    const onUnread = (event: Event) => {
      const count = readChatUnreadFromEvent(event);
      if (count !== null) setUnread(count);
    };
    window.addEventListener(CHAT_UNREAD_EVENT, onUnread);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener(CHAT_UNREAD_EVENT, onUnread);
    };
  }, [hidden]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const handleOpen = async () => {
    const next = !open;
    setOpen(next);
    if (!next) return;

    setLoadingPanel(true);
    try {
      const result = await listChatConversationsAction();
      if (result.success) {
        setConversations(result.conversations ?? []);
        if (typeof result.unreadTotal === "number") {
          setUnread(result.unreadTotal);
          emitChatUnreadChanged(result.unreadTotal);
        }
      }
    } finally {
      setLoadingPanel(false);
    }
  };

  if (hidden || !ready) return null;

  return (
    <div
      className={cn(
        "fixed z-[55] flex flex-col items-end gap-3",
        // Clear the right sidebar on desktop; sit opposite the problem-report control.
        "bottom-5 left-5 lg:bottom-6 lg:left-auto lg:right-[17.5rem]"
      )}
    >
      <div
        className={cn(
          "origin-bottom overflow-hidden rounded-[28px] border border-black/5 bg-card/92 shadow-[var(--shadow-apple-hover)] backdrop-blur-2xl transition-all duration-[var(--duration-apple)] ease-[var(--ease-apple-spring)] dark:border-white/10",
          "lg:origin-bottom-right",
          open
            ? "h-[min(640px,calc(100dvh-7.5rem))] w-[min(400px,calc(100vw-2.5rem))] translate-y-0 scale-100 opacity-100"
            : "pointer-events-none h-0 w-0 translate-y-4 scale-95 opacity-0"
        )}
        aria-hidden={!open}
      >
        {open && (
          <div className="flex h-full min-h-0 flex-col">
            {loadingPanel ? (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                در حال آماده‌سازی چت…
              </div>
            ) : (
              <ChatPanel
                variant="widget"
                initialConversations={conversations}
                initialUnreadTotal={unread}
                canStartWithAnyone={canStartWithAnyone}
                onClose={() => setOpen(false)}
              />
            )}
          </div>
        )}
      </div>

      {/* Lift above «گزارش مشکل» on mobile (same corner); on desktop sits near sidebar edge. */}
      <button
        type="button"
        onClick={() => void handleOpen()}
        aria-label={open ? "بستن چت" : "باز کردن چت"}
        title={open ? "بستن چت" : "چت"}
        data-audit-label="چت شناور"
        className={cn(
          "apple-soft-pop group relative flex h-14 w-14 items-center justify-center rounded-full",
          "bg-primary text-primary-foreground",
          "shadow-[0_10px_30px_rgba(37,99,235,0.35)]",
          "transition-transform duration-[var(--duration-apple)] ease-[var(--ease-apple-spring)]",
          "hover:-translate-y-1 hover:shadow-[0_16px_36px_rgba(37,99,235,0.42)]",
          "active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "before:pointer-events-none before:absolute before:inset-0 before:rounded-full before:bg-gradient-to-b before:from-white/30 before:to-transparent",
          // Mobile: stack above problem-report button
          !open && "mb-[3.25rem] lg:mb-0"
        )}
      >
        <span className="relative z-[1]">
          {open ? <X className="h-6 w-6" strokeWidth={2.25} /> : <MessageCircle className="h-6 w-6" strokeWidth={2.25} />}
        </span>
        {!open && unread > 0 && (
          <span className="absolute -top-1 -end-1 z-[2] flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-background tabular-nums">
            {formatPersianNumber(unread > 99 ? 99 : unread)}
          </span>
        )}
      </button>
    </div>
  );
}
