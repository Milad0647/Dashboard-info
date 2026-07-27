import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Match http(s) URLs and bare www. hosts inside plain chat text. */
const CHAT_URL_PATTERN =
  /(https?:\/\/[^\s<>"'`]+|www\.[^\s<>"'`]+)/gi;

function isUrlToken(value: string): boolean {
  return /^(https?:\/\/|www\.)/i.test(value);
}

function trimTrailingPunctuation(url: string): { hrefCore: string; trailing: string } {
  let hrefCore = url;
  let trailing = "";
  while (/[),.;:!?؟،»"'\]}>]$/.test(hrefCore)) {
    trailing = hrefCore.slice(-1) + trailing;
    hrefCore = hrefCore.slice(0, -1);
  }
  return { hrefCore, trailing };
}

function toSafeHref(raw: string): string | null {
  const { hrefCore } = trimTrailingPunctuation(raw);
  if (!hrefCore) return null;

  const withProtocol = /^https?:\/\//i.test(hrefCore)
    ? hrefCore
    : `https://${hrefCore}`;

  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export function renderChatMessageBody(
  text: string,
  options?: { isMine?: boolean; className?: string }
): ReactNode {
  const isMine = Boolean(options?.isMine);
  const parts = text.split(CHAT_URL_PATTERN);

  return (
    <p
      className={cn(
        "whitespace-pre-wrap break-words text-right leading-relaxed [overflow-wrap:anywhere]",
        options?.className
      )}
      dir="auto"
    >
      {parts.map((part, index) => {
        if (!part) return null;
        if (!isUrlToken(part)) {
          return <span key={`t-${index}`}>{part}</span>;
        }

        const { hrefCore, trailing } = trimTrailingPunctuation(part);
        const href = toSafeHref(hrefCore);
        if (!href) {
          return <span key={`t-${index}`}>{part}</span>;
        }

        return (
          <span key={`l-${index}`}>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "underline underline-offset-2 break-all",
                isMine
                  ? "text-primary-foreground/95 decoration-primary-foreground/50 hover:decoration-primary-foreground"
                  : "text-primary decoration-primary/40 hover:decoration-primary"
              )}
              onClick={(event) => event.stopPropagation()}
            >
              {hrefCore}
            </a>
            {trailing}
          </span>
        );
      })}
    </p>
  );
}
