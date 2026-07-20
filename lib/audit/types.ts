export type AuditCategory = "auth" | "navigation" | "content" | "ui" | "admin" | "system";
export type AuditActorType = "env_admin" | "db_user" | "anonymous";

export interface AuditEventInput {
  actorUserId?: string | null;
  actorType?: AuditActorType;
  actorEmail?: string | null;
  actorName?: string | null;
  actorRole?: string | null;
  category: AuditCategory;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  campaignId?: string | null;
  label?: string | null;
  path?: string | null;
  method?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface AuditEvent {
  id: string;
  actorUserId: string | null;
  actorType: AuditActorType;
  actorEmail: string | null;
  actorName: string | null;
  actorRole: string | null;
  category: AuditCategory;
  action: string;
  entityType: string | null;
  entityId: string | null;
  campaignId: string | null;
  label: string | null;
  path: string | null;
  method: string | null;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface AuditEventFilters {
  actorUserId?: string;
  category?: AuditCategory;
  action?: string;
  entityType?: string;
  campaignId?: string;
  search?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
  /** When true, omit presence.heartbeat rows from the result. */
  excludeHeartbeat?: boolean;
}

export interface AuditDailyPoint {
  date: string;
  total: number;
  logins: number;
  content: number;
  navigation: number;
  clicks: number;
}

export interface AuditActorSummary {
  actorKey: string;
  actorUserId: string | null;
  actorName: string;
  actorEmail: string | null;
  actorRole: string | null;
  eventCount: number;
  loginCount: number;
  contentCreateCount: number;
  contentUpdateCount: number;
  contentDeleteCount: number;
  pageViewCount: number;
  clickCount: number;
  lastSeenAt: string | null;
  isOnline?: boolean;
}

export interface OnlineUser {
  actorKey: string;
  actorUserId: string | null;
  actorName: string;
  actorEmail: string | null;
  actorRole: string | null;
  lastSeenAt: string;
  path: string | null;
}

/** All registered users with today-login + live presence flags for the audit roster. */
export interface AuditUserPresence {
  userId: string;
  name: string;
  email: string;
  role: string;
  loggedInToday: boolean;
  loginCountToday: number;
  lastLoginAt: string | null;
  isOnline: boolean;
  /** Most recent meaningful activity (excludes heartbeat / login_failed). */
  lastSeenAt: string | null;
  lastAction: string | null;
  lastLabel: string | null;
  path: string | null;
}

export interface AuditActionSummary {
  action: string;
  category: AuditCategory;
  count: number;
}

export interface AuditPathSummary {
  path: string;
  count: number;
}

export interface AuditClickSummary {
  label: string;
  path: string | null;
  count: number;
}

export interface UserContentContribution {
  userId: string;
  name: string;
  email: string;
  role: string;
  billboards: number;
  posters: number;
  videos: number;
  files: number;
  rawMedia: number;
  socialPosts: number;
  activities: number;
  broadcast: number;
  meetings: number;
  analytics: number;
  submissions: number;
  total: number;
}

export interface AuditDashboardData {
  summary: {
    totalEvents: number;
    eventsToday: number;
    loginsToday: number;
    failedLoginsToday: number;
    onlineUsers: number;
    openProblemReports: number;
    stuckSignals: number;
    contentChangesToday: number;
    pageViewsToday: number;
    clicksToday: number;
  };
  dailySeries: AuditDailyPoint[];
  topActors: AuditActorSummary[];
  loginsTodayList: AuditEvent[];
  failedLoginsTodayList: AuditEvent[];
  onlineUsers: OnlineUser[];
  allUsersPresence: AuditUserPresence[];
  topActions: AuditActionSummary[];
  topPaths: AuditPathSummary[];
  topClicks: AuditClickSummary[];
  recentEvents: AuditEvent[];
  contentByUser: UserContentContribution[];
  logins: AuditEvent[];
  problemReports: import("./problem-types").ProblemReport[];
  stuckSignals: import("./problem-types").StuckBehaviorSignal[];
}

