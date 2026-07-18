/** Browser event so sidebar / floating button stay in sync on unread reply count. */

export const PROBLEM_REPORTS_UNREAD_EVENT = "problem-reports-unread-changed";

export function emitProblemReportsUnreadChanged(count: number) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(PROBLEM_REPORTS_UNREAD_EVENT, { detail: { count } })
  );
}

export function readUnreadCountFromEvent(event: Event): number | null {
  if (!(event instanceof CustomEvent)) return null;
  const count = event.detail?.count;
  return typeof count === "number" && Number.isFinite(count) ? count : null;
}
