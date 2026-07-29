"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Check,
  CheckCheck,
  ChevronRight,
  Loader2,
  MessageCircle,
  Minus,
  Pencil,
  Plus,
  Search,
  SendHorizontal,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteChatMessageAction,
  editChatMessageAction,
  listChatContactsAction,
  markChatConversationSeenAction,
  openChatWithPeerAction,
  sendChatMessageAction,
  syncChatAction,
} from "@/lib/actions/chat-actions";
import { emitChatUnreadChanged } from "@/lib/chat-unread";
import type {
  ChatConversationSummary,
  ChatMessage,
  ChatPeer,
} from "@/lib/chat/types";
import { CHAT_MAX_BODY_LENGTH } from "@/lib/chat/types";
import { playChatBuzz } from "@/lib/chat/buzz";
import { renderChatMessageBody } from "@/lib/chat/linkify";
import { cn, formatPersianDateTime, formatPersianNumber } from "@/lib/utils";

function roleLabel(role: ChatPeer["role"]): string {
  switch (role) {
    case "admin":
    case "env_admin":
      return "مدیر";
    case "client":
      return "کارفرما";
    case "contributor":
      return "کاربر";
    default:
      return "";
  }
}

function MessageTicks({ message }: { message: ChatMessage }) {
  if (!message.isMine) return null;
  if (message.status === "seen") {
    return <CheckCheck className="h-3.5 w-3.5 text-sky-300" aria-label="خوانده شد" />;
  }
  if (message.status === "delivered") {
    return <CheckCheck className="h-3.5 w-3.5 opacity-80" aria-label="رسیده" />;
  }
  return <Check className="h-3.5 w-3.5 opacity-70" aria-label="ارسال شد" />;
}

function mergeMessages(existing: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  if (incoming.length === 0) return existing;
  const map = new Map(existing.map((item) => [item.id, item]));
  for (const item of incoming) {
    map.set(item.id, item);
  }
  return [...map.values()].sort((a, b) => {
    const timeDiff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (timeDiff !== 0) return timeDiff;
    return a.id.localeCompare(b.id);
  });
}

function applyStatusUpdates(existing: ChatMessage[], updates: ChatMessage[]): ChatMessage[] {
  if (updates.length === 0) return existing;
  const map = new Map(updates.map((item) => [item.id, item]));
  return existing.map((item) => map.get(item.id) ?? item);
}

function requestDesktopNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission === "default") {
    void Notification.requestPermission();
  }
}

function maybeNotifyNewMessage(peerName: string, body: string) {
  playChatBuzz();
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if (document.visibilityState === "visible") return;
  try {
    new Notification(`پیام جدید از ${peerName}`, {
      body: body.slice(0, 120),
      tag: "dashboard-chat",
    });
  } catch {
    // Ignore notification failures (unsupported / permission race).
  }
}

export function ChatPanel({
  initialConversations = [],
  initialUnreadTotal = 0,
  canStartWithAnyone = false,
  variant = "page",
  supportOnline = false,
  onClose,
}: {
  initialConversations?: ChatConversationSummary[];
  initialUnreadTotal?: number;
  canStartWithAnyone?: boolean;
  variant?: "page" | "widget";
  /** Shown in the floating widget header as online/offline support status. */
  supportOnline?: boolean;
  onClose?: () => void;
}) {
  const isWidget = variant === "widget";
  const [conversations, setConversations] = useState(initialConversations);
  const [activeId, setActiveId] = useState<string | null>(
    isWidget ? null : (initialConversations[0]?.id ?? null)
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [peer, setPeer] = useState<ChatPeer | null>(
    isWidget ? null : (initialConversations[0]?.peer ?? null)
  );
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [contactsOpen, setContactsOpen] = useState(false);
  const [contacts, setContacts] = useState<ChatPeer[]>([]);
  const [contactSearch, setContactSearch] = useState("");
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [isSending, startSendTransition] = useTransition();
  const [isMutatingMessage, startMessageMutation] = useTransition();
  const [bootstrapping, setBootstrapping] = useState(false);
  const [widgetView, setWidgetView] = useState<"list" | "thread">("list");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);
  const lastCursorRef = useRef<{ createdAt: string; id: string } | null>(null);
  const statusSinceRef = useRef<string>(new Date().toISOString());
  const knownMessageIdsRef = useRef<Set<string>>(new Set());
  const activeIdRef = useRef<string | null>(activeId);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    emitChatUnreadChanged(initialUnreadTotal);
    requestDesktopNotificationPermission();
  }, [initialUnreadTotal]);

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((item) => {
      const hay = `${item.peer.name} ${item.peer.email ?? ""} ${item.lastMessagePreview ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [conversations, search]);

  const filteredContacts = useMemo(() => {
    const q = contactSearch.trim().toLowerCase();
    const list = !q
      ? contacts
      : contacts.filter((item) => {
          const hay = `${item.name} ${item.email ?? ""} ${roleLabel(item.role)}`.toLowerCase();
          return hay.includes(q);
        });
    return [...list].sort((a, b) => {
      if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
      return a.name.localeCompare(b.name, "fa");
    });
  }, [contacts, contactSearch]);

  const isNearBottom = (el: HTMLDivElement, thresholdPx = 96) =>
    el.scrollHeight - el.scrollTop - el.clientHeight <= thresholdPx;

  const scrollToBottom = useCallback((smooth = false) => {
    const el = messagesContainerRef.current;
    if (!el) return;
    stickToBottomRef.current = true;
    if (smooth) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    } else {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  const handleMessagesScroll = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    stickToBottomRef.current = isNearBottom(el);
  };

  const sync = useCallback(async (options?: { full?: boolean }) => {
    const conversationId = activeIdRef.current;
    const cursor = options?.full ? null : lastCursorRef.current;
    const result = await syncChatAction({
      conversationId,
      afterCreatedAt: cursor?.createdAt ?? null,
      afterId: cursor?.id ?? null,
      statusSince: statusSinceRef.current,
    });

    if (!result.success) return;

    if (result.conversations) {
      setConversations(result.conversations);
    }
    if (typeof result.unreadTotal === "number") {
      emitChatUnreadChanged(result.unreadTotal);
    }
    if (result.peer && conversationId === activeIdRef.current) {
      setPeer(result.peer);
    }

    if (conversationId && conversationId === activeIdRef.current) {
      const incoming = result.messages ?? [];
      const statusUpdates = result.statusUpdates ?? [];

      if (incoming.length > 0 || statusUpdates.length > 0) {
        setMessages((prev) => {
          let next = prev;
          if (options?.full) {
            next = incoming;
            knownMessageIdsRef.current = new Set(incoming.map((item) => item.id));
          } else {
            const fresh = incoming.filter((item) => !knownMessageIdsRef.current.has(item.id));
            for (const item of fresh) {
              knownMessageIdsRef.current.add(item.id);
              if (!item.isMine) {
                maybeNotifyNewMessage(result.peer?.name ?? "کاربر", item.body);
              }
            }
            next = mergeMessages(prev, incoming);
          }
          next = applyStatusUpdates(next, statusUpdates);
          return next;
        });

        const last = incoming.at(-1) ?? null;
        if (last) {
          lastCursorRef.current = { createdAt: last.createdAt, id: last.id };
        }
        if (result.serverTime) {
          statusSinceRef.current = result.serverTime;
        }
        if (incoming.some((item) => !item.isMine) || options?.full) {
          void markChatConversationSeenAction({ conversationId }).then((seenResult) => {
            if (seenResult.success && typeof seenResult.unreadTotal === "number") {
              emitChatUnreadChanged(seenResult.unreadTotal);
            }
          });
        }

        // Only pin to bottom on full load, or when user is already near bottom and new msgs arrive.
        // Status-only polls must never yank scroll while reading history.
        const shouldStick =
          Boolean(options?.full) ||
          (incoming.length > 0 && stickToBottomRef.current);
        if (shouldStick) {
          requestAnimationFrame(() => scrollToBottom(!options?.full));
        }
      } else if (result.serverTime) {
        statusSinceRef.current = result.serverTime;
      }
    }
  }, [scrollToBottom]);

  const openConversation = useCallback(
    async (conversationId: string, nextPeer?: ChatPeer) => {
      setActiveId(conversationId);
      activeIdRef.current = conversationId;
      if (isWidget) setWidgetView("thread");
      setBootstrapping(true);
      lastCursorRef.current = null;
      knownMessageIdsRef.current = new Set();
      statusSinceRef.current = new Date().toISOString();
      stickToBottomRef.current = true;
      if (nextPeer) setPeer(nextPeer);

      try {
        const result = await syncChatAction({
          conversationId,
          afterCreatedAt: null,
          afterId: null,
          statusSince: statusSinceRef.current,
        });
        if (!result.success) {
          toast.error(result.error ?? "بارگذاری گفتگو ناموفق بود");
          return;
        }
        if (result.conversations) setConversations(result.conversations);
        if (result.peer) setPeer(result.peer);
        const loaded = result.messages ?? [];
        setMessages(loaded);
        knownMessageIdsRef.current = new Set(loaded.map((item) => item.id));
        const last = loaded.at(-1);
        lastCursorRef.current = last
          ? { createdAt: last.createdAt, id: last.id }
          : null;
        if (result.serverTime) statusSinceRef.current = result.serverTime;
        if (typeof result.unreadTotal === "number") {
          emitChatUnreadChanged(result.unreadTotal);
        }
        await markChatConversationSeenAction({ conversationId });
        requestAnimationFrame(() => scrollToBottom(false));
      } finally {
        setBootstrapping(false);
      }
    },
    [isWidget, scrollToBottom]
  );

  const backToList = () => {
    setWidgetView("list");
    setActiveId(null);
    activeIdRef.current = null;
    setPeer(null);
    setMessages([]);
    lastCursorRef.current = null;
    void syncChatAction({
      conversationId: null,
      afterCreatedAt: null,
      afterId: null,
      statusSince: statusSinceRef.current,
    }).then((result) => {
      if (result.success && result.conversations) {
        setConversations(result.conversations);
      }
      if (result.success && typeof result.unreadTotal === "number") {
        emitChatUnreadChanged(result.unreadTotal);
      }
    });
  };

  useEffect(() => {
    if (isWidget) return;
    if (!activeId) return;
    void openConversation(activeId, peer ?? undefined);
    // Intentionally only on mount when we have an initial conversation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      if (cancelled || document.visibilityState === "hidden") return;
      await sync();
    };

    const timer = window.setInterval(() => {
      void tick();
    }, 2500);

    const onVisibility = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [sync]);

  const openContacts = async () => {
    setContactsOpen(true);
    setLoadingContacts(true);
    setContactSearch("");
    try {
      const result = await listChatContactsAction();
      if (!result.success) {
        toast.error(result.error ?? "بارگذاری مخاطبین ناموفق بود");
        return;
      }
      setContacts(result.contacts ?? []);
    } finally {
      setLoadingContacts(false);
    }
  };

  const startChatWith = async (contact: ChatPeer) => {
    const result = await openChatWithPeerAction({ peerKey: contact.participantKey });
    if (!result.success || !result.conversationId) {
      toast.error(result.error ?? "شروع گفتگو ناموفق بود");
      return;
    }
    setContactsOpen(false);
    const existing = conversations.find((item) => item.id === result.conversationId);
    if (!existing) {
      setConversations((prev) => [
        {
          id: result.conversationId!,
          peer: result.peer ?? contact,
          lastMessageAt: null,
          lastMessagePreview: null,
          lastMessageSenderKey: null,
          unreadCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        ...prev,
      ]);
    }
    await openConversation(result.conversationId, result.peer ?? contact);
  };

  const handleSend = () => {
    const conversationId = activeId;
    const body = draft.trim();
    if (!conversationId || !body || isSending) return;

    startSendTransition(async () => {
      const result = await sendChatMessageAction({ conversationId, body });
      if (!result.success || !result.message) {
        toast.error(result.error ?? "ارسال پیام ناموفق بود");
        return;
      }
      setDraft("");
      knownMessageIdsRef.current.add(result.message.id);
      setMessages((prev) => mergeMessages(prev, [result.message!]));
      lastCursorRef.current = {
        createdAt: result.message.createdAt,
        id: result.message.id,
      };
      setConversations((prev) => {
        const others = prev.filter((item) => item.id !== conversationId);
        const current = prev.find((item) => item.id === conversationId);
        const nextSummary: ChatConversationSummary = {
          id: conversationId,
          peer: current?.peer ?? peer!,
          lastMessageAt: result.message!.createdAt,
          lastMessagePreview: result.message!.body.slice(0, 120),
          lastMessageSenderKey: result.message!.senderKey,
          unreadCount: 0,
          createdAt: current?.createdAt ?? result.message!.createdAt,
          updatedAt: result.message!.createdAt,
        };
        return [nextSummary, ...others];
      });
      requestAnimationFrame(() => scrollToBottom(true));
    });
  };

  const beginEditMessage = (message: ChatMessage) => {
    if (!message.isMine || message.isDeleted) return;
    setEditingMessageId(message.id);
    setEditDraft(message.body);
  };

  const cancelEditMessage = () => {
    setEditingMessageId(null);
    setEditDraft("");
  };

  const saveEditMessage = () => {
    const messageId = editingMessageId;
    const body = editDraft.trim();
    if (!messageId || !body || isMutatingMessage) return;

    startMessageMutation(async () => {
      const result = await editChatMessageAction({ messageId, body });
      if (!result.success || !result.message) {
        toast.error(result.error ?? "ویرایش پیام ناموفق بود");
        return;
      }
      setMessages((prev) => applyStatusUpdates(prev, [result.message!]));
      cancelEditMessage();
      void sync({ full: false });
      toast.success("پیام ویرایش شد");
    });
  };

  const confirmDeleteMessage = () => {
    const messageId = deleteTargetId;
    if (!messageId || isMutatingMessage) return;

    startMessageMutation(async () => {
      const result = await deleteChatMessageAction({ messageId });
      if (!result.success || !result.message) {
        toast.error(result.error ?? "حذف پیام ناموفق بود");
        return;
      }
      setMessages((prev) => applyStatusUpdates(prev, [result.message!]));
      setDeleteTargetId(null);
      if (editingMessageId === messageId) cancelEditMessage();
      void sync({ full: false });
      toast.success("پیام برای هر دو طرف حذف شد");
    });
  };

  const showListPane = !isWidget || widgetView === "list";
  const showThreadPane = !isWidget || widgetView === "thread";

  return (
    <div
      dir="rtl"
      className={cn(isWidget ? "flex h-full min-h-0 flex-col" : "space-y-4")}
    >
      {isWidget ? (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b bg-card/80 px-3 py-3 backdrop-blur-sm sm:px-4">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold tracking-tight">
              چت آنلاین
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span
                className={cn(
                  "inline-block h-2 w-2 rounded-full",
                  supportOnline || peer?.isOnline ? "bg-emerald-500" : "bg-zinc-400"
                )}
                aria-hidden
              />
              {supportOnline || peer?.isOnline ? "آنلاین" : "آفلاین"}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8 rounded-full"
              onClick={() => void openContacts()}
              aria-label="گفتگوی جدید"
              title="گفتگوی جدید"
            >
              <Plus className="h-4 w-4" />
            </Button>
            {onClose && (
              <>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 rounded-full"
                  onClick={onClose}
                  aria-label="کوچک‌کردن"
                  title="کوچک‌کردن"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 rounded-full"
                  onClick={onClose}
                  aria-label="بستن"
                  title="بستن"
                >
                  <X className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">چت</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              گفتگوی آنلاین بین مدیر / کارفرما و کاربران — با وضعیت رسیده و خوانده‌شده
            </p>
          </div>
          <Button type="button" onClick={() => void openContacts()} className="gap-2">
            <Plus className="h-4 w-4" />
            گفتگوی جدید
          </Button>
        </div>
      )}

      <div
        className={cn(
          "grid overflow-hidden bg-card",
          isWidget
            ? "min-h-0 flex-1 grid-cols-1 rounded-none border-0"
            : "min-h-[70vh] rounded-2xl border lg:grid-cols-[320px_1fr]"
        )}
      >
        {showListPane && (
          <aside
            className={cn(
              "flex flex-col",
              isWidget
                ? "min-h-0 h-full border-0"
                : "min-h-[40vh] border-b lg:min-h-0 lg:border-b-0 lg:border-e",
              isWidget && widgetView === "thread" && "hidden"
            )}
          >
            <div className="border-b p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="جستجوی گفتگو…"
                  className="rounded-xl border-transparent bg-muted/70 ps-9 shadow-none focus-visible:ring-1"
                  dir="rtl"
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {filteredConversations.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-12 text-center text-sm text-muted-foreground">
                  <MessageCircle className="h-8 w-8 opacity-40" />
                  هنوز گفتگویی نیست. با «گفتگوی جدید» شروع کنید.
                </div>
              ) : (
                <ul className="divide-y divide-border/60">
                  {filteredConversations.map((item) => {
                    const isActive = item.id === activeId;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => void openConversation(item.id, item.peer)}
                          className={cn(
                            "flex w-full items-start gap-3 px-3 py-3 text-right transition-colors duration-[var(--duration-apple-fast)] ease-[var(--ease-apple-soft)]",
                            isActive ? "bg-primary/10" : "hover:bg-muted/60"
                          )}
                        >
                          <div className="relative mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                            <UserRound className="h-5 w-5 text-muted-foreground" />
                            <span
                            className={cn(
                              "absolute bottom-0 end-0 h-2.5 w-2.5 rounded-full border-2 border-card",
                              item.peer.isOnline ? "bg-emerald-500" : "bg-zinc-400"
                            )}
                              title={item.peer.isOnline ? "آنلاین" : "آفلاین"}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate font-medium">{item.peer.name}</p>
                              {item.lastMessageAt && (
                                <span className="shrink-0 text-[10px] text-muted-foreground">
                                  {formatPersianDateTime(item.lastMessageAt)}
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 flex items-center justify-between gap-2">
                              <p className="truncate text-xs text-muted-foreground">
                                {item.lastMessagePreview || roleLabel(item.peer.role) || "—"}
                              </p>
                              {item.unreadCount > 0 && (
                                <span className="shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground tabular-nums">
                                  {formatPersianNumber(item.unreadCount)}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>
        )}

        {showThreadPane && (
          <section
            className={cn(
              "flex flex-col",
              isWidget ? "min-h-0 h-full" : "min-h-[50vh] lg:min-h-0",
              isWidget && widgetView === "list" && "hidden"
            )}
          >
            {!activeId || !peer ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
                <MessageCircle className="h-12 w-12 opacity-30" />
                <p>یک گفتگو را انتخاب کنید یا گفتگوی جدید بسازید.</p>
                {!canStartWithAnyone && (
                  <p className="text-xs">می‌توانید با مدیر سیستم یا کارفرما گفتگو کنید.</p>
                )}
              </div>
            ) : (
              <>
                <header className="flex items-center gap-2 border-b px-3 py-2.5 sm:px-4">
                  {isWidget && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 shrink-0 rounded-full"
                      onClick={backToList}
                      aria-label="بازگشت"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                  )}
                  <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                    <UserRound className="h-5 w-5 text-muted-foreground" />
                    <span
                      className={cn(
                        "absolute bottom-0 end-0 h-2.5 w-2.5 rounded-full border-2 border-card",
                        peer.isOnline ? "bg-emerald-500" : "bg-zinc-400"
                      )}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{peer.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {peer.isOnline
                        ? "آنلاین"
                        : peer.lastSeenAt
                          ? `آخرین بازدید: ${formatPersianDateTime(peer.lastSeenAt)}`
                          : roleLabel(peer.role) || "آفلاین"}
                    </p>
                  </div>
                  {bootstrapping && (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                  )}
                </header>

                <div
                  ref={messagesContainerRef}
                  onScroll={handleMessagesScroll}
                  className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-muted/20 px-3 py-4 sm:px-4"
                >
                  {messages.length === 0 && !bootstrapping ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">
                      هنوز پیامی رد و بدل نشده. اولین پیام را بفرستید.
                    </p>
                  ) : (
                    messages.map((message) => {
                      const isEditing = editingMessageId === message.id;
                      return (
                      <div
                        key={message.id}
                        className={cn(
                          "group flex w-full",
                          // RTL Telegram-style: my bubbles on the left (end), theirs on the right (start).
                          message.isMine ? "justify-end" : "justify-start"
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm sm:max-w-[70%]",
                            message.isDeleted
                              ? message.isMine
                                ? "rounded-es-md bg-primary/70 text-primary-foreground/80"
                                : "rounded-ee-md border border-dashed bg-muted/40 text-muted-foreground"
                              : message.isMine
                                ? "rounded-es-md bg-primary text-primary-foreground"
                                : "rounded-ee-md border bg-card"
                          )}
                        >
                          {message.isDeleted ? (
                            <p className="italic opacity-90">این پیام حذف شد</p>
                          ) : isEditing ? (
                            <div className="space-y-2">
                              <Textarea
                                value={editDraft}
                                onChange={(event) =>
                                  setEditDraft(event.target.value.slice(0, CHAT_MAX_BODY_LENGTH))
                                }
                                rows={3}
                                dir="rtl"
                                autoFocus
                                className="min-h-[72px] resize-none rounded-xl border-primary-foreground/30 bg-primary-foreground/10 text-right text-sm text-primary-foreground placeholder:text-primary-foreground/60"
                                onKeyDown={(event) => {
                                  if (event.key === "Escape") {
                                    event.preventDefault();
                                    cancelEditMessage();
                                  }
                                  if (event.key === "Enter" && !event.shiftKey) {
                                    event.preventDefault();
                                    saveEditMessage();
                                  }
                                }}
                              />
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 rounded-full px-2 text-primary-foreground hover:bg-primary-foreground/15"
                                  onClick={cancelEditMessage}
                                  disabled={isMutatingMessage}
                                >
                                  انصراف
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  className="h-7 rounded-full bg-primary-foreground px-3 text-primary hover:bg-primary-foreground/90"
                                  onClick={saveEditMessage}
                                  disabled={isMutatingMessage || !editDraft.trim()}
                                >
                                  {isMutatingMessage ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    "ذخیره"
                                  )}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            renderChatMessageBody(message.body, { isMine: message.isMine })
                          )}
                          <div
                            className={cn(
                              "mt-1 flex items-center gap-1 text-[10px]",
                              message.isMine
                                ? "justify-between text-primary-foreground/80"
                                : "justify-start text-muted-foreground"
                            )}
                          >
                            <div className="flex items-center gap-1">
                              <MessageTicks message={message} />
                              <span>{formatPersianDateTime(message.createdAt)}</span>
                              {message.editedAt && !message.isDeleted ? (
                                <span className="opacity-80">· ویرایش‌شده</span>
                              ) : null}
                            </div>
                            {message.isMine && !message.isDeleted && !isEditing ? (
                              <div className="flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                                <button
                                  type="button"
                                  className="rounded p-0.5 hover:bg-primary-foreground/15"
                                  aria-label="ویرایش پیام"
                                  onClick={() => beginEditMessage(message)}
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  className="rounded p-0.5 hover:bg-primary-foreground/15"
                                  aria-label="حذف پیام"
                                  onClick={() => setDeleteTargetId(message.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      );
                    })
                  )}
                </div>

                <footer className="border-t p-3">
                  <div className="flex items-end gap-2">
                    <Textarea
                      value={draft}
                      onChange={(event) =>
                        setDraft(event.target.value.slice(0, CHAT_MAX_BODY_LENGTH))
                      }
                      placeholder="پیام خود را بنویسید…"
                      rows={2}
                      dir="rtl"
                      className="min-h-[44px] resize-none rounded-2xl text-right"
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          handleSend();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      size="icon"
                      className="h-11 w-11 shrink-0 rounded-full"
                      disabled={isSending || !draft.trim()}
                      onClick={handleSend}
                      aria-label="ارسال"
                    >
                      {isSending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <SendHorizontal className="h-4 w-4 -scale-x-100" />
                      )}
                    </Button>
                  </div>
                  {!isWidget && (
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      Enter برای ارسال · Shift+Enter خط جدید
                    </p>
                  )}
                </footer>
              </>
            )}
          </section>
        )}
      </div>

      <Dialog open={contactsOpen} onOpenChange={setContactsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>گفتگوی جدید</DialogTitle>
          </DialogHeader>
          <Input
            value={contactSearch}
            onChange={(event) => setContactSearch(event.target.value)}
            placeholder="جستجوی نام یا ایمیل…"
          />
          <div className="max-h-80 overflow-y-auto rounded-lg border">
            {loadingContacts ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                در حال بارگذاری…
              </div>
            ) : filteredContacts.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">مخاطبی یافت نشد</p>
            ) : (
              <ul className="divide-y">
                {filteredContacts.map((contact) => (
                  <li key={contact.participantKey}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-right hover:bg-muted/60"
                      onClick={() => void startChatWith(contact)}
                    >
                      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                        <UserRound className="h-4 w-4 text-muted-foreground" />
                        <span
                          className={cn(
                            "absolute bottom-0 end-0 h-2 w-2 rounded-full border border-card",
                            contact.isOnline ? "bg-emerald-500" : "bg-zinc-400"
                          )}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{contact.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[roleLabel(contact.role), contact.email].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteTargetId)}
        onOpenChange={(open) => {
          if (!open) setDeleteTargetId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف پیام</AlertDialogTitle>
            <AlertDialogDescription>
              این پیام برای هر دو طرف حذف می‌شود و قابل بازگشت نیست.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isMutatingMessage}>انصراف</AlertDialogCancel>
            <AlertDialogAction
              disabled={isMutatingMessage}
              onClick={(event) => {
                event.preventDefault();
                confirmDeleteMessage();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isMutatingMessage ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "حذف برای همه"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
