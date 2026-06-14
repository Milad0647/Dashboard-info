"use client";

import { useEffect, useRef, useState } from "react";

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

export function MetabaseDashboardEmbed({
  embedUrl,
  title = "Metabase dashboard",
  reloadIntervalMs = DEFAULT_RELOAD_MS,
}: MetabaseDashboardEmbedProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeKey, setIframeKey] = useState(0);
  const [height, setHeight] = useState(FALLBACK_HEIGHT);

  useEffect(() => {
    const origin = getMetabaseOrigin(embedUrl);

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
  }, [embedUrl]);

  useEffect(() => {
    setHeight(FALLBACK_HEIGHT);
  }, [embedUrl, iframeKey]);

  useEffect(() => {
    const timer = setInterval(() => setIframeKey((value) => value + 1), reloadIntervalMs);
    return () => clearInterval(timer);
  }, [embedUrl, reloadIntervalMs]);

  useEffect(() => {
    const iframe = iframeRef.current;
    const origin = getMetabaseOrigin(embedUrl);
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
  }, [embedUrl, iframeKey]);

  return (
    <div className="w-full overflow-hidden rounded-xl border bg-background">
      <iframe
        ref={iframeRef}
        key={iframeKey}
        src={embedUrl}
        title={title}
        className="block w-full border-0"
        style={{
          width: "1px",
          minWidth: "100%",
          height: `${height}px`,
          minHeight: `${MIN_HEIGHT}px`,
          overflow: "hidden",
        }}
        scrolling="no"
        allowTransparency
      />
    </div>
  );
}
