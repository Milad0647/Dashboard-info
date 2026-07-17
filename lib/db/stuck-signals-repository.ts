import { getSql } from "@/lib/db/client";
import { isPostgresConfigured } from "@/lib/utils";
import type { StuckBehaviorSignal } from "@/lib/audit/problem-types";

function resolveActorName(row: Record<string, unknown>): string {
  return (
    String(row.user_name ?? "").trim() ||
    String(row.event_name ?? "").trim() ||
    String(row.user_email ?? "").trim() ||
    String(row.event_email ?? "").trim() ||
    "ناشناس"
  );
}

function resolveActorEmail(row: Record<string, unknown>): string | null {
  return (
    String(row.user_email ?? "").trim() ||
    String(row.event_email ?? "").trim() ||
    null
  );
}

function resolveActorRole(row: Record<string, unknown>): string | null {
  return (
    String(row.user_role ?? "").trim() ||
    String(row.event_role ?? "").trim() ||
    null
  );
}

/**
 * Detect users who appear stuck from recent audit behavior:
 * - repeated clicks on the same control
 * - thrashing the same page with many views
 * - bursts of failed logins
 */
export async function pgGetStuckBehaviorSignals(): Promise<StuckBehaviorSignal[]> {
  if (!isPostgresConfigured()) return [];

  const sql = getSql();
  const signals: StuckBehaviorSignal[] = [];

  const clickRows = await sql`
    WITH click_groups AS (
      SELECT
        COALESCE(e.actor_user_id::text, NULLIF(e.actor_email, ''), NULLIF(e.actor_name, ''), 'unknown') AS actor_key,
        e.actor_user_id,
        NULLIF(MAX(e.actor_name), '') AS event_name,
        NULLIF(MAX(e.actor_email), '') AS event_email,
        NULLIF(MAX(e.actor_role), '') AS event_role,
        MAX(u.name) AS user_name,
        MAX(u.email) AS user_email,
        MAX(u.role) AS user_role,
        COALESCE(NULLIF(e.label, ''), '(بدون برچسب)') AS click_label,
        MAX(e.path) AS path,
        COUNT(*)::int AS click_count,
        MIN(e.created_at) AS first_seen_at,
        MAX(e.created_at) AS last_seen_at
      FROM user_audit_events e
      LEFT JOIN users u ON u.id = e.actor_user_id
      WHERE e.action = 'ui.click'
        AND e.created_at >= now() - interval '30 minutes'
      GROUP BY
        COALESCE(e.actor_user_id::text, NULLIF(e.actor_email, ''), NULLIF(e.actor_name, ''), 'unknown'),
        e.actor_user_id,
        COALESCE(NULLIF(e.label, ''), '(بدون برچسب)')
      HAVING COUNT(*) >= 8
    )
    SELECT * FROM click_groups
    ORDER BY click_count DESC
    LIMIT 25
  `;

  for (const row of clickRows) {
    const count = Number(row.click_count ?? 0);
    const severity = count >= 20 ? "high" : count >= 12 ? "medium" : "low";
    const label = String(row.click_label);
    signals.push({
      id: `click:${row.actor_key}:${label}`,
      kind: "repeated_click",
      severity,
      actorKey: String(row.actor_key),
      actorUserId: row.actor_user_id ? String(row.actor_user_id) : null,
      actorName: resolveActorName(row as Record<string, unknown>),
      actorEmail: resolveActorEmail(row as Record<string, unknown>),
      actorRole: resolveActorRole(row as Record<string, unknown>),
      title: "کلیک تکراری روی یک دکمه",
      detail: `در ۳۰ دقیقه اخیر ${count} بار روی «${label}» کلیک کرده است — احتمالاً گیر کرده یا دکمه کار نمی‌کند.`,
      path: row.path ? String(row.path) : null,
      label,
      count,
      windowMinutes: 30,
      firstSeenAt: new Date(String(row.first_seen_at)).toISOString(),
      lastSeenAt: new Date(String(row.last_seen_at)).toISOString(),
    });
  }

  const pageRows = await sql`
    WITH page_groups AS (
      SELECT
        COALESCE(e.actor_user_id::text, NULLIF(e.actor_email, ''), NULLIF(e.actor_name, ''), 'unknown') AS actor_key,
        e.actor_user_id,
        NULLIF(MAX(e.actor_name), '') AS event_name,
        NULLIF(MAX(e.actor_email), '') AS event_email,
        NULLIF(MAX(e.actor_role), '') AS event_role,
        MAX(u.name) AS user_name,
        MAX(u.email) AS user_email,
        MAX(u.role) AS user_role,
        e.path AS path,
        COUNT(*)::int AS view_count,
        MIN(e.created_at) AS first_seen_at,
        MAX(e.created_at) AS last_seen_at
      FROM user_audit_events e
      LEFT JOIN users u ON u.id = e.actor_user_id
      WHERE e.action = 'navigation.page_view'
        AND e.path IS NOT NULL
        AND e.path <> ''
        AND e.created_at >= now() - interval '20 minutes'
      GROUP BY
        COALESCE(e.actor_user_id::text, NULLIF(e.actor_email, ''), NULLIF(e.actor_name, ''), 'unknown'),
        e.actor_user_id,
        e.path
      HAVING COUNT(*) >= 6
    )
    SELECT * FROM page_groups
    ORDER BY view_count DESC
    LIMIT 25
  `;

  for (const row of pageRows) {
    const count = Number(row.view_count ?? 0);
    const severity = count >= 15 ? "high" : count >= 10 ? "medium" : "low";
    const path = String(row.path);
    signals.push({
      id: `page:${row.actor_key}:${path}`,
      kind: "page_thrash",
      severity,
      actorKey: String(row.actor_key),
      actorUserId: row.actor_user_id ? String(row.actor_user_id) : null,
      actorName: resolveActorName(row as Record<string, unknown>),
      actorEmail: resolveActorEmail(row as Record<string, unknown>),
      actorRole: resolveActorRole(row as Record<string, unknown>),
      title: "رفت‌وآمد زیاد در یک صفحه",
      detail: `در ۲۰ دقیقه اخیر ${count} بار صفحه «${path}» را باز کرده است — ممکن است گیج شده باشد یا صفحه درست لود نشود.`,
      path,
      label: null,
      count,
      windowMinutes: 20,
      firstSeenAt: new Date(String(row.first_seen_at)).toISOString(),
      lastSeenAt: new Date(String(row.last_seen_at)).toISOString(),
    });
  }

  const failedLoginRows = await sql`
    WITH fail_groups AS (
      SELECT
        COALESCE(NULLIF(e.actor_email, ''), NULLIF(e.actor_name, ''), 'unknown') AS actor_key,
        NULL AS actor_user_id,
        NULLIF(MAX(e.actor_name), '') AS event_name,
        NULLIF(MAX(e.actor_email), '') AS event_email,
        NULLIF(MAX(e.actor_role), '') AS event_role,
        NULL::text AS user_name,
        NULL::text AS user_email,
        NULL::text AS user_role,
        COUNT(*)::int AS fail_count,
        MIN(e.created_at) AS first_seen_at,
        MAX(e.created_at) AS last_seen_at
      FROM user_audit_events e
      WHERE e.action = 'auth.login_failed'
        AND e.created_at >= now() - interval '30 minutes'
      GROUP BY COALESCE(NULLIF(e.actor_email, ''), NULLIF(e.actor_name, ''), 'unknown')
      HAVING COUNT(*) >= 3
    )
    SELECT * FROM fail_groups
    ORDER BY fail_count DESC
    LIMIT 15
  `;

  for (const row of failedLoginRows) {
    const count = Number(row.fail_count ?? 0);
    const severity = count >= 8 ? "high" : count >= 5 ? "medium" : "low";
    const email = resolveActorEmail(row as Record<string, unknown>);
    signals.push({
      id: `login_fail:${row.actor_key}`,
      kind: "failed_login_burst",
      severity,
      actorKey: String(row.actor_key),
      actorUserId: null,
      actorName: email || resolveActorName(row as Record<string, unknown>),
      actorEmail: email,
      actorRole: null,
      title: "ورود ناموفق پیاپی",
      detail: `در ۳۰ دقیقه اخیر ${count} بار ورود ناموفق داشته است — ممکن است رمز را فراموش کرده یا حساب مشکل داشته باشد.`,
      path: "/admin/login",
      label: null,
      count,
      windowMinutes: 30,
      firstSeenAt: new Date(String(row.first_seen_at)).toISOString(),
      lastSeenAt: new Date(String(row.last_seen_at)).toISOString(),
    });
  }

  const severityRank = { high: 0, medium: 1, low: 2 } as const;
  return signals.sort((a, b) => {
    const bySeverity = severityRank[a.severity] - severityRank[b.severity];
    if (bySeverity !== 0) return bySeverity;
    return new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime();
  });
}
