import { getSql } from "@/lib/db/client";
import { isPostgresConfigured } from "@/lib/utils";
import type {
  CreateProblemReportInput,
  ProblemReport,
  ProblemReportStatus,
} from "@/lib/audit/problem-types";

function mapReportRow(row: Record<string, unknown>): ProblemReport {
  const metadata =
    row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};

  return {
    id: String(row.id),
    reporterUserId: row.reporter_user_id ? String(row.reporter_user_id) : null,
    reporterType: (row.reporter_type as ProblemReport["reporterType"]) ?? "db_user",
    reporterEmail: row.reporter_email ? String(row.reporter_email) : null,
    reporterName: row.reporter_name ? String(row.reporter_name) : null,
    reporterRole: row.reporter_role ? String(row.reporter_role) : null,
    category: row.category as ProblemReport["category"],
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    path: row.path ? String(row.path) : null,
    campaignId: row.campaign_id ? String(row.campaign_id) : null,
    status: row.status as ProblemReportStatus,
    adminNote: row.admin_note ? String(row.admin_note) : null,
    adminNoteSeenAt: row.admin_note_seen_at
      ? new Date(String(row.admin_note_seen_at)).toISOString()
      : null,
    resolvedByUserId: row.resolved_by_user_id ? String(row.resolved_by_user_id) : null,
    resolvedAt: row.resolved_at ? new Date(String(row.resolved_at)).toISOString() : null,
    metadata,
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

function reporterMatchClause(input: {
  reporterUserId?: string | null;
  reporterType?: ProblemReport["reporterType"];
}): { reporterUserId: string | null; reporterType: string | null; ok: boolean } {
  const reporterUserId = input.reporterUserId?.trim() || null;
  const reporterType = input.reporterType ?? null;
  return {
    reporterUserId,
    reporterType,
    ok: Boolean(reporterUserId) || reporterType === "env_admin",
  };
}

export async function pgInsertProblemReport(input: {
  reporterUserId?: string | null;
  reporterType: ProblemReport["reporterType"];
  reporterEmail?: string | null;
  reporterName?: string | null;
  reporterRole?: string | null;
  category: CreateProblemReportInput["category"];
  title: string;
  description: string;
  path?: string | null;
  campaignId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<ProblemReport | null> {
  if (!isPostgresConfigured()) return null;

  const sql = getSql();
  const rows = await sql`
    INSERT INTO user_problem_reports (
      reporter_user_id,
      reporter_type,
      reporter_email,
      reporter_name,
      reporter_role,
      category,
      title,
      description,
      path,
      campaign_id,
      metadata
    ) VALUES (
      ${input.reporterUserId ?? null},
      ${input.reporterType},
      ${input.reporterEmail ?? null},
      ${input.reporterName ?? null},
      ${input.reporterRole ?? null},
      ${input.category},
      ${input.title},
      ${input.description},
      ${input.path ?? null},
      ${input.campaignId ?? null},
      ${sql.json(JSON.parse(JSON.stringify(input.metadata ?? {})))}
    )
    RETURNING *
  `;

  return rows[0] ? mapReportRow(rows[0] as Record<string, unknown>) : null;
}

export async function pgListProblemReports(options?: {
  status?: ProblemReportStatus;
  limit?: number;
}): Promise<ProblemReport[]> {
  if (!isPostgresConfigured()) return [];

  const sql = getSql();
  const limit = Math.min(Math.max(options?.limit ?? 100, 1), 300);
  const status = options?.status ?? null;

  const rows = await sql`
    SELECT *
    FROM user_problem_reports
    WHERE (${status}::text IS NULL OR status = ${status})
    ORDER BY
      CASE status
        WHEN 'pending' THEN 0
        WHEN 'in_progress' THEN 1
        WHEN 'resolved' THEN 2
        ELSE 3
      END,
      created_at DESC
    LIMIT ${limit}
  `;

  return rows.map((row) => mapReportRow(row as Record<string, unknown>));
}

export async function pgCountOpenProblemReports(): Promise<number> {
  if (!isPostgresConfigured()) return 0;

  const sql = getSql();
  const rows = await sql`
    SELECT COUNT(*)::int AS count
    FROM user_problem_reports
    WHERE status IN ('pending', 'in_progress')
  `;
  return Number(rows[0]?.count ?? 0);
}

/** Reports filed by the current user (db user id, or all env_admin snapshots). */
export async function pgListMyProblemReports(input: {
  reporterUserId?: string | null;
  reporterType?: ProblemReport["reporterType"];
  limit?: number;
}): Promise<ProblemReport[]> {
  if (!isPostgresConfigured()) return [];

  const match = reporterMatchClause(input);
  if (!match.ok) return [];

  const sql = getSql();
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const { reporterUserId, reporterType } = match;

  const rows = await sql`
    SELECT *
    FROM user_problem_reports
    WHERE (
      (${reporterUserId}::uuid IS NOT NULL AND reporter_user_id = ${reporterUserId}::uuid)
      OR (
        ${reporterUserId}::uuid IS NULL
        AND ${reporterType}::text = 'env_admin'
        AND reporter_type = 'env_admin'
      )
    )
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  return rows.map((row) => mapReportRow(row as Record<string, unknown>));
}

/** Count replies the reporter has not opened yet. */
export async function pgCountMyUnreadProblemReplies(input: {
  reporterUserId?: string | null;
  reporterType?: ProblemReport["reporterType"];
}): Promise<number> {
  if (!isPostgresConfigured()) return 0;

  const match = reporterMatchClause(input);
  if (!match.ok) return 0;

  const sql = getSql();
  const { reporterUserId, reporterType } = match;

  const rows = await sql`
    SELECT COUNT(*)::int AS count
    FROM user_problem_reports
    WHERE admin_note IS NOT NULL
      AND admin_note_seen_at IS NULL
      AND (
        (${reporterUserId}::uuid IS NOT NULL AND reporter_user_id = ${reporterUserId}::uuid)
        OR (
          ${reporterUserId}::uuid IS NULL
          AND ${reporterType}::text = 'env_admin'
          AND reporter_type = 'env_admin'
        )
      )
  `;

  return Number(rows[0]?.count ?? 0);
}

/** Mark all unread admin replies as seen for the current reporter. */
export async function pgMarkMyProblemReportsSeen(input: {
  reporterUserId?: string | null;
  reporterType?: ProblemReport["reporterType"];
}): Promise<number> {
  if (!isPostgresConfigured()) return 0;

  const match = reporterMatchClause(input);
  if (!match.ok) return 0;

  const sql = getSql();
  const { reporterUserId, reporterType } = match;

  const rows = await sql`
    UPDATE user_problem_reports
    SET
      admin_note_seen_at = now(),
      updated_at = now()
    WHERE admin_note IS NOT NULL
      AND admin_note_seen_at IS NULL
      AND (
        (${reporterUserId}::uuid IS NOT NULL AND reporter_user_id = ${reporterUserId}::uuid)
        OR (
          ${reporterUserId}::uuid IS NULL
          AND ${reporterType}::text = 'env_admin'
          AND reporter_type = 'env_admin'
        )
      )
    RETURNING id
  `;

  return rows.length;
}

export async function pgUpdateProblemReportStatus(input: {
  id: string;
  status: ProblemReportStatus;
  adminNote?: string | null;
  resolvedByUserId?: string | null;
}): Promise<ProblemReport | null> {
  if (!isPostgresConfigured()) return null;

  const sql = getSql();
  const isClosed = input.status === "resolved" || input.status === "dismissed";
  // Env admin has no users-row id; only persist FK when we have a real user UUID.
  const resolvedByUserId = isClosed && input.resolvedByUserId ? input.resolvedByUserId : null;
  const resolvedAt = isClosed ? new Date().toISOString() : null;

  try {
    if (input.adminNote !== undefined) {
      const adminNote = input.adminNote?.trim() || null;
      const rows = await sql`
        UPDATE user_problem_reports
        SET
          status = ${input.status},
          admin_note = ${adminNote},
          -- New/changed reply becomes unread until the reporter opens it.
          admin_note_seen_at = CASE
            WHEN ${adminNote} IS DISTINCT FROM admin_note THEN NULL
            ELSE admin_note_seen_at
          END,
          resolved_by_user_id = ${resolvedByUserId},
          resolved_at = ${resolvedAt},
          updated_at = now()
        WHERE id = ${input.id}::uuid
        RETURNING *
      `;
      return rows[0] ? mapReportRow(rows[0] as Record<string, unknown>) : null;
    }

    const rows = await sql`
      UPDATE user_problem_reports
      SET
        status = ${input.status},
        resolved_by_user_id = ${resolvedByUserId},
        resolved_at = ${resolvedAt},
        updated_at = now()
      WHERE id = ${input.id}::uuid
      RETURNING *
    `;
    return rows[0] ? mapReportRow(rows[0] as Record<string, unknown>) : null;
  } catch (error) {
    console.error("pgUpdateProblemReportStatus failed:", error);
    throw error;
  }
}

