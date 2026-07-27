"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  emitChatWidgetOpenChanged,
} from "@/lib/chat-widget-open";
import type { ChatConversationSummary } from "@/lib/chat/types";
import { cn, formatPersianNumber } from "@/lib/utils";

/**
 * Professional store-style floating chat widget.
 * Mounted once from AdminPanelShell so it appears on every admin page.
 * Launcher stays physically bottom-left; panel opens above it (desktop)
 * or as a near-fullscreen sheet (mobile).
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
  const openRef = useRef(false);
  const unreadRef = useRef(0);
  const autoOpenLockRef = useRef(false);

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
    openRef.current = open;
    emitChatWidgetOpenChanged(open);
  }, [open]);

  useEffect(() => {
    return () => {
      emitChatWidgetOpenChanged(false);
    };
  }, []);

  useEffect(() => {
    unreadRef.current = unread;
  }, [unread]);

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

  const openWidget = async () => {
    setOpen(true);
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

  const applyUnreadCount = (count: number, options?: { autoOpen?: boolean }) => {
    const previous = unreadRef.current;
    setUnread(count);
    emitChatUnreadChanged(count);

    const shouldAutoOpen =
      Boolean(options?.autoOpen) &&
      !hidden &&
      !openRef.current &&
      count > previous &&
      count > 0 &&
      !autoOpenLockRef.current;

    if (shouldAutoOpen) {
      autoOpenLockRef.current = true;
      void openWidget().finally(() => {
        window.setTimeout(() => {
          autoOpenLockRef.current = false;
        }, 1500);
      });
    }
  };

  useEffect(() => {
    if (hidden) return;

    let cancelled = false;

    const refresh = async () => {
      try {
        const result = await getMyUnreadChatCountAction();
        if (cancelled || !result.success) return;
        applyUnreadCount(result.count ?? 0, { autoOpen: true });
      } catch {
        if (!cancelled) setUnread(0);
      }
    };

    void refresh();
    // Poll often enough to surface incoming messages while browsing other pages.
    const timer = window.setInterval(() => {
      void refresh();
    }, 8_000);

    const onUnread = (event: Event) => {
      const count = readChatUnreadFromEvent(event);
      if (count !== null) applyUnreadCount(count, { autoOpen: true });
    };
    window.addEventListener(CHAT_UNREAD_EVENT, onUnread);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener(CHAT_UNREAD_EVENT, onUnread);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- openWidget/applyUnread are stable enough via refs
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
    if (open) {
      setOpen(false);
      return;
    }
    await openWidget();
  };

  if (hidden || !ready) return null;

  const mobilePanelHeight =
    viewportHeight != null
      ? Math.max(280, Math.min(viewportHeight - 16, viewportHeight - 8))
      : undefined;

  return (
    <div
      className="fixed bottom-4 left-4 z-[85] md:bottom-6 md:left-6"
      data-chat-floating-widget
    >
      {/* Desktop: panel anchored above the left launcher. Mobile: near-fullscreen sheet. */}
      <div
        dir="rtl"
        className={cn(
          "flex flex-col overflow-hidden border border-black/5 bg-card shadow-[var(--shadow-apple-hover)] backdrop-blur-xl dark:border-white/10",
          "transition-all duration-[var(--duration-apple)] ease-[var(--ease-apple-spring)]",
          isMobileLayout
            ? "fixed inset-x-2 z-[85] rounded-3xl"
            : "absolute bottom-[calc(100%+12px)] left-0 h-[520px] w-[360px] rounded-[24px]",
          open
            ? "translate-y-0 scale-100 opacity-100"
            : "pointer-events-none invisible h-0 w-0 translate-y-3 scale-[0.96] overflow-hidden border-0 opacity-0 shadow-none"
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
        aria-label="چت آنلاین"
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
        aria-label={open ? "بستن چت" : "باز کردن چت آنلاین"}
        title={open ? "بستن" : "چت آنلاین"}
        data-audit-label="چت شناور"
        className={cn(
          "relative flex items-center justify-center rounded-full",
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
          <span className="absolute -top-1 -right-1 z-[2] flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-background tabular-nums">
            {formatPersianNumber(Math.min(unread, 99))}
          </span>
        )}
      </button>
    </div>
  );
}
