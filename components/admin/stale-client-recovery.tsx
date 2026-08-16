"use client";

import { useEffect } from "react";
import {
  isRecoverableNextErrorMessage,
  messageFromUnknownError,
  tryRecoverStaleClient,
} from "@/lib/client/next-recoverable-errors";

/**
 * When the tab has been open across a deploy (or middleware/proxy returns
 * HTML for an RSC/Server Action), Next throws noisy framework errors and the
 * panel can look "cut off". Detect once and soft-reload instead of trapping
 * the user in a broken state.
 */
export function StaleClientRecovery() {
  useEffect(() => {
    const maybeRecover = (raw: string) => {
      if (!isRecoverableNextErrorMessage(raw)) return;
      tryRecoverStaleClient(raw);
    };

    const onError = (event: ErrorEvent) => {
      maybeRecover(event.message || messageFromUnknownError(event.error));
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      maybeRecover(messageFromUnknownError(event.reason));
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
