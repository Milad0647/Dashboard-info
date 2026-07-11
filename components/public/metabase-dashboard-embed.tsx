"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const DEFAULT_RELOAD_MS = 5 * 60 * 1000;
const FALLBACK_HEIGHT = 640;
const MIN_HEIGHT = 360;

function getMetabaseOrigin(embedUrl: string): string | null {
  try {
    return new URL(embedUrl.split("#")[0] ?? embedUrl).origin;
  } catch {
    return null;
  }
}

function loadMetabaseIframeResizer(origin: string): Promise<void> {
  const selector = `script[data-metabase-resizer="${origin}"]`;
  const existing = document.querySelector(selector) as HTMLScriptElement | null;

  if (existing?.dataset.loaded === "true") {
    return Promise.resolve();
  }

  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("iframeResizer load failed")), {
        once: true,
      });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `${origin}/app/iframeResizer.js`;
    script.async = true;
    script.dataset.metabaseResizer = origin;
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error("iframeResizer load failed"));
    document.body.appendChild(script);
  });
}

interface MetabaseDashboardEmbedProps {
  embedUrl: string;
  title?: string;
  reloadIntervalMs?: number;
}

function withMetabaseTheme(embedUrl: string, isDark: boolean): string {
  const theme = isDark ? "night" : "transparent";
  const [base, hash = ""] = embedUrl.split("#");
  const params = new URLSearchParams(hash);
  params.set("theme", theme);
  if (!params.has("bordered")) params.set("bordered", "false");
  if (!params.has("titled")) params.set("titled", "false");
  if (!params.has("background")) params.set("background", "false");
  if (!params.has("refresh")) params.set("refresh", "300");
  return `${base}#${params.toString()}`;
}

export function MetabaseDashboardEmbed({
  embedUrl,
  title = "Metabase dashboard",
  reloadIntervalMs = DEFAULT_RELOAD_MS,
}: MetabaseDashboardEmbedProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeKey, setIframeKey] = useState(0);
  const [height, setHeight] = useState(FALLBACK_HEIGHT);
  const [isLoading, setIsLoading] = useState(true);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const sync = () => setIsDark(document.documentElement.classList.contains("dark"));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const themedEmbedUrl = withMetabaseTheme(embedUrl, isDark);

  useEffect(() => {
    setIsLoading(true);
  }, [themedEmbedUrl, iframeKey]);

  useEffect(() => {
    const origin = getMetabaseOrigin(themedEmbedUrl);

    const onMessage = (event: MessageEvent) => {
      if (origin && event.origin !== origin) return;

      const payload = event.data?.metabase;
      if (payload?.type !== "frame") return;

      const nextHeight = Number(payload.frame?.height ?? 0);
      if (nextHeight >= MIN_HEIGHT) {
        setHeight(nextHeight);
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [themedEmbedUrl]);

  useEffect(() => {
    setHeight(FALLBACK_HEIGHT);
  }, [themedEmbedUrl, iframeKey]);

  useEffect(() => {
    const timer = setInterval(() => setIframeKey((value) => value + 1), reloadIntervalMs);
    return () => clearInterval(timer);
  }, [themedEmbedUrl, reloadIntervalMs]);

  useEffect(() => {
    const iframe = iframeRef.current;
    const origin = getMetabaseOrigin(themedEmbedUrl);
    if (!iframe || !origin) return;

    let cancelled = false;

    void loadMetabaseIframeResizer(origin)
      .then(() => {
        if (cancelled || !iframeRef.current) return;

        const resizer = (
          window as Window & {
            iFrameResize?: (options: Record<string, unknown>, target: HTMLIFrameElement) => void;
          }
        ).iFrameResize;

        if (resizer) {
          resizer(
            {
              checkOrigin: [origin],
              sizeHeight: true,
              autoResize: true,
              log: false,
            },
            iframeRef.current
          );
        }
      })
      .catch(() => {
        // postMessage height fallback remains active
      });

    return () => {
      cancelled = true;
    };
  }, [themedEmbedUrl, iframeKey]);

  return (
    <div className="relative w-full overflow-hidden rounded-xl border bg-background">
      {isLoading && (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-muted/60 backdrop-blur-[1px]"
          style={{ minHeight: `${MIN_HEIGHT}px` }}
        >
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">در حال بارگذاری داشبورد...</p>
          <Skeleton className="h-2 w-40" />
        </div>
      )}
      <iframe
        ref={iframeRef}
        key={`${iframeKey}-${isDark ? "dark" : "light"}`}
        src={themedEmbedUrl}
        title={title}
        className={cn("block w-full border-0 transition-opacity", isLoading ? "opacity-0" : "opacity-100")}
        style={{
          width: "1px",
          minWidth: "100%",
          height: `${height}px`,
          minHeight: `${MIN_HEIGHT}px`,
          overflow: "hidden",
        }}
        scrolling="no"
        allowTransparency
        onLoad={() => setIsLoading(false)}
      />
    </div>
  );
}
