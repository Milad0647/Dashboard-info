import { getSql } from "@/lib/db/client";
import { isPostgresConfigured } from "@/lib/utils";
import type { StuckBehaviorSignal } from "@/lib/audit/problem-types";

/**
 * Labels that indicate content registration / mutation actions
 * (save, add, edit, close, create new, upload, submit, …).
 */
const CONTENT_ACTION_LABEL_PATTERN =
  "(ذخیره|افزودن|ویرایش|بستن|ثبت|ایجاد|حذف|آپلود|ارسال|جدید|به‌روزرسانی|به\\s*روزرسانی|انتشار|save|add|edit|delete|upload|submit|create|update|close|new)";

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

function parseErrorLabels(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .slice(0, 5);
}

/**
 * Detect suspicious / stuck behavior focused on content workflows:
 * - repeated clicks on save/add/edit/close/create controls
 * - bursts of user-facing UI errors
 * - bursts of failed logins
 */
export async function pgGetStuckBehaviorSignals(): Promise<StuckBehaviorSignal[]> {
  if (!isPostgresConfigured()) return [];

  const sql = getSql();
  const signals: StuckBehaviorSignal[] = [];
  const contentPattern = CONTENT_ACTION_LABEL_PATTERN;

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
        AND COALESCE(e.label, '') ~* ${contentPattern}
      GROUP BY
        COALESCE(e.actor_user_id::text, NULLIF(e.actor_email, ''), NULLIF(e.actor_name, ''), 'unknown'),
        e.actor_user_id,
        COALESCE(NULLIF(e.label, ''), '(بدون برچسب)')
      HAVING COUNT(*) >= 4
    ),
    actor_errors AS (
      SELECT
        COALESCE(err.actor_user_id::text, NULLIF(err.actor_email, ''), NULLIF(err.actor_name, ''), 'unknown') AS actor_key,
        array_remove(
          array_agg(DISTINCT NULLIF(btrim(err.label), '')),
          NULL
        ) AS recent_errors
      FROM user_audit_events err
      WHERE err.action = 'ui.error'
        AND err.created_at >= now() - interval '30 minutes'
      GROUP BY
        COALESCE(err.actor_user_id::text, NULLIF(err.actor_email, ''), NULLIF(err.actor_name, ''), 'unknown')
    )
    SELECT
      c.*,
      ae.recent_errors
    FROM click_groups c
    LEFT JOIN actor_errors ae ON ae.actor_key = c.actor_key
    ORDER BY c.click_count DESC
    LIMIT 25
  `;

  for (const row of clickRows) {
    const count = Number(row.click_count ?? 0);
    const recentErrors = parseErrorLabels(row.recent_errors);
    const hasErrors = recentErrors.length > 0;
    const severity =
      count >= 12 || (hasErrors && count >= 6)
        ? "high"
        : count >= 7 || hasErrors
          ? "medium"
          : "low";
    const label = String(row.click_label);
    const errorHint = hasErrors
      ? ` همزمان خطا هم دیده: «${recentErrors[0]}».`
      : " احتمالاً ذخیره/ثبت انجام نشده و دوباره تلاش کرده است.";

    signals.push({
      id: `content_click:${row.actor_key}:${label}`,
      kind: "content_action_retry",
      severity,
      actorKey: String(row.actor_key),
      actorUserId: row.actor_user_id ? String(row.actor_user_id) : null,
      actorName: resolveActorName(row as Record<string, unknown>),
      actorEmail: resolveActorEmail(row as Record<string, unknown>),
      actorRole: resolveActorRole(row as Record<string, unknown>),
      title: "تلاش تکراری روی عملیات ثبت محتوا",
      detail: `در ۳۰ دقیقه اخیر ${count} بار روی «${label}» کلیک کرده است.${errorHint}`,
      path: row.path ? String(row.path) : null,
      label,
      count,
      windowMinutes: 30,
      firstSeenAt: new Date(String(row.first_seen_at)).toISOString(),
      lastSeenAt: new Date(String(row.last_seen_at)).toISOString(),
      recentErrors: hasErrors ? recentErrors : undefined,
    });
  }

  const errorRows = await sql`
    WITH error_groups AS (
      SELECT
        COALESCE(e.actor_user_id::text, NULLIF(e.actor_email, ''), NULLIF(e.actor_name, ''), 'unknown') AS actor_key,
        e.actor_user_id,
        NULLIF(MAX(e.actor_name), '') AS event_name,
        NULLIF(MAX(e.actor_email), '') AS event_email,
        NULLIF(MAX(e.actor_role), '') AS event_role,
        MAX(u.name) AS user_name,
        MAX(u.email) AS user_email,
        MAX(u.role) AS user_role,
        MAX(e.path) AS path,
        COUNT(*)::int AS error_count,
        MIN(e.created_at) AS first_seen_at,
        MAX(e.created_at) AS last_seen_at,
        array_remove(
          array_agg(DISTINCT NULLIF(btrim(e.label), '')),
          NULL
        ) AS recent_errors
      FROM user_audit_events e
      LEFT JOIN users u ON u.id = e.actor_user_id
      WHERE e.action = 'ui.error'
        AND e.created_at >= now() - interval '30 minutes'
      GROUP BY
        COALESCE(e.actor_user_id::text, NULLIF(e.actor_email, ''), NULLIF(e.actor_name, ''), 'unknown'),
        e.actor_user_id
      HAVING COUNT(*) >= 3
    )
    SELECT * FROM error_groups
    ORDER BY error_count DESC
    LIMIT 25
  `;

  for (const row of errorRows) {
    const actorKey = String(row.actor_key);
    // Skip if we already have a content-retry signal for this actor (richer context).
    if (signals.some((s) => s.actorKey === actorKey && s.kind === "content_action_retry")) {
      continue;
    }

    const count = Number(row.error_count ?? 0);
    const recentErrors = parseErrorLabels(row.recent_errors);
    const severity = count >= 8 ? "high" : count >= 5 ? "medium" : "low";
    const preview = recentErrors[0] ? ` آخرین خطا: «${recentErrors[0]}».` : "";

    signals.push({
      id: `error:${actorKey}`,
      kind: "error_burst",
      severity,
      actorKey,
      actorUserId: row.actor_user_id ? String(row.actor_user_id) : null,
      actorName: resolveActorName(row as Record<string, unknown>),
      actorEmail: resolveActorEmail(row as Record<string, unknown>),
      actorRole: resolveActorRole(row as Record<string, unknown>),
      title: "خطاهای پیاپی در رابط کاربری",
      detail: `در ۳۰ دقیقه اخیر ${count} خطای قابل‌نمایش برای کاربر ثبت شده است.${preview}`,
      path: row.path ? String(row.path) : null,
      label: recentErrors[0] ?? null,
      count,
      windowMinutes: 30,
      firstSeenAt: new Date(String(row.first_seen_at)).toISOString(),
      lastSeenAt: new Date(String(row.last_seen_at)).toISOString(),
      recentErrors: recentErrors.length > 0 ? recentErrors : undefined,
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
