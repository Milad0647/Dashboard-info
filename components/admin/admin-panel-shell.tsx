"use client";

import { Suspense } from "react";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminElanhaButton } from "@/components/admin/admin-elanha-button";
import { AdminCampaignProvider } from "@/components/admin/admin-campaign-provider";
import type { CampaignSettings } from "@/lib/types";

function AdminPanelShell({
  campaigns,
  children,
}: {
  campaigns: CampaignSettings[];
  children: React.ReactNode;
}) {
  return (
    <AdminCampaignProvider campaigns={campaigns}>
      <div className="min-h-screen bg-background">
        <AdminSidebar />
        <AdminElanhaButton />
        <main className="lg:mr-64 min-h-screen">
          <div className="container mx-auto px-4 py-8 pt-16 lg:pt-8">{children}</div>
        </main>
      </div>
    </AdminCampaignProvider>
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
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <AdminPanelShell campaigns={campaigns}>{children}</AdminPanelShell>
    </Suspense>
  );
}
