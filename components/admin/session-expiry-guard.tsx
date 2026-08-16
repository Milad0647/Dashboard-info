"use client";

import { useEffect } from "react";
import { redirectToLoginForExpiredSession } from "@/lib/client/auth-session";
import { isUploadBusy } from "@/lib/client/upload-busy";

/** How often to re-check while the tab stays open. */
const CHECK_INTERVAL_MS = 60_000;

/**
 * While the user stays on a panel page without full navigation, middleware
 * will not run. Poll the session endpoint and bounce to login as soon as
 * the cookie expires or is revoked — avoids dead uploads / actions.
 *
 * Skips forced logout while an upload is in flight so transfers are not cut off.
 */
export function SessionExpiryGuard() {
  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      try {
        const response = await fetch("/api/auth/session", {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
        });
        if (cancelled) return;
        if (response.status !== 401) return;

        // Finish the current upload first; the next poll will log out.
        if (isUploadBusy()) return;

        redirectToLoginForExpiredSession();
      } catch {
        // Network blips should not force logout.
      }
    }

    void checkSession();
    const intervalId = window.setInterval(checkSession, CHECK_INTERVAL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") void checkSession();
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  return null;
}
