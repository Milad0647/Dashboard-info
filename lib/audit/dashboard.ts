import {
  pgGetAllUsersPresence,
  pgGetAuditDailySeries,
  pgGetAuditSummaryCounts,
  pgGetAuditTopActions,
  pgGetAuditTopActors,
  pgGetAuditTopClicks,
  pgGetAuditTopPaths,
  pgGetFailedLoginsToday,
  pgGetLoginsToday,
  pgGetOnlineUsers,
  pgGetUserContentContributions,
  pgListAuditEvents,
} from "@/lib/db/audit-repository";
import {
  pgCountOpenProblemReports,
  pgListProblemReports,
} from "@/lib/db/problem-reports-repository";
import { pgGetStuckBehaviorSignals } from "@/lib/db/stuck-signals-repository";
import type { AuditDashboardData } from "@/lib/audit/types";
import type { ProblemReport, StuckBehaviorSignal } from "@/lib/audit/problem-types";
import { withFileAccessTokensDeep } from "@/lib/uploads";

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.error("Audit dashboard partial load failed:", error);
    return fallback;
  }
}

export async function getAuditDashboardData(): Promise<AuditDashboardData> {
  const [
    summary,
    dailySeries,
    topActors,
    loginsTodayList,
    failedLoginsTodayList,
    onlineUsers,
    allUsersPresence,
    topActions,
    topPaths,
    topClicks,
    recentEvents,
    contentByUser,
    logins,
    problemReports,
    openProblemReports,
    stuckSignals,
  ] = await Promise.all([
    pgGetAuditSummaryCounts(),
    pgGetAuditDailySeries(14),
    pgGetAuditTopActors(12),
    safe(() => pgGetLoginsToday(50), []),
    safe(() => pgGetFailedLoginsToday(50), []),
    pgGetOnlineUsers(5),
    safe(() => pgGetAllUsersPresence(5), []),
    pgGetAuditTopActions(12),
    pgGetAuditTopPaths(12),
    pgGetAuditTopClicks(15),
    pgListAuditEvents({ limit: 200 }),
    pgGetUserContentContributions(),
    pgListAuditEvents({ action: "auth.login", limit: 50 }),
    safe<ProblemReport[]>(() => pgListProblemReports({ limit: 100 }), []),
    safe(() => pgCountOpenProblemReports(), 0),
    safe<StuckBehaviorSignal[]>(() => pgGetStuckBehaviorSignals(), []),
  ]);

  return {
    summary: {
      ...summary,
      onlineUsers: onlineUsers.length,
      openProblemReports,
      stuckSignals: stuckSignals.length,
    },
    dailySeries,
    topActors,
    loginsTodayList,
    failedLoginsTodayList,
    onlineUsers,
    allUsersPresence,
    topActions,
    topPaths,
    topClicks,
    // Heartbeats are presence-only noise for the event log.
    recentEvents: recentEvents.filter((event) => event.action !== "presence.heartbeat"),
    contentByUser,
    logins,
    problemReports: withFileAccessTokensDeep(problemReports),
    stuckSignals,
  };
}
