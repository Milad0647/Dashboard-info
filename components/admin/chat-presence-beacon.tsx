"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { heartbeatChatPresenceAction } from "@/lib/actions/chat-actions";
import {
  isRecoverableNextErrorMessage,
  messageFromUnknownError,
  tryRecoverStaleClient,
} from "@/lib/client/next-recoverable-errors";

/**
 * Keeps chat presence fresh while the user is anywhere in the admin panel,
 * so peers see online status and offline SMS is skipped when live.
 */
export function ChatPresenceBeacon() {
  const pathname = usePathname();
  const onChatPage = pathname === "/admin/chat" || pathname.startsWith("/admin/chat/");

  useEffect(() => {
    // Chat page manages its own activeConversationId heartbeats.
    if (onChatPage) return;

    let cancelled = false;

    const beat = () => {
      if (cancelled || document.visibilityState === "hidden") return;
      void heartbeatChatPresenceAction({ activeConversationId: null }).catch((error) => {
        const message = messageFromUnknownError(error);
        if (isRecoverableNextErrorMessage(message)) {
          tryRecoverStaleClient(message);
        }
        // Presence is best-effort; never surface to the user.
      });
    };

    beat();
    const timer = window.setInterval(beat, 25_000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") beat();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [onChatPage]);

  return null;
}
