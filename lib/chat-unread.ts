/** Browser event so sidebar stays in sync on unread chat count. */

export const CHAT_UNREAD_EVENT = "chat-unread-changed";

export function emitChatUnreadChanged(count: number) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CHAT_UNREAD_EVENT, { detail: { count } }));
}

export function readChatUnreadFromEvent(event: Event): number | null {
  if (!(event instanceof CustomEvent)) return null;
  const count = event.detail?.count;
  return typeof count === "number" && Number.isFinite(count) ? count : null;
}
