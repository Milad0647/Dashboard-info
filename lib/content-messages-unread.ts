/** Browser event so sidebar stays in sync on unread content-message count. */

export const CONTENT_MESSAGES_UNREAD_EVENT = "content-messages-unread-changed";

export function emitContentMessagesUnreadChanged(count: number) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(CONTENT_MESSAGES_UNREAD_EVENT, { detail: { count } })
  );
}

export function readContentMessagesUnreadFromEvent(event: Event): number | null {
  if (!(event instanceof CustomEvent)) return null;
  const count = event.detail?.count;
  return typeof count === "number" && Number.isFinite(count) ? count : null;
}
