/**
 * Detect Next.js / React framework failures that usually mean the open tab
 * is out of sync with the server (post-deploy) or received HTML instead of
 * an RSC / Server Action payload (middleware redirect, proxy 502, etc.).
 */

import { isUploadBusy } from "@/lib/client/upload-busy";

const RECOVERABLE_ERROR =
  /unexpected response was received from the server|Failed to find Server Action|failed-to-find-server-action|was not found on the server|Minified React error #(?:418|419|422|423|425)|Hydration failed|Text content does not match|server rendered (?:HTML|text) didn't match/i;

const RELOAD_STORAGE_KEY = "admin:stale-client-reload-at";
const RELOAD_COOLDOWN_MS = 45_000;

export function isRecoverableNextErrorMessage(message: string | undefined | null): boolean {
  if (!message?.trim()) return false;
  return RECOVERABLE_ERROR.test(message);
}

function readLastReloadAt(): number {
  try {
    const raw = sessionStorage.getItem(RELOAD_STORAGE_KEY);
    const value = raw ? Number(raw) : 0;
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function writeLastReloadAt(at = Date.now()): void {
  try {
    sessionStorage.setItem(RELOAD_STORAGE_KEY, String(at));
  } catch {
    // Ignore storage failures.
  }
}

/**
 * Soft-recover by reloading once. Skips while an upload is in progress and
 * avoids reload loops with a short cooldown.
 * Returns true when a reload was scheduled.
 */
export function tryRecoverStaleClient(reason?: string): boolean {
  if (typeof window === "undefined") return false;
  if (isUploadBusy()) return false;

  const now = Date.now();
  if (now - readLastReloadAt() < RELOAD_COOLDOWN_MS) return false;

  writeLastReloadAt(now);
  if (reason) {
    console.warn("[stale-client] reloading after recoverable error:", reason);
  }
  window.setTimeout(() => {
    window.location.reload();
  }, 50);
  return true;
}

export function messageFromUnknownError(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Error) return value.message || value.name;
  if (value && typeof value === "object" && "message" in value) {
    const nested = (value as { message?: unknown }).message;
    if (typeof nested === "string") return nested;
  }
  return "";
}
