"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { exportCampaignScreenshotPdf } from "@/lib/client/campaign-screenshot-pdf";

interface CampaignScreenshotExporterProps {
  slug: string;
  title: string;
}

export function CampaignScreenshotExporter({ slug, title }: CampaignScreenshotExporterProps) {
  const [status, setStatus] = useState("در حال بارگذاری صفحه...");

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const sections = document.querySelectorAll("[data-export-section]");
      for (const section of sections) {
        section.scrollIntoView({ block: "center" });
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      if (cancelled) return;

      try {
        await exportCampaignScreenshotPdf({
          filename: `report-${slug}-${new Date().toISOString().split("T")[0]}.pdf`,
          onProgress: (current, total, label) => {
            if (!cancelled) {
              setStatus(`اسکرین‌شات ${current} از ${total}: ${label}`);
            }
          },
        });

        if (!cancelled) {
          setStatus("گزارش با موفقیت دانلود شد. می‌توانید این پنجره را ببندید.");
          setTimeout(() => window.close(), 2000);
        }
      } catch (error) {
        console.error("Screenshot export failed:", error);
        if (!cancelled) {
          setStatus("خطا در ساخت گزارش. لطفاً دوباره تلاش کنید.");
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [slug, title]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <div className="rounded-xl border bg-card p-8 text-center space-y-4 max-w-md mx-4 shadow-lg">
        <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
        <div>
          <p className="font-semibold">در حال ساخت گزارش تصویری</p>
          <p className="text-sm text-muted-foreground mt-1">{title}</p>
        </div>
        <p className="text-sm text-muted-foreground">{status}</p>
      </div>
    </div>
  );
}
