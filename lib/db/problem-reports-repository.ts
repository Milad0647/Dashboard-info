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
    resolvedByUserId: row.resolved_by_user_id ? String(row.resolved_by_user_id) : null,
    resolvedAt: row.resolved_at ? new Date(String(row.resolved_at)).toISOString() : null,
    metadata,
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
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

export async function pgUpdateProblemReportStatus(input: {
  id: string;
  status: ProblemReportStatus;
  adminNote?: string | null;
  resolvedByUserId?: string | null;
}): Promise<ProblemReport | null> {
  if (!isPostgresConfigured()) return null;

  const sql = getSql();
  const now = new Date().toISOString();
  const isClosed = input.status === "resolved" || input.status === "dismissed";
  const hasNote = input.adminNote !== undefined;
  const adminNote = hasNote ? input.adminNote?.trim() || null : null;

  const rows = await sql`
    UPDATE user_problem_reports
    SET
      status = ${input.status},
      admin_note = CASE
        WHEN ${hasNote} THEN ${adminNote}
        ELSE admin_note
      END,
      resolved_by_user_id = CASE
        WHEN ${isClosed} THEN ${input.resolvedByUserId ?? null}
        ELSE NULL
      END,
      resolved_at = CASE
        WHEN ${isClosed} THEN ${now}::timestamptz
        ELSE NULL
      END,
      updated_at = ${now}::timestamptz
    WHERE id = ${input.id}
    RETURNING *
  `;

  return rows[0] ? mapReportRow(rows[0] as Record<string, unknown>) : null;
}
