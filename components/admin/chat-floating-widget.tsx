"use client";

import { useEffect, useMemo, useState } from "react";
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
 * Professional store-style floating chat widget.
 * Mounted once from AdminPanelShell so it appears on every admin page.
 */
export function ChatFloatingWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [ready, setReady] = useState(false);
  const [canStartWithAnyone, setCanStartWithAnyone] = useState(false);
  const [conversations, setConversations] = useState<ChatConversationSummary[]>([]);
  const [loadingPanel, setLoadingPanel] = useState(false);
  const [isMobileLayout, setIsMobileLayout] = useState(false);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);

  const hidden =
    pathname === "/admin/login" ||
    pathname.startsWith("/admin/login/") ||
    pathname === "/admin/chat" ||
    pathname.startsWith("/admin/chat/");

  const supportOnline = useMemo(
    () => conversations.some((item) => item.peer.isOnline) || open,
    [conversations, open]
  );

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

  useEffect(() => {
    const media = window.matchMedia("(max-width: 639px)");
    const syncMedia = () => setIsMobileLayout(media.matches);
    syncMedia();
    media.addEventListener("change", syncMedia);

    const syncViewport = () => {
      const height = window.visualViewport?.height ?? window.innerHeight;
      setViewportHeight(height);
    };
    syncViewport();
    window.visualViewport?.addEventListener("resize", syncViewport);
    window.visualViewport?.addEventListener("scroll", syncViewport);
    window.addEventListener("resize", syncViewport);

    return () => {
      media.removeEventListener("change", syncMedia);
      window.visualViewport?.removeEventListener("resize", syncViewport);
      window.visualViewport?.removeEventListener("scroll", syncViewport);
      window.removeEventListener("resize", syncViewport);
    };
  }, []);

  const handleToggle = async () => {
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

  const mobilePanelHeight =
    viewportHeight != null
      ? Math.max(280, Math.min(viewportHeight - 16, viewportHeight - 8))
      : undefined;

  return (
    <div
      dir="rtl"
      className="pointer-events-none fixed bottom-4 left-4 z-[55] flex flex-col items-start md:bottom-6 md:left-6"
      data-chat-floating-widget
    >
      <div
        className={cn(
          "pointer-events-auto flex origin-bottom-left flex-col overflow-hidden",
          "border border-black/5 bg-card shadow-[var(--shadow-apple-hover)] backdrop-blur-xl dark:border-white/10",
          "transition-all duration-[var(--duration-apple)] ease-[var(--ease-apple-spring)]",
          // Mobile near-fullscreen sheet
          "fixed inset-x-2 z-[55] rounded-3xl sm:static sm:inset-auto sm:mb-3",
          // Desktop store widget size
          "sm:h-[520px] sm:w-[360px] sm:rounded-[24px]",
          open
            ? "translate-y-0 scale-100 opacity-100"
            : "pointer-events-none invisible translate-y-3 scale-[0.96] opacity-0"
        )}
        style={
          open && isMobileLayout && mobilePanelHeight
            ? {
                top: 8,
                height: mobilePanelHeight,
                maxHeight: mobilePanelHeight,
                bottom: "auto",
              }
            : undefined
        }
        aria-hidden={!open}
        role="dialog"
        aria-label="پشتیبانی آنلاین"
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
                supportOnline={supportOnline}
                onClose={() => setOpen(false)}
              />
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => void handleToggle()}
        aria-expanded={open}
        aria-label={open ? "بستن چت" : "باز کردن پشتیبانی آنلاین"}
        title={open ? "بستن" : "پشتیبانی آنلاین"}
        data-audit-label="چت شناور"
        className={cn(
          "pointer-events-auto relative flex items-center justify-center rounded-full",
          "h-[50px] w-[50px] md:h-14 md:w-14",
          "bg-primary text-primary-foreground",
          "shadow-[0_8px_28px_rgba(37,99,235,0.38)]",
          "transition-all duration-[var(--duration-apple)] ease-[var(--ease-apple-spring)]",
          "hover:-translate-y-1 hover:shadow-[0_14px_34px_rgba(37,99,235,0.45)]",
          "active:scale-[0.96]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "before:pointer-events-none before:absolute before:inset-0 before:rounded-full before:bg-gradient-to-b before:from-white/30 before:to-transparent"
        )}
      >
        <span className="relative z-[1]">
          {open ? (
            <X className="h-5 w-5 md:h-6 md:w-6" strokeWidth={2.25} />
          ) : (
            <MessageCircle className="h-5 w-5 md:h-6 md:w-6" strokeWidth={2.25} />
          )}
        </span>
        {!open && unread > 0 && (
          <span className="absolute -top-1 -end-1 z-[2] flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-background tabular-nums">
            {formatPersianNumber(Math.min(unread, 99))}
          </span>
        )}
      </button>
    </div>
  );
}
