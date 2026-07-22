/** Browser event so sidebar / ack gate / inbox stay in sync on unread directives. */

export const DIRECTIVES_UNREAD_EVENT = "directives-unread-changed";

export type DirectivesUnreadDetail = {
  count: number;
  /** When set, local inbox UIs can mark this directive as seen immediately. */
  confirmedId?: string;
};

export function emitDirectivesUnreadChanged(count: number, confirmedId?: string) {
  if (typeof window === "undefined") return;
  const detail: DirectivesUnreadDetail = { count };
  if (confirmedId) detail.confirmedId = confirmedId;
  window.dispatchEvent(new CustomEvent(DIRECTIVES_UNREAD_EVENT, { detail }));
}

export function readDirectivesUnreadFromEvent(event: Event): number | null {
  if (!(event instanceof CustomEvent)) return null;
  const count = event.detail?.count;
  return typeof count === "number" && Number.isFinite(count) ? count : null;
}

export function readDirectivesConfirmedIdFromEvent(event: Event): string | null {
  if (!(event instanceof CustomEvent)) return null;
  const id = event.detail?.confirmedId;
  return typeof id === "string" && id.length > 0 ? id : null;
}
