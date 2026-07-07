"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAdminCampaign } from "@/components/admin/admin-campaign-provider";
import { adminHref } from "@/lib/utils";

export function AdminElanhaButton() {
  const { campaignId } = useAdminCampaign();

  return (
    <Button
      asChild
      variant="outline"
      size="icon"
      className="fixed top-4 left-4 z-40 shadow-sm lg:left-auto lg:right-[17rem]"
      title="اعلان‌ها"
    >
      <Link href={adminHref("/admin/elanha", campaignId)}>
        <Bell className="h-4 w-4" />
      </Link>
    </Button>
  );
}
