export type ProblemReportCategory =
  | "ui_bug"
  | "cant_find"
  | "upload"
  | "permission"
  | "data"
  | "performance"
  | "other";

export type ProblemReportStatus = "pending" | "in_progress" | "resolved" | "dismissed";

export type StuckSignalKind = "repeated_click" | "page_thrash" | "failed_login_burst";

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
  resolvedByUserId: string | null;
  resolvedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProblemReportInput {
  category: ProblemReportCategory;
  title: string;
  description: string;
  path?: string | null;
  campaignId?: string | null;
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
  repeated_click: "کلیک تکراری",
  page_thrash: "رفت‌وآمد زیاد در صفحه",
  failed_login_burst: "ورود ناموفق پیاپی",
};
