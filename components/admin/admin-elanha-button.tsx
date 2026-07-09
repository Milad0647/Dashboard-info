"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAdminCampaign } from "@/components/admin/admin-campaign-provider";
import { getSessionContextAction } from "@/lib/actions/extended-actions";
import { adminHref } from "@/lib/utils";

export function AdminElanhaButton() {
  const { campaignId } = useAdminCampaign();
  const [canAccess, setCanAccess] = useState(false);

  useEffect(() => {
    getSessionContextAction(campaignId).then((session) => {
      if (!session) return;
      const isAdmin = session.type === "env_admin" || session.role === "admin";
      setCanAccess(isAdmin || session.role === "client");
    });
  }, [campaignId]);

  if (!canAccess) return null;

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
