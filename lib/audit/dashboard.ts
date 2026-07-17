import {
  pgGetAuditDailySeries,
  pgGetAuditSummaryCounts,
  pgGetAuditTopActions,
  pgGetAuditTopActors,
  pgGetAuditTopClicks,
  pgGetAuditTopPaths,
  pgGetOnlineUsers,
  pgGetUserContentContributions,
  pgListAuditEvents,
} from "@/lib/db/audit-repository";
import type { AuditDashboardData } from "@/lib/audit/types";

export async function getAuditDashboardData(): Promise<AuditDashboardData> {
  const [
    summary,
    dailySeries,
    topActors,
    onlineUsers,
    topActions,
    topPaths,
    topClicks,
    recentEvents,
    contentByUser,
    logins,
  ] = await Promise.all([
    pgGetAuditSummaryCounts(),
    pgGetAuditDailySeries(14),
    pgGetAuditTopActors(12),
    pgGetOnlineUsers(5),
    pgGetAuditTopActions(12),
    pgGetAuditTopPaths(12),
    pgGetAuditTopClicks(15),
    pgListAuditEvents({ limit: 200 }),
    pgGetUserContentContributions(),
    pgListAuditEvents({ action: "auth.login", limit: 50 }),
  ]);

  return {
    summary: {
      ...summary,
      onlineUsers: onlineUsers.length,
    },
    dailySeries,
    topActors,
    onlineUsers,
    topActions,
    topPaths,
    topClicks,
    // Heartbeats are presence-only noise for the event log.
    recentEvents: recentEvents.filter((event) => event.action !== "presence.heartbeat"),
    contentByUser,
    logins,
  };
}
