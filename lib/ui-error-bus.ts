import type { ResolvedErrorInfo } from "@/lib/error-solutions";

export const UI_ERROR_EVENT = "admin:ui-error";

export interface UiErrorEventDetail {
  info: ResolvedErrorInfo;
  source?: string;
  path?: string;
}

/** Open the global error modal (client-only). */
export function emitUiError(detail: UiErrorEventDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(UI_ERROR_EVENT, { detail }));
}
