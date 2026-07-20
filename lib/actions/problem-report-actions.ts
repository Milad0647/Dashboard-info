"use server";

import { revalidatePath } from "next/cache";
import { getAuthSession, isFullAdmin } from "@/lib/auth/get-session";
import { logAuditForSession } from "@/lib/audit/log-event";
import type {
  CreateProblemReportInput,
  ProblemReportAttachment,
  ProblemReportCategory,
  ProblemReportStatus,
} from "@/lib/audit/problem-types";
import {
  parseProblemReportAttachments,
  PROBLEM_REPORT_CATEGORY_LABELS,
  PROBLEM_REPORT_MAX_ATTACHMENTS,
  PROBLEM_REPORT_STATUS_LABELS,
} from "@/lib/audit/problem-types";
import { pgGetUserById } from "@/lib/db/repository-extended";
import {
  pgInsertProblemReport,
  pgListMyProblemReports,
  pgCountMyUnreadProblemReplies,
  pgMarkMyProblemReportsSeen,
  pgUpdateProblemReportStatus,
} from "@/lib/db/problem-reports-repository";
import type { ProblemReport } from "@/lib/audit/problem-types";
import { stripFileAccessToken, withFileAccessToken } from "@/lib/uploads";
import { isPostgresConfigured } from "@/lib/utils";

/** Fields safe to show the reporter (their own history + admin reply). */
export type MyProblemReport = Pick<
  ProblemReport,
  | "id"
  | "category"
  | "title"
  | "description"
  | "path"
  | "status"
  | "adminNote"
  | "adminNoteSeenAt"
  | "createdAt"
  | "updatedAt"
  | "resolvedAt"
> & {
  attachments: ProblemReportAttachment[];
  hasUnreadReply: boolean;
};

function withAttachmentTokens(attachments: ProblemReportAttachment[]): ProblemReportAttachment[] {
  return attachments.map((item) => ({
    ...item,
    url: withFileAccessToken(item.url),
  }));
}

function toMyProblemReport(report: ProblemReport): MyProblemReport {
  const hasUnreadReply = Boolean(report.adminNote) && !report.adminNoteSeenAt;
  return {
    id: report.id,
    category: report.category,
    title: report.title,
    description: report.description,
    path: report.path,
    status: report.status,
    adminNote: report.adminNote,
    adminNoteSeenAt: report.adminNoteSeenAt,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
    resolvedAt: report.resolvedAt,
    attachments: withAttachmentTokens(parseProblemReportAttachments(report.metadata)),
    hasUnreadReply,
  };
}

function normalizeAttachments(
  input: CreateProblemReportInput["attachments"]
): { ok: true; attachments: ProblemReportAttachment[] } | { ok: false; error: string } {
  if (!input || input.length === 0) {
    return { ok: true, attachments: [] };
  }
  if (input.length > PROBLEM_REPORT_MAX_ATTACHMENTS) {
    return {
      ok: false,
      error: `حداکثر ${PROBLEM_REPORT_MAX_ATTACHMENTS} فایل پیوست مجاز است`,
    };
  }

  const attachments: ProblemReportAttachment[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") {
      return { ok: false, error: "پیوست نامعتبر است" };
    }
    const kind = item.kind === "image" || item.kind === "video" ? item.kind : null;
    const bareUrl = stripFileAccessToken(String(item.url ?? "").trim());
    if (!kind || !bareUrl.startsWith("/api/files/")) {
      return { ok: false, error: "فقط تصویر یا ویدیوی آپلودشده مجاز است" };
    }
    const fileName = String(item.fileName ?? "").trim().slice(0, 200);
    const mimeType = String(item.mimeType ?? "").trim().slice(0, 120);
    const fileSize = Number(item.fileSize);
    attachments.push({
      url: bareUrl,
      kind,
      fileName: fileName || (kind === "video" ? "ویدیو" : "تصویر"),
      fileSize: Number.isFinite(fileSize) && fileSize >= 0 ? fileSize : 0,
      mimeType: mimeType || (kind === "video" ? "video/mp4" : "image/jpeg"),
    });
  }
  return { ok: true, attachments };
}

function reporterScope(session: NonNullable<Awaited<ReturnType<typeof getAuthSession>>>) {
  return {
    reporterUserId: session.userId,
    reporterType: (session.type === "env_admin" ? "env_admin" : "db_user") as
      | "env_admin"
      | "db_user",
  };
}

const VALID_CATEGORIES = new Set<ProblemReportCategory>([
  "ui_bug",
  "cant_find",
  "upload",
  "permission",
  "data",
  "performance",
  "other",
]);

const VALID_STATUSES = new Set<ProblemReportStatus>([
  "pending",
  "in_progress",
  "resolved",
  "dismissed",
]);

export async function submitProblemReportAction(
  input: CreateProblemReportInput
): Promise<{ success: boolean; error?: string }> {
  const session = await getAuthSession();
  if (!session) {
    return { success: false, error: "برای ارسال گزارش باید وارد شوید" };
  }
  if (!isPostgresConfigured()) {
    return { success: false, error: "ارسال گزارش فقط با دیتابیس فعال است" };
  }

  const category = input.category;
  if (!VALID_CATEGORIES.has(category)) {
    return { success: false, error: "دسته‌بندی نامعتبر است" };
  }

  const title = input.title?.trim() ?? "";
  const description = input.description?.trim() ?? "";
  if (title.length < 3) {
    return { success: false, error: "عنوان حداقل ۳ کاراکتر باشد" };
  }
  if (description.length < 8) {
    return { success: false, error: "توضیح مشکل را کامل‌تر بنویسید" };
  }

  const normalizedAttachments = normalizeAttachments(input.attachments);
  if (!normalizedAttachments.ok) {
    return { success: false, error: normalizedAttachments.error };
  }

  let reporterEmail = session.email ?? null;
  let reporterName = session.name ?? null;
  const reporterType: "env_admin" | "db_user" =
    session.type === "env_admin" ? "env_admin" : "db_user";

  if (session.type === "env_admin") {
    reporterName = reporterName ?? "مدیر سیستم";
  } else if (session.userId) {
    const user = await pgGetUserById(session.userId);
    reporterEmail = reporterEmail ?? user?.email ?? null;
    reporterName = reporterName ?? user?.name ?? null;
  }

  const report = await pgInsertProblemReport({
    reporterUserId: session.userId,
    reporterType,
    reporterEmail,
    reporterName,
    reporterRole: session.role,
    category,
    title: title.slice(0, 160),
    description: description.slice(0, 4000),
    path: input.path?.trim().slice(0, 500) || null,
    campaignId: input.campaignId?.trim() || null,
    metadata:
      normalizedAttachments.attachments.length > 0
        ? { attachments: normalizedAttachments.attachments }
        : {},
  });

  if (!report) {
    return { success: false, error: "ثبت گزارش با خطا مواجه شد" };
  }

  await logAuditForSession(session, {
    category: "system",
    action: "problem.report",
    entityType: "problem_report",
    entityId: report.id,
    campaignId: report.campaignId,
    path: report.path,
    label: title,
    metadata: {
      category,
      reportId: report.id,
      attachmentCount: normalizedAttachments.attachments.length,
    },
  });

  revalidatePath("/admin/audit");
  revalidatePath("/admin/reported-problems");
  revalidatePath("/admin/problem-reports");
  return { success: true };
}

export async function listMyProblemReportsAction(): Promise<{
  success: boolean;
  reports?: MyProblemReport[];
  error?: string;
}> {
  const session = await getAuthSession();
  if (!session) {
    return { success: false, error: "برای مشاهده گزارش‌ها باید وارد شوید" };
  }
  if (!isPostgresConfigured()) {
    return { success: false, error: "دیتابیس فعال نیست" };
  }

  const reports = await pgListMyProblemReports({
    reporterUserId: session.userId,
    reporterType: session.type === "env_admin" ? "env_admin" : "db_user",
  });

  return { success: true, reports: reports.map(toMyProblemReport) };
}

export async function getMyUnreadProblemReplyCountAction(): Promise<{
  success: boolean;
  count?: number;
  error?: string;
}> {
  const session = await getAuthSession();
  if (!session) {
    return { success: false, error: "برای مشاهده گزارش‌ها باید وارد شوید" };
  }
  if (!isPostgresConfigured()) {
    return { success: true, count: 0 };
  }

  const count = await pgCountMyUnreadProblemReplies(reporterScope(session));
  return { success: true, count };
}

export async function markMyProblemReportsSeenAction(): Promise<{
  success: boolean;
  marked?: number;
  error?: string;
}> {
  const session = await getAuthSession();
  if (!session) {
    return { success: false, error: "برای مشاهده گزارش‌ها باید وارد شوید" };
  }
  if (!isPostgresConfigured()) {
    return { success: false, error: "دیتابیس فعال نیست" };
  }

  const marked = await pgMarkMyProblemReportsSeen(reporterScope(session));
  revalidatePath("/admin/problem-reports");
  return { success: true, marked };
}

export async function updateProblemReportStatusAction(input: {
  id: string;
  status: ProblemReportStatus;
  adminNote?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getAuthSession();
    if (!session || !isFullAdmin(session)) {
      return { success: false, error: "فقط ادمین می‌تواند گزارش را رسیدگی کند" };
    }
    if (!isPostgresConfigured()) {
      return { success: false, error: "دیتابیس فعال نیست" };
    }
    if (!VALID_STATUSES.has(input.status)) {
      return { success: false, error: "وضعیت نامعتبر است" };
    }
    if (!input.id?.trim()) {
      return { success: false, error: "شناسه گزارش نامعتبر است" };
    }

    const updated = await pgUpdateProblemReportStatus({
      id: input.id.trim(),
      status: input.status,
      adminNote: input.adminNote,
      // Env admin sessions have no users FK row — leave resolver null.
      resolvedByUserId: session.type === "db_user" ? session.userId : null,
    });

    if (!updated) {
      return { success: false, error: "گزارش یافت نشد یا به‌روزرسانی نشد" };
    }

    await logAuditForSession(session, {
      category: "admin",
      action: "problem.triage",
      entityType: "problem_report",
      entityId: updated.id,
      label: `${PROBLEM_REPORT_CATEGORY_LABELS[updated.category] ?? updated.category} → ${
        PROBLEM_REPORT_STATUS_LABELS[input.status] ?? input.status
      }`,
      metadata: { status: input.status },
    });

    revalidatePath("/admin/audit");
    revalidatePath("/admin/reported-problems");
    revalidatePath("/admin/problem-reports");
    return { success: true };
  } catch (error) {
    console.error("updateProblemReportStatusAction failed:", error);
    return { success: false, error: "خطا در به‌روزرسانی گزارش" };
  }
}
