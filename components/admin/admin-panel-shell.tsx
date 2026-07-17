"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminElanhaButton } from "@/components/admin/admin-elanha-button";
import {
  AdminCampaignProvider,
  AdminCampaignProviderStatic,
} from "@/components/admin/admin-campaign-provider";
import { AuditTracker } from "@/components/admin/audit-tracker";
import { ProblemReportButton } from "@/components/admin/problem-report-button";
import { ScrollToTopButton } from "@/components/ui/scroll-to-top-button";
import type { CampaignSettings } from "@/lib/types";

function NavigationPendingOverlay() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, setPending] = useState(false);
  const search = searchParams.toString();

  useEffect(() => {
    setPending(false);
  }, [pathname, search]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a");
      if (!anchor) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:")) return;
      try {
        const url = new URL(href, window.location.origin);
        if (url.origin !== window.location.origin) return;
        if (!url.pathname.startsWith("/admin")) return;
        if (url.pathname === window.location.pathname && url.search === window.location.search) {
          return;
        }
        setPending(true);
      } catch {
        // Ignore invalid hrefs.
      }
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  if (!pending) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[90] flex items-start justify-center pt-6 lg:pr-64">
      <div className="flex items-center gap-2 rounded-full border bg-card/95 px-4 py-2 text-sm text-muted-foreground shadow-lg backdrop-blur">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        در حال رفتن به صفحه…
      </div>
    </div>
  );
}

function PanelChrome({
  children,
  withTracker = false,
}: {
  children: React.ReactNode;
  withTracker?: boolean;
}) {
  return (
    <div className="min-h-screen bg-background">
      {withTracker ? (
        <Suspense fallback={null}>
          <AuditTracker />
        </Suspense>
      ) : null}
      <AdminSidebar />
      <AdminElanhaButton />
      <Suspense fallback={null}>
        <ProblemReportButton />
      </Suspense>
      <Suspense fallback={null}>
        <NavigationPendingOverlay />
      </Suspense>
      <main className="min-h-screen lg:mr-64">
        <div className="container mx-auto px-4 py-8 pt-16 lg:pt-8">{children}</div>
      </main>
      <ScrollToTopButton />
    </div>
  );
}

function AdminPanelShellInner({
  campaigns,
  children,
}: {
  campaigns: CampaignSettings[];
  children: React.ReactNode;
}) {
  const searchParams = useSearchParams();
  const defaultId = campaigns[0]?.id ?? "";
  const campaignId = searchParams.get("campaign") ?? defaultId;

  return (
    <AdminCampaignProvider campaigns={campaigns} campaignId={campaignId}>
      <PanelChrome withTracker>{children}</PanelChrome>
    </AdminCampaignProvider>
  );
}

function AdminPanelShellFallback({
  campaigns,
  children,
}: {
  campaigns: CampaignSettings[];
  children: React.ReactNode;
}) {
  const defaultId = campaigns[0]?.id ?? "";
  return (
    <AdminCampaignProviderStatic campaigns={campaigns} campaignId={defaultId}>
      <PanelChrome>
        {children ?? (
          <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
      </PanelChrome>
    </AdminCampaignProviderStatic>
  );
}

export default function AdminPanelLayout({
  campaigns,
  children,
}: {
  campaigns: CampaignSettings[];
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<AdminPanelShellFallback campaigns={campaigns}>{children}</AdminPanelShellFallback>}>
      <AdminPanelShellInner campaigns={campaigns}>{children}</AdminPanelShellInner>
    </Suspense>
  );
}
