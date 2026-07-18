"use client";

import { ProblemReportsPanel } from "@/components/admin/problem-reports-panel";
import { emitProblemReportsUnreadChanged } from "@/lib/problem-reports-unread";

export function ProblemReportsPageClient({
  initialUnreadCount,
}: {
  initialUnreadCount: number;
}) {
  return (
    <ProblemReportsPanel
      initialTab={initialUnreadCount > 0 ? "history" : "new"}
      onUnreadChange={emitProblemReportsUnreadChanged}
    />
  );
}
