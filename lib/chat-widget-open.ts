/** Browser event so other floating controls yield while the chat widget is open. */

export const CHAT_WIDGET_OPEN_EVENT = "chat-widget-open-changed";

export function emitChatWidgetOpenChanged(open: boolean) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CHAT_WIDGET_OPEN_EVENT, { detail: { open } }));
}

export function readChatWidgetOpenFromEvent(event: Event): boolean | null {
  if (!(event instanceof CustomEvent)) return null;
  return typeof event.detail?.open === "boolean" ? event.detail.open : null;
}
