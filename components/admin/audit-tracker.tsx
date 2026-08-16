"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { resolveErrorInfo } from "@/lib/error-solutions";
import { emitUiError } from "@/lib/ui-error-bus";
import { redirectToLoginForExpiredSession } from "@/lib/client/auth-session";
import {
  isRecoverableNextErrorMessage,
  tryRecoverStaleClient,
} from "@/lib/client/next-recoverable-errors";

const MAX_LABEL_LENGTH = 120;
const MAX_ERROR_LABEL_LENGTH = 200;

function sendTrack(body: Record<string, unknown>) {
  try {
    const payload = JSON.stringify(body);
    // Prefer sendBeacon so navigation is not blocked.
    if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
      const blob = new Blob([payload], { type: "application/json" });
      const ok = navigator.sendBeacon("/api/audit/track", blob);
      if (ok) return;
    }
    void fetch("/api/audit/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      credentials: "same-origin",
      keepalive: true,
    });
  } catch {
    // Never break the UI because of tracking.
  }
}

function currentPath(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname + window.location.search;
}

function toastMessageToString(message: unknown): string {
  if (typeof message === "string") return message;
  if (typeof message === "number" || typeof message === "boolean") return String(message);
  if (message && typeof message === "object" && "message" in message) {
    const nested = (message as { message?: unknown }).message;
    if (typeof nested === "string") return nested;
  }
  return "خطای کاربر";
}

/**
 * Report a user-facing error: open modal, and log to rasad (ui.error).
 * Dedupes identical messages within a short window to avoid modal spam.
 */
let lastErrorKey = "";
let lastErrorAt = 0;
const ERROR_DEDUP_MS = 1500;

const NOISY_RUNTIME =
  /ResizeObserver|Script error\.?$|Loading chunk|ChunkLoadError|AbortError|cancelled|canceled|Minified React error #(?:418|419|422|423|425)|Hydration failed|Text content does not match|unexpected response was received from the server|Failed to find Server Action|failed-to-find-server-action|was not found on the server/i;

function reportUiError(
  rawMessage: string,
  metadata?: Record<string, unknown>,
  options?: { openModal?: boolean }
) {
  if (/^unauthorized$/i.test(rawMessage.trim()) || /نشست شما منقضی/i.test(rawMessage)) {
    redirectToLoginForExpiredSession();
    return;
  }

  // Deploy/proxy/middleware Flight mismatches — recover quietly instead of modal spam.
  if (isRecoverableNextErrorMessage(rawMessage)) {
    tryRecoverStaleClient(rawMessage);
    return;
  }

  const info = resolveErrorInfo(rawMessage);
  const label = info.message.slice(0, MAX_ERROR_LABEL_LENGTH);
  if (!label) return;

  const openModal = options?.openModal !== false;
  const now = Date.now();
  const key = `${label}|${currentPath()}`;
  const isDuplicate = key === lastErrorKey && now - lastErrorAt < ERROR_DEDUP_MS;
  lastErrorKey = key;
  lastErrorAt = now;

  if (openModal && !isDuplicate) {
    emitUiError({
      info,
      source: typeof metadata?.source === "string" ? metadata.source : "client",
      path: currentPath(),
    });
  }

  if (!isDuplicate) {
    sendTrack({
      action: "ui.error",
      path: currentPath(),
      label,
      metadata: {
        source: "client",
        title: info.title,
        problem: info.problem,
        solution: info.solution,
        category: info.category,
        ...metadata,
      },
    });
  }
}

function resolveClickTarget(target: EventTarget | null): {
  label: string;
  role: string;
} | null {
  if (!(target instanceof Element)) return null;

  const interactive = target.closest<HTMLElement>(
    "button, a, [role='button'], [role='menuitem'], [role='tab'], input[type='submit']"
  );
  if (!interactive) return null;

  const explicit = interactive.getAttribute("data-audit-label");
  const ariaLabel = interactive.getAttribute("aria-label");
  const title = interactive.getAttribute("title");
  const text = interactive.textContent?.replace(/\s+/g, " ").trim();
  const href = interactive.getAttribute("href");

  const label =
    explicit ||
    ariaLabel ||
    title ||
    (text && text.length > 0 ? text : null) ||
    href ||
    interactive.tagName.toLowerCase();

  const role =
    interactive.tagName.toLowerCase() === "a"
      ? "link"
      : interactive.getAttribute("role") || interactive.tagName.toLowerCase();

  return { label: label.slice(0, MAX_LABEL_LENGTH), role };
}

/**
 * Client-side audit tracker for the admin panel.
 * Records page views, clicks, user-facing errors (modal + rasad), and presence heartbeats.
 */
export function AuditTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastPathRef = useRef<string | null>(null);

  useEffect(() => {
    const campaignId = searchParams.get("campaign") ?? undefined;
    const query = searchParams.toString();
    const fullPath = query ? `${pathname}?${query}` : pathname;

    if (lastPathRef.current === fullPath) return;
    lastPathRef.current = fullPath;

    sendTrack({
      action: "navigation.page_view",
      path: fullPath,
      label: document.title,
      campaignId,
    });
  }, [pathname, searchParams]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const resolved = resolveClickTarget(event.target);
      if (!resolved) return;

      sendTrack({
        action: "ui.click",
        path: window.location.pathname + window.location.search,
        label: resolved.label,
        metadata: { role: resolved.role },
      });
    };

    document.addEventListener("click", handleClick, { capture: true });
    return () =>
      document.removeEventListener("click", handleClick, {
        capture: true,
      } as EventListenerOptions);
  }, []);

  useEffect(() => {
    const sendHeartbeat = () => {
      sendTrack({
        action: "presence.heartbeat",
        path: window.location.pathname + window.location.search,
        label: "آنلاین",
      });
    };

    sendHeartbeat();
    const intervalId = window.setInterval(sendHeartbeat, 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  // Capture toast errors → modal + rasad (suppress toast UI to avoid double surfaces).
  useEffect(() => {
    const originalError = toast.error.bind(toast);
    toast.error = ((message) => {
      reportUiError(toastMessageToString(message), { source: "toast" });
      // Return a synthetic id so callers stay compatible without showing a toast.
      return `error-modal-${Date.now()}`;
    }) as typeof toast.error;

    return () => {
      toast.error = originalError;
    };
  }, []);

  // Capture uncaught runtime / promise errors as a fallback signal.
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      const message = event.message?.trim() || event.error?.message || "خطای زمان اجرا";
      if (NOISY_RUNTIME.test(message)) {
        reportUiError(message, { source: "window.error" }, { openModal: false });
        return;
      }
      reportUiError(message, { source: "window.error" });
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message =
        typeof reason === "string"
          ? reason
          : reason instanceof Error
            ? reason.message
            : "خطای Promise رسیدگی‌نشده";
      if (NOISY_RUNTIME.test(message)) {
        reportUiError(message, { source: "unhandledrejection" }, { openModal: false });
        return;
      }
      reportUiError(message, { source: "unhandledrejection" });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
