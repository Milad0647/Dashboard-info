import { getSql } from "@/lib/db/client";
import { isPostgresConfigured } from "@/lib/utils";
import type {
  AuditActionSummary,
  AuditActorSummary,
  AuditClickSummary,
  AuditDailyPoint,
  AuditEvent,
  AuditEventFilters,
  AuditEventInput,
  AuditPathSummary,
  UserContentContribution,
} from "@/lib/audit/types";

/** Midnight today in Asia/Tehran, as a UTC Date (Iran has no DST). */
function getTehranTodayStart(): Date {
  const tehranDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return new Date(`${tehranDate}T00:00:00+03:30`);
}

function mapAuditRow(row: Record<string, unknown>): AuditEvent {
  const metadata =
    row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};

  return {
    id: String(row.id),
    actorUserId: row.actor_user_id ? String(row.actor_user_id) : null,
    actorType: (row.actor_type as AuditEvent["actorType"]) ?? "anonymous",
    actorEmail: row.actor_email ? String(row.actor_email) : null,
    actorName: row.actor_name ? String(row.actor_name) : null,
    actorRole: row.actor_role ? String(row.actor_role) : null,
    category: row.category as AuditEvent["category"],
    action: String(row.action),
    entityType: row.entity_type ? String(row.entity_type) : null,
    entityId: row.entity_id ? String(row.entity_id) : null,
    campaignId: row.campaign_id ? String(row.campaign_id) : null,
    label: row.label ? String(row.label) : null,
    path: row.path ? String(row.path) : null,
    method: row.method ? String(row.method) : null,
    metadata,
    ipAddress: row.ip_address ? String(row.ip_address) : null,
    userAgent: row.user_agent ? String(row.user_agent) : null,
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

export async function pgInsertAuditEvent(input: AuditEventInput): Promise<void> {
  if (!isPostgresConfigured()) return;

  const sql = getSql();
  await sql`
    INSERT INTO user_audit_events (
      actor_user_id,
      actor_type,
      actor_email,
      actor_name,
      actor_role,
      category,
      action,
      entity_type,
      entity_id,
      campaign_id,
      label,
      path,
      method,
      metadata,
      ip_address,
      user_agent
    ) VALUES (
      ${input.actorUserId ?? null},
      ${input.actorType ?? (input.actorUserId ? "db_user" : "anonymous")},
      ${input.actorEmail ?? null},
      ${input.actorName ?? null},
      ${input.actorRole ?? null},
      ${input.category},
      ${input.action},
      ${input.entityType ?? null},
      ${input.entityId ?? null},
      ${input.campaignId ?? null},
      ${input.label ?? null},
      ${input.path ?? null},
      ${input.method ?? null},
      ${sql.json(JSON.parse(JSON.stringify(input.metadata ?? {})))},
      ${input.ipAddress ?? null},
      ${input.userAgent ?? null}
    )
  `;
}

export async function pgListAuditEvents(filters: AuditEventFilters = {}): Promise<AuditEvent[]> {
  if (!isPostgresConfigured()) return [];

  const sql = getSql();
  const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500);
  const offset = Math.max(filters.offset ?? 0, 0);
  const search = filters.search?.trim() || null;

  const rows = await sql`
    SELECT *
    FROM user_audit_events
    WHERE 1=1
      AND (${filters.actorUserId ?? null}::uuid IS NULL OR actor_user_id = ${filters.actorUserId ?? null})
      AND (${filters.category ?? null}::text IS NULL OR category = ${filters.category ?? null})
      AND (${filters.action ?? null}::text IS NULL OR action = ${filters.action ?? null})
      AND (${filters.entityType ?? null}::text IS NULL OR entity_type = ${filters.entityType ?? null})
      AND (${filters.campaignId ?? null}::uuid IS NULL OR campaign_id = ${filters.campaignId ?? null})
      AND (${filters.from ?? null}::timestamptz IS NULL OR created_at >= ${filters.from ?? null}::timestamptz)
      AND (${filters.to ?? null}::timestamptz IS NULL OR created_at <= ${filters.to ?? null}::timestamptz)
      AND (${filters.excludeHeartbeat ? true : null}::boolean IS NULL OR action <> 'presence.heartbeat')
      AND (
        ${search}::text IS NULL
        OR actor_name ILIKE ${search ? `%${search}%` : null}
        OR actor_email ILIKE ${search ? `%${search}%` : null}
        OR action ILIKE ${search ? `%${search}%` : null}
        OR label ILIKE ${search ? `%${search}%` : null}
        OR path ILIKE ${search ? `%${search}%` : null}
        OR entity_type ILIKE ${search ? `%${search}%` : null}
      )
    ORDER BY created_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  return rows.map((row) => mapAuditRow(row as Record<string, unknown>));
}

export async function pgGetAuditSummaryCounts() {
  if (!isPostgresConfigured()) {
    return {
      totalEvents: 0,
      eventsToday: 0,
      loginsToday: 0,
      failedLoginsToday: 0,
      onlineUsers: 0,
      contentChangesToday: 0,
      pageViewsToday: 0,
      clicksToday: 0,
    };
  }

  const sql = getSql();
  const todayStart = getTehranTodayStart();
  const rows = await sql`
    SELECT
      COUNT(*)::int AS total_events,
      COUNT(*) FILTER (WHERE created_at >= ${todayStart})::int AS events_today,
      COUNT(*) FILTER (
        WHERE action = 'auth.login' AND created_at >= ${todayStart}
      )::int AS logins_today,
      COUNT(*) FILTER (
        WHERE action = 'auth.login_failed' AND created_at >= ${todayStart}
      )::int AS failed_logins_today,
      COUNT(DISTINCT COALESCE(actor_user_id::text, NULLIF(actor_email, ''), NULLIF(actor_name, ''))) FILTER (
        WHERE created_at >= now() - interval '5 minutes'
          AND action <> 'auth.login_failed'
      )::int AS online_users,
      COUNT(*) FILTER (
        WHERE category = 'content' AND created_at >= ${todayStart}
      )::int AS content_changes_today,
      COUNT(*) FILTER (
        WHERE action = 'navigation.page_view' AND created_at >= ${todayStart}
      )::int AS page_views_today,
      COUNT(*) FILTER (
        WHERE action = 'ui.click' AND created_at >= ${todayStart}
      )::int AS clicks_today
    FROM user_audit_events
  `;

  const row = rows[0] ?? {};
  return {
    totalEvents: Number(row.total_events ?? 0),
    eventsToday: Number(row.events_today ?? 0),
    loginsToday: Number(row.logins_today ?? 0),
    failedLoginsToday: Number(row.failed_logins_today ?? 0),
    onlineUsers: Number(row.online_users ?? 0),
    contentChangesToday: Number(row.content_changes_today ?? 0),
    pageViewsToday: Number(row.page_views_today ?? 0),
    clicksToday: Number(row.clicks_today ?? 0),
  };
}

export async function pgGetAuditDailySeries(days = 14): Promise<AuditDailyPoint[]> {
  if (!isPostgresConfigured()) return [];

  const sql = getSql();
  const safeDays = Math.min(Math.max(days, 1), 90);
  const rows = await sql`
    WITH days AS (
      SELECT generate_series(
        date_trunc('day', now()) - ((${safeDays} - 1) * interval '1 day'),
        date_trunc('day', now()),
        interval '1 day'
      )::date AS day
    )
    SELECT
      days.day::text AS date,
      COALESCE(COUNT(e.id), 0)::int AS total,
      COALESCE(COUNT(e.id) FILTER (WHERE e.action = 'auth.login'), 0)::int AS logins,
      COALESCE(COUNT(e.id) FILTER (WHERE e.category = 'content'), 0)::int AS content,
      COALESCE(COUNT(e.id) FILTER (WHERE e.action = 'navigation.page_view'), 0)::int AS navigation,
      COALESCE(COUNT(e.id) FILTER (WHERE e.action = 'ui.click'), 0)::int AS clicks
    FROM days
    LEFT JOIN user_audit_events e
      ON date_trunc('day', e.created_at)::date = days.day
    GROUP BY days.day
    ORDER BY days.day ASC
  `;

  return rows.map((row) => ({
    date: String(row.date).slice(0, 10),
    total: Number(row.total ?? 0),
    logins: Number(row.logins ?? 0),
    content: Number(row.content ?? 0),
    navigation: Number(row.navigation ?? 0),
    clicks: Number(row.clicks ?? 0),
  }));
}

function mapAuditActorRow(row: Record<string, unknown>): AuditActorSummary {
  const actorName =
    String(row.user_name ?? "").trim() ||
    String(row.event_name ?? "").trim() ||
    String(row.user_email ?? "").trim() ||
    String(row.event_email ?? "").trim() ||
    "ناشناس";
  const actorEmail =
    String(row.user_email ?? "").trim() ||
    String(row.event_email ?? "").trim() ||
    null;
  const actorRole =
    String(row.user_role ?? "").trim() ||
    String(row.event_role ?? "").trim() ||
    null;
  const lastSeenAt = row.last_seen_at
    ? new Date(String(row.last_seen_at)).toISOString()
    : null;
  const isOnline = lastSeenAt
    ? Date.now() - new Date(lastSeenAt).getTime() <= 5 * 60 * 1000
    : false;

  return {
    actorKey: String(row.actor_key),
    actorUserId: row.actor_user_id ? String(row.actor_user_id) : null,
    actorName,
    actorEmail,
    actorRole,
    eventCount: Number(row.event_count ?? 0),
    loginCount: Number(row.login_count ?? 0),
    contentCreateCount: Number(row.content_create_count ?? 0),
    contentUpdateCount: Number(row.content_update_count ?? 0),
    contentDeleteCount: Number(row.content_delete_count ?? 0),
    pageViewCount: Number(row.page_view_count ?? 0),
    clickCount: Number(row.click_count ?? 0),
    lastSeenAt,
    isOnline,
  };
}

async function pgGetAuditActorSummaries(limit: number): Promise<AuditActorSummary[]> {
  if (!isPostgresConfigured()) return [];

  const sql = getSql();
  const safeLimit = Math.min(Math.max(limit, 1), 50);
  const rows = await sql`
    WITH ranked AS (
      SELECT
        COALESCE(e.actor_user_id::text, NULLIF(e.actor_email, ''), NULLIF(e.actor_name, ''), 'unknown') AS actor_key,
        e.actor_user_id,
        NULLIF(MAX(e.actor_name), '') AS event_name,
        NULLIF(MAX(e.actor_email), '') AS event_email,
        NULLIF(MAX(e.actor_role), '') AS event_role,
        MAX(u.name) AS user_name,
        MAX(u.email) AS user_email,
        MAX(u.role) AS user_role,
        COUNT(*)::int AS event_count,
        COUNT(*) FILTER (WHERE e.action = 'auth.login')::int AS login_count,
        COUNT(*) FILTER (WHERE e.action = 'content.create')::int AS content_create_count,
        COUNT(*) FILTER (WHERE e.action = 'content.update')::int AS content_update_count,
        COUNT(*) FILTER (WHERE e.action = 'content.delete')::int AS content_delete_count,
        COUNT(*) FILTER (WHERE e.action = 'navigation.page_view')::int AS page_view_count,
        COUNT(*) FILTER (WHERE e.action = 'ui.click')::int AS click_count,
        MAX(e.created_at) AS last_seen_at
      FROM user_audit_events e
      LEFT JOIN users u ON u.id = e.actor_user_id
      WHERE e.action NOT IN ('auth.login_failed', 'presence.heartbeat')
      GROUP BY
        COALESCE(e.actor_user_id::text, NULLIF(e.actor_email, ''), NULLIF(e.actor_name, ''), 'unknown'),
        e.actor_user_id
    )
    SELECT *
    FROM ranked
    ORDER BY event_count DESC
    LIMIT ${safeLimit}
  `;

  return rows.map((row) => mapAuditActorRow(row as Record<string, unknown>));
}

export async function pgGetAuditTopActors(limit = 10): Promise<AuditActorSummary[]> {
  return pgGetAuditActorSummaries(limit);
}

export async function pgGetLoginsToday(limit = 50): Promise<AuditEvent[]> {
  if (!isPostgresConfigured()) return [];

  const sql = getSql();
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const todayStart = getTehranTodayStart();
  const rows = await sql`
    SELECT
      e.id,
      e.actor_user_id,
      e.actor_type,
      COALESCE(u.email, e.actor_email) AS actor_email,
      COALESCE(u.name, e.actor_name) AS actor_name,
      COALESCE(u.role, e.actor_role) AS actor_role,
      e.category,
      e.action,
      e.entity_type,
      e.entity_id,
      e.campaign_id,
      e.label,
      e.path,
      e.method,
      e.metadata,
      e.ip_address,
      e.user_agent,
      e.created_at
    FROM user_audit_events e
    LEFT JOIN users u ON u.id = e.actor_user_id
    WHERE e.action = 'auth.login'
      AND e.created_at >= ${todayStart}
    ORDER BY e.created_at DESC
    LIMIT ${safeLimit}
  `;

  return rows.map((row) => mapAuditRow(row as Record<string, unknown>));
}

export async function pgGetFailedLoginsToday(limit = 50): Promise<AuditEvent[]> {
  if (!isPostgresConfigured()) return [];

  const sql = getSql();
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const todayStart = getTehranTodayStart();
  const rows = await sql`
    SELECT
      e.id,
      e.actor_user_id,
      e.actor_type,
      e.actor_email,
      e.actor_name,
      e.actor_role,
      e.category,
      e.action,
      e.entity_type,
      e.entity_id,
      e.campaign_id,
      e.label,
      e.path,
      e.method,
      e.metadata,
      e.ip_address,
      e.user_agent,
      e.created_at
    FROM user_audit_events e
    WHERE e.action = 'auth.login_failed'
      AND e.created_at >= ${todayStart}
    ORDER BY e.created_at DESC
    LIMIT ${safeLimit}
  `;

  return rows.map((row) => mapAuditRow(row as Record<string, unknown>));
}

export async function pgGetOnlineUsers(withinMinutes = 5): Promise<
  import("@/lib/audit/types").OnlineUser[]
> {
  if (!isPostgresConfigured()) return [];

  const sql = getSql();
  const minutes = Math.min(Math.max(withinMinutes, 1), 60);
  const rows = await sql`
    WITH latest AS (
      SELECT DISTINCT ON (
        COALESCE(e.actor_user_id::text, NULLIF(e.actor_email, ''), NULLIF(e.actor_name, ''), 'unknown')
      )
        COALESCE(e.actor_user_id::text, NULLIF(e.actor_email, ''), NULLIF(e.actor_name, ''), 'unknown') AS actor_key,
        e.actor_user_id,
        NULLIF(e.actor_name, '') AS event_name,
        NULLIF(e.actor_email, '') AS event_email,
        NULLIF(e.actor_role, '') AS event_role,
        e.path,
        e.created_at,
        u.name AS user_name,
        u.email AS user_email,
        u.role AS user_role
      FROM user_audit_events e
      LEFT JOIN users u ON u.id = e.actor_user_id
      WHERE e.created_at >= now() - (${minutes} * interval '1 minute')
        AND e.action <> 'auth.login_failed'
      ORDER BY
        COALESCE(e.actor_user_id::text, NULLIF(e.actor_email, ''), NULLIF(e.actor_name, ''), 'unknown'),
        e.created_at DESC
    )
    SELECT * FROM latest
    ORDER BY created_at DESC
  `;

  return rows.map((row) => {
    const actorName =
      String(row.user_name ?? "").trim() ||
      String(row.event_name ?? "").trim() ||
      String(row.user_email ?? "").trim() ||
      String(row.event_email ?? "").trim() ||
      "ناشناس";
    const actorEmail =
      String(row.user_email ?? "").trim() ||
      String(row.event_email ?? "").trim() ||
      null;
    const actorRole =
      String(row.user_role ?? "").trim() ||
      String(row.event_role ?? "").trim() ||
      null;

    return {
      actorKey: String(row.actor_key),
      actorUserId: row.actor_user_id ? String(row.actor_user_id) : null,
      actorName,
      actorEmail,
      actorRole,
      lastSeenAt: new Date(String(row.created_at)).toISOString(),
      path: row.path ? String(row.path) : null,
    };
  });
}

/** All DB users with today-login and online (5-minute) presence flags. */
export async function pgGetAllUsersPresence(
  withinMinutes = 5
): Promise<import("@/lib/audit/types").AuditUserPresence[]> {
  if (!isPostgresConfigured()) return [];

  const sql = getSql();
  const minutes = Math.min(Math.max(withinMinutes, 1), 60);
  const todayStart = getTehranTodayStart();
  const rows = await sql`
    WITH today_logins AS (
      SELECT
        e.actor_user_id,
        MAX(e.created_at) AS last_login_at,
        COUNT(*)::int AS login_count
      FROM user_audit_events e
      WHERE e.action = 'auth.login'
        AND e.created_at >= ${todayStart}
        AND e.actor_user_id IS NOT NULL
      GROUP BY e.actor_user_id
    ),
    online AS (
      SELECT DISTINCT ON (e.actor_user_id)
        e.actor_user_id,
        e.created_at AS last_seen_at,
        e.path
      FROM user_audit_events e
      WHERE e.created_at >= now() - (${minutes} * interval '1 minute')
        AND e.action <> 'auth.login_failed'
        AND e.actor_user_id IS NOT NULL
      ORDER BY e.actor_user_id, e.created_at DESC
    )
    SELECT
      u.id,
      u.name,
      u.email,
      u.role,
      (tl.actor_user_id IS NOT NULL) AS logged_in_today,
      COALESCE(tl.login_count, 0) AS login_count_today,
      tl.last_login_at,
      (o.actor_user_id IS NOT NULL) AS is_online,
      o.last_seen_at,
      o.path
    FROM users u
    LEFT JOIN today_logins tl ON tl.actor_user_id = u.id
    LEFT JOIN online o ON o.actor_user_id = u.id
    ORDER BY
      (o.actor_user_id IS NOT NULL) DESC,
      (tl.actor_user_id IS NOT NULL) DESC,
      u.name ASC NULLS LAST,
      u.email ASC
  `;

  return rows.map((row) => ({
    userId: String(row.id),
    name: String(row.name ?? "").trim() || String(row.email ?? "").trim() || "ناشناس",
    email: String(row.email ?? "").trim(),
    role: String(row.role ?? "").trim(),
    loggedInToday: Boolean(row.logged_in_today),
    loginCountToday: Number(row.login_count_today ?? 0),
    lastLoginAt: row.last_login_at
      ? new Date(String(row.last_login_at)).toISOString()
      : null,
    isOnline: Boolean(row.is_online),
    lastSeenAt: row.last_seen_at
      ? new Date(String(row.last_seen_at)).toISOString()
      : null,
    path: row.path ? String(row.path) : null,
  }));
}

export async function pgGetAuditTopActions(limit = 12): Promise<AuditActionSummary[]> {
  if (!isPostgresConfigured()) return [];

  const sql = getSql();
  const safeLimit = Math.min(Math.max(limit, 1), 50);
  const rows = await sql`
    SELECT action, category, COUNT(*)::int AS count
    FROM user_audit_events
    GROUP BY action, category
    ORDER BY count DESC
    LIMIT ${safeLimit}
  `;

  return rows.map((row) => ({
    action: String(row.action),
    category: row.category as AuditActionSummary["category"],
    count: Number(row.count ?? 0),
  }));
}

export async function pgGetAuditTopPaths(limit = 12): Promise<AuditPathSummary[]> {
  if (!isPostgresConfigured()) return [];

  const sql = getSql();
  const safeLimit = Math.min(Math.max(limit, 1), 50);
  const rows = await sql`
    SELECT path, COUNT(*)::int AS count
    FROM user_audit_events
    WHERE action = 'navigation.page_view'
      AND path IS NOT NULL
      AND path <> ''
    GROUP BY path
    ORDER BY count DESC
    LIMIT ${safeLimit}
  `;

  return rows.map((row) => ({
    path: String(row.path),
    count: Number(row.count ?? 0),
  }));
}

export async function pgGetAuditTopClicks(limit = 15): Promise<AuditClickSummary[]> {
  if (!isPostgresConfigured()) return [];

  const sql = getSql();
  const safeLimit = Math.min(Math.max(limit, 1), 50);
  const rows = await sql`
    SELECT
      COALESCE(NULLIF(label, ''), '(بدون برچسب)') AS label,
      path,
      COUNT(*)::int AS count
    FROM user_audit_events
    WHERE action = 'ui.click'
    GROUP BY COALESCE(NULLIF(label, ''), '(بدون برچسب)'), path
    ORDER BY count DESC
    LIMIT ${safeLimit}
  `;

  return rows.map((row) => ({
    label: String(row.label),
    path: row.path ? String(row.path) : null,
    count: Number(row.count ?? 0),
  }));
}

/** Historical content ownership counts (independent of audit trail). */
export async function pgGetUserContentContributions(): Promise<UserContentContribution[]> {
  if (!isPostgresConfigured()) return [];

  const sql = getSql();
  const rows = await sql`
    WITH counts AS (
      SELECT owner_user_id AS user_id, 'billboards' AS kind, COUNT(*)::int AS c FROM billboards WHERE owner_user_id IS NOT NULL GROUP BY owner_user_id
      UNION ALL
      SELECT owner_user_id, 'posters', COUNT(*)::int FROM posters WHERE owner_user_id IS NOT NULL GROUP BY owner_user_id
      UNION ALL
      SELECT owner_user_id, 'videos', COUNT(*)::int FROM videos WHERE owner_user_id IS NOT NULL GROUP BY owner_user_id
      UNION ALL
      SELECT owner_user_id, 'files', COUNT(*)::int FROM campaign_files WHERE owner_user_id IS NOT NULL GROUP BY owner_user_id
      UNION ALL
      SELECT owner_user_id, 'rawMedia', COUNT(*)::int FROM raw_media_uploads WHERE owner_user_id IS NOT NULL GROUP BY owner_user_id
      UNION ALL
      SELECT owner_user_id, 'socialPosts', COUNT(*)::int FROM social_media_posts WHERE owner_user_id IS NOT NULL GROUP BY owner_user_id
      UNION ALL
      SELECT owner_user_id, 'activities', COUNT(*)::int FROM campaign_activities WHERE owner_user_id IS NOT NULL GROUP BY owner_user_id
      UNION ALL
      SELECT owner_user_id, 'broadcast', COUNT(*)::int FROM broadcast_reports WHERE owner_user_id IS NOT NULL GROUP BY owner_user_id
      UNION ALL
      SELECT owner_user_id, 'meetings', COUNT(*)::int FROM campaign_meetings WHERE owner_user_id IS NOT NULL GROUP BY owner_user_id
      UNION ALL
      SELECT owner_user_id, 'analytics', COUNT(*)::int FROM analytics_metrics WHERE owner_user_id IS NOT NULL GROUP BY owner_user_id
      UNION ALL
      SELECT owner_user_id, 'submissions', COUNT(*)::int FROM campaign_submissions WHERE owner_user_id IS NOT NULL GROUP BY owner_user_id
    ),
    pivoted AS (
      SELECT
        user_id,
        COALESCE(SUM(c) FILTER (WHERE kind = 'billboards'), 0)::int AS billboards,
        COALESCE(SUM(c) FILTER (WHERE kind = 'posters'), 0)::int AS posters,
        COALESCE(SUM(c) FILTER (WHERE kind = 'videos'), 0)::int AS videos,
        COALESCE(SUM(c) FILTER (WHERE kind = 'files'), 0)::int AS files,
        COALESCE(SUM(c) FILTER (WHERE kind = 'rawMedia'), 0)::int AS raw_media,
        COALESCE(SUM(c) FILTER (WHERE kind = 'socialPosts'), 0)::int AS social_posts,
        COALESCE(SUM(c) FILTER (WHERE kind = 'activities'), 0)::int AS activities,
        COALESCE(SUM(c) FILTER (WHERE kind = 'broadcast'), 0)::int AS broadcast,
        COALESCE(SUM(c) FILTER (WHERE kind = 'meetings'), 0)::int AS meetings,
        COALESCE(SUM(c) FILTER (WHERE kind = 'analytics'), 0)::int AS analytics,
        COALESCE(SUM(c) FILTER (WHERE kind = 'submissions'), 0)::int AS submissions,
        COALESCE(SUM(c), 0)::int AS total
      FROM counts
      GROUP BY user_id
    )
    SELECT
      u.id,
      u.name,
      u.email,
      u.role,
      p.billboards,
      p.posters,
      p.videos,
      p.files,
      p.raw_media,
      p.social_posts,
      p.activities,
      p.broadcast,
      p.meetings,
      p.analytics,
      p.submissions,
      p.total
    FROM pivoted p
    JOIN users u ON u.id = p.user_id
    ORDER BY p.total DESC, u.name ASC
  `;

  return rows.map((row) => ({
    userId: String(row.id),
    name: String(row.name),
    email: String(row.email),
    role: String(row.role),
    billboards: Number(row.billboards ?? 0),
    posters: Number(row.posters ?? 0),
    videos: Number(row.videos ?? 0),
    files: Number(row.files ?? 0),
    rawMedia: Number(row.raw_media ?? 0),
    socialPosts: Number(row.social_posts ?? 0),
    activities: Number(row.activities ?? 0),
    broadcast: Number(row.broadcast ?? 0),
    meetings: Number(row.meetings ?? 0),
    analytics: Number(row.analytics ?? 0),
    submissions: Number(row.submissions ?? 0),
    total: Number(row.total ?? 0),
  }));
}
