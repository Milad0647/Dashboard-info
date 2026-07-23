"use client";

import type { ReactNode } from "react";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";

/** Force the files API to send Content-Disposition: attachment. */
export function withFileDownloadParam(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;

  try {
    const parsed = new URL(trimmed, "https://local.invalid");
    if (!parsed.pathname.startsWith("/api/files/")) return trimmed;
    parsed.searchParams.set("download", "1");
    return `${parsed.pathname}?${parsed.searchParams.toString()}`;
  } catch {
    if (/[?&]download=/.test(trimmed)) return trimmed;
    return trimmed.includes("?") ? `${trimmed}&download=1` : `${trimmed}?download=1`;
  }
}

function openOrDownloadFile(url: string, fileName?: string, forceDownload = false) {
  const href = forceDownload ? withFileDownloadParam(url) : url;
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  if (forceDownload && fileName?.trim()) {
    anchor.setAttribute("download", fileName.trim());
  }
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

interface DirectiveFileLinkProps {
  url: string;
  title: string;
  subtitle?: string | null;
  fileName?: string | null;
  /** Prefer attachment download instead of inline preview. */
  forceDownload?: boolean;
  className?: string;
  children?: ReactNode;
}

/**
 * Reliable open/download control for directive letters and attachments.
 * Uses an explicit click handler so links keep working inside the ack overlay.
 */
export function DirectiveFileLink({
  url,
  title,
  subtitle,
  fileName,
  forceDownload = true,
  className,
  children,
}: DirectiveFileLinkProps) {
  if (!url.trim()) return null;

  return (
    <button
      type="button"
      className={cn(
        "inline-flex max-w-full items-start gap-2 text-start text-sm text-primary hover:underline",
        className
      )}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        openOrDownloadFile(url, fileName ?? title, forceDownload);
      }}
    >
      {children ?? (
        <>
          <Download className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="min-w-0">
            <span className="block font-medium text-foreground">{title}</span>
            {subtitle ? (
              <span className="block text-xs text-muted-foreground">{subtitle}</span>
            ) : null}
          </span>
        </>
      )}
    </button>
  );
}
