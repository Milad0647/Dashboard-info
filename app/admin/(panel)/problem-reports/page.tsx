import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ProblemReportsPageClient } from "@/components/admin/problem-reports-page-client";
import { getAuthSession } from "@/lib/auth/get-session";
import { pgCountMyUnreadProblemReplies } from "@/lib/db/problem-reports-repository";
import { isPostgresConfigured } from "@/lib/utils";

export default async function ProblemReportsPage() {
  const session = await getAuthSession();
  if (!session) redirect("/admin/login");

  let unreadCount = 0;
  if (isPostgresConfigured()) {
    unreadCount = await pgCountMyUnreadProblemReplies({
      reporterUserId: session.userId,
      reporterType: session.type === "env_admin" ? "env_admin" : "db_user",
    });
  }

  return (
    <Suspense fallback={null}>
      <ProblemReportsPageClient initialUnreadCount={unreadCount} />
    </Suspense>
  );
}
