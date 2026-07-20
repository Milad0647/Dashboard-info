export type ProblemReportCategory =
  | "ui_bug"
  | "cant_find"
  | "upload"
  | "permission"
  | "data"
  | "performance"
  | "other";

export type ProblemReportStatus = "pending" | "in_progress" | "resolved" | "dismissed";

export type StuckSignalKind =
  | "content_action_retry"
  | "error_burst"
  | "failed_login_burst";

export type ProblemReportAttachmentKind = "image" | "video";

/** Screenshot or screen recording attached to a problem report. */
export interface ProblemReportAttachment {
  url: string;
  kind: ProblemReportAttachmentKind;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export interface ProblemReport {
  id: string;
  reporterUserId: string | null;
  reporterType: "env_admin" | "db_user" | "anonymous";
  reporterEmail: string | null;
  reporterName: string | null;
  reporterRole: string | null;
  category: ProblemReportCategory;
  title: string;
  description: string;
  path: string | null;
  campaignId: string | null;
  status: ProblemReportStatus;
  adminNote: string | null;
  adminNoteSeenAt: string | null;
  firstRepliedAt: string | null;
  resolvedByUserId: string | null;
  resolvedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ProblemReportStats {
  total: number;
  open: number;
  pending: number;
  inProgress: number;
  answered: number;
  resolved: number;
  dismissed: number;
  /** Average seconds from report creation to first admin reply; null if none answered. */
  avgFirstReplySeconds: number | null;
}

export interface CreateProblemReportInput {
  category: ProblemReportCategory;
  title: string;
  description: string;
  path?: string | null;
  campaignId?: string | null;
  /** Optional screenshots / screen recordings (stored in metadata). */
  attachments?: ProblemReportAttachment[];
}

export const PROBLEM_REPORT_MAX_ATTACHMENTS = 5;

export function parseProblemReportAttachments(
  metadata: Record<string, unknown> | null | undefined
): ProblemReportAttachment[] {
  if (!metadata || typeof metadata !== "object") return [];
  const raw = metadata.attachments;
  if (!Array.isArray(raw)) return [];

  const attachments: ProblemReportAttachment[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    const url = typeof record.url === "string" ? record.url.trim() : "";
    const kind = record.kind === "image" || record.kind === "video" ? record.kind : null;
    const fileName = typeof record.fileName === "string" ? record.fileName.trim() : "";
    const mimeType = typeof record.mimeType === "string" ? record.mimeType.trim() : "";
    const fileSize = typeof record.fileSize === "number" ? record.fileSize : Number(record.fileSize);
    if (!url || !kind) continue;
    attachments.push({
      url,
      kind,
      fileName: fileName || (kind === "video" ? "ویدیو" : "تصویر"),
      fileSize: Number.isFinite(fileSize) && fileSize >= 0 ? fileSize : 0,
      mimeType: mimeType || (kind === "video" ? "video/mp4" : "image/jpeg"),
    });
  }
  return attachments;
}

export interface StuckBehaviorSignal {
  id: string;
  kind: StuckSignalKind;
  severity: "low" | "medium" | "high";
  actorKey: string;
  actorUserId: string | null;
  actorName: string;
  actorEmail: string | null;
  actorRole: string | null;
  title: string;
  detail: string;
  path: string | null;
  label: string | null;
  count: number;
  windowMinutes: number;
  firstSeenAt: string;
  lastSeenAt: string;
  /** Recent user-facing error messages correlated with this signal. */
  recentErrors?: string[];
}

export const PROBLEM_REPORT_CATEGORY_LABELS: Record<ProblemReportCategory, string> = {
  ui_bug: "باگ رابط کاربری",
  cant_find: "چیزی پیدا نمی‌کنم",
  upload: "مشکل آپلود",
  permission: "محدودیت دسترسی",
  data: "داده اشتباه / ناقص",
  performance: "کندی سیستم",
  other: "سایر",
};

export const PROBLEM_REPORT_STATUS_LABELS: Record<ProblemReportStatus, string> = {
  pending: "در انتظار",
  in_progress: "در حال بررسی",
  resolved: "حل شد",
  dismissed: "بسته شد",
};

export const STUCK_SIGNAL_KIND_LABELS: Record<StuckSignalKind, string> = {
  content_action_retry: "تلاش تکراری ثبت محتوا",
  error_burst: "خطاهای پیاپی کاربر",
  failed_login_burst: "ورود ناموفق پیاپی",
};
