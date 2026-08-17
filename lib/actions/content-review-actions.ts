"use server";

import { revalidatePath } from "next/cache";
import { canManageAllContent } from "@/lib/auth/access";
import { getAuthSession, getOwnerFilter, isFullAdmin } from "@/lib/auth/get-session";
import { logAuditForSession } from "@/lib/audit/log-event";
import {
  REVIEWABLE_CONTENT_TYPES,
  type ContentReviewStatus,
  type ReviewableContentType,
} from "@/lib/content-review/types";
import {
  pgInsertContentMessage,
  pgLookupContentOwner,
  pgUpdateFollowUpStatusForContent,
} from "@/lib/db/content-messages-repository";
import {
  pgListContentReviews,
  pgGetContentReview,
  pgSetContentPublished,
  pgUpsertContentReview,
} from "@/lib/db/content-review-repository";
import { pgMarkNotificationReads } from "@/lib/db/repository-extended";
import { getNotificationReaderKey } from "@/lib/notification-reader";
import {
  clearOfficialScoreOnReject,
  finalizeOfficialScore,
} from "@/lib/scoring/persist-content-score";
import type { AuthSession } from "@/lib/types";
import { isPostgresConfigured } from "@/lib/utils";

const REVIEWABLE_SET = new Set<string>(REVIEWABLE_CONTENT_TYPES);
const MAX_BULK_REVIEW = 80;

export type BulkReviewTarget = {
  contentType: string;
  contentId: string;
  notificationKey?: string;
};

export type BulkReviewResult = {
  success: boolean;
  processed: number;
  skipped: number;
  failed: number;
  error?: string;
};

function parseReviewableType(value: string): ReviewableContentType | null {
  return REVIEWABLE_SET.has(value) ? (value as ReviewableContentType) : null;
}

function dedupeReviewTargets(items: BulkReviewTarget[]): Array<{
  contentType: ReviewableContentType;
  contentId: string;
  notificationKey?: string;
}> {
  const seen = new Set<string>();
  const out: Array<{
    contentType: ReviewableContentType;
    contentId: string;
    notificationKey?: string;
  }> = [];
  for (const item of items) {
    const contentType = parseReviewableType(item.contentType);
    const contentId = item.contentId?.trim() || "";
    if (!contentType || !contentId) continue;
    const key = `${contentType}:${contentId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      contentType,
      contentId,
      notificationKey: item.notificationKey,
    });
  }
  return out;
}

async function markSeenForCurrentSession(contentKeys?: string | string[] | null) {
  const keys = (Array.isArray(contentKeys) ? contentKeys : contentKeys ? [contentKeys] : []).filter(
    Boolean
  );
  if (keys.length === 0 || !isPostgresConfigured()) return;
  const session = await getAuthSession();
  if (!session || !canManageAllContent(session)) return;
  await pgMarkNotificationReads(getNotificationReaderKey(session), keys, true);
}

function revalidateReviewViews(includePerformance = false) {
  revalidatePath("/admin/elanha");
  revalidatePath("/admin/notifications");
  revalidatePath("/admin/returned-content");
  revalidatePath("/admin/messages");
  revalidatePath("/admin/audit");
  if (includePerformance) {
    revalidatePath("/admin/performance");
    revalidatePath("/campaign");
  }
}

async function rejectOne(
  session: AuthSession,
  input: {
    campaignId: string;
    contentType: ReviewableContentType;
    contentId: string;
    rejectionReason: string;
  }
): Promise<{ success: true } | { success: false; error: string; skipped?: boolean }> {
  const owner = await pgLookupContentOwner({
    campaignId: input.campaignId,
    contentId: input.contentId,
    contentType: input.contentType,
  });
  if (!owner) return { success: false, error: "محتوا یافت نشد" };

  const review = await pgUpsertContentReview({
    campaignId: input.campaignId,
    contentType: input.contentType,
    contentId: input.contentId,
    status: "needs_revision",
    rejectionReason: input.rejectionReason.slice(0, 2000),
    rejectedByUserId: session.userId,
  });
  if (!review) return { success: false, error: "ثبت وضعیت رد ناموفق بود" };

  await pgSetContentPublished({
    campaignId: input.campaignId,
    contentType: input.contentType,
    contentId: input.contentId,
    published: false,
  });
  await clearOfficialScoreOnReject({
    campaignId: input.campaignId,
    contentType: input.contentType,
    contentId: input.contentId,
  });

  if (owner.ownerUserId) {
    await pgInsertContentMessage({
      campaignId: input.campaignId,
      contentType: input.contentType,
      contentId: input.contentId,
      contentTitle: owner.title || "بدون عنوان",
      recipientUserId: owner.ownerUserId,
      senderUserId: session.type === "db_user" ? session.userId : null,
      senderName: session.name ?? (session.type === "env_admin" ? "مدیر سیستم" : null),
      senderRole: session.role ?? (session.type === "env_admin" ? "admin" : null),
      body: `این محتوا برای ویرایش برگشت داده شد:\n${input.rejectionReason}`,
      parentMessageId: null,
      followUpStatus: "awaiting_user",
    });
  }
  await pgUpdateFollowUpStatusForContent({
    campaignId: input.campaignId,
    contentType: input.contentType,
    contentId: input.contentId,
    status: "awaiting_user",
  });

  await logAuditForSession(session, {
    category: "content",
    action: "content.review.reject",
    entityType: "content_review",
    entityId: review.id,
    campaignId: input.campaignId,
    label: owner.title || "رد محتوا",
    metadata: {
      contentType: input.contentType,
      contentId: input.contentId,
      reason: input.rejectionReason,
    },
  });

  return { success: true };
}

async function approveOne(
  session: AuthSession,
  input: {
    campaignId: string;
    contentType: ReviewableContentType;
    contentId: string;
  }
): Promise<{ success: true } | { success: false; error: string; skipped?: boolean }> {
  const current = await pgGetContentReview({
    campaignId: input.campaignId,
    contentType: input.contentType,
    contentId: input.contentId,
  });
  if (current?.status === "approved") {
    return { success: false, error: "این محتوا قبلاً تایید شده است", skipped: true };
  }

  const owner = await pgLookupContentOwner({
    campaignId: input.campaignId,
    contentId: input.contentId,
    contentType: input.contentType,
  });
  if (!owner) return { success: false, error: "محتوا یافت نشد" };

  const review = await pgUpsertContentReview({
    campaignId: input.campaignId,
    contentType: input.contentType,
    contentId: input.contentId,
    status: "approved",
  });
  await pgSetContentPublished({
    campaignId: input.campaignId,
    contentType: input.contentType,
    contentId: input.contentId,
    published: true,
  });
  await finalizeOfficialScore({
    campaignId: input.campaignId,
    contentType: input.contentType,
    contentId: input.contentId,
  });
  await pgUpdateFollowUpStatusForContent({
    campaignId: input.campaignId,
    contentType: input.contentType,
    contentId: input.contentId,
    status: "resolved",
  });

  await logAuditForSession(session, {
    category: "content",
    action: "content.review.approve",
    entityType: "content_review",
    entityId: review?.id ?? input.contentId,
    campaignId: input.campaignId,
    label: owner.title || "تایید محتوا",
    metadata: {
      contentType: input.contentType,
      contentId: input.contentId,
      everRejected: review?.everRejected ?? false,
    },
  });

  return { success: true };
}

export async function rejectContentForRevisionAction(input: {
  campaignId: string;
  contentType: string;
  contentId: string;
  rejectionReason: string;
  notificationKey?: string;
}): Promise<{ success: boolean; error?: string }> {
  const session = await getAuthSession();
  if (!session || !canManageAllContent(session)) {
    return { success: false, error: "فقط مدیر یا کارفرما می‌تواند محتوا را رد کند" };
  }
  if (!isPostgresConfigured()) {
    return { success: false, error: "این قابلیت فقط با دیتابیس فعال است" };
  }

  const contentType = parseReviewableType(input.contentType);
  if (!contentType) return { success: false, error: "نوع محتوا پشتیبانی نمی‌شود" };
  const campaignId = input.campaignId?.trim() || "";
  const contentId = input.contentId?.trim() || "";
  const reason = input.rejectionReason?.trim() || "";
  if (!campaignId || !contentId) return { success: false, error: "شناسه محتوا نامعتبر است" };
  if (reason.length < 3) return { success: false, error: "دلیل رد حداقل ۳ کاراکتر باشد" };

  const result = await rejectOne(session, {
    campaignId,
    contentType,
    contentId,
    rejectionReason: reason,
  });
  if (!result.success) return { success: false, error: result.error };

  await markSeenForCurrentSession(input.notificationKey);
  revalidateReviewViews();
  return { success: true };
}

export async function approveContentAction(input: {
  campaignId: string;
  contentType: string;
  contentId: string;
  notificationKey?: string;
}): Promise<{ success: boolean; error?: string }> {
  const session = await getAuthSession();
  if (!session || !canManageAllContent(session)) {
    return { success: false, error: "فقط مدیر یا کارفرما می‌تواند محتوا را تایید کند" };
  }
  if (!isPostgresConfigured()) return { success: false, error: "دیتابیس فعال نیست" };

  const contentType = parseReviewableType(input.contentType);
  if (!contentType) return { success: false, error: "نوع محتوا پشتیبانی نمی‌شود" };
  const campaignId = input.campaignId?.trim() || "";
  const contentId = input.contentId?.trim() || "";
  if (!campaignId || !contentId) return { success: false, error: "شناسه محتوا نامعتبر است" };

  const result = await approveOne(session, { campaignId, contentType, contentId });
  if (!result.success) return { success: false, error: result.error };

  await markSeenForCurrentSession(input.notificationKey);
  revalidateReviewViews(true);
  return { success: true };
}

export async function bulkApproveContentAction(input: {
  campaignId: string;
  items: BulkReviewTarget[];
}): Promise<BulkReviewResult> {
  const session = await getAuthSession();
  if (!session || !canManageAllContent(session)) {
    return { success: false, processed: 0, skipped: 0, failed: 0, error: "فقط مدیر یا کارفرما می‌تواند محتوا را تایید کند" };
  }
  if (!isPostgresConfigured()) {
    return { success: false, processed: 0, skipped: 0, failed: 0, error: "دیتابیس فعال نیست" };
  }

  const campaignId = input.campaignId?.trim() || "";
  if (!campaignId) {
    return { success: false, processed: 0, skipped: 0, failed: 0, error: "شناسه کمپین نامعتبر است" };
  }

  const targets = dedupeReviewTargets(input.items);
  if (targets.length === 0) {
    return { success: false, processed: 0, skipped: 0, failed: 0, error: "موردی برای تایید انتخاب نشده است" };
  }
  if (targets.length > MAX_BULK_REVIEW) {
    return {
      success: false,
      processed: 0,
      skipped: 0,
      failed: 0,
      error: `حداکثر ${MAX_BULK_REVIEW} مورد در هر بار قابل تایید است`,
    };
  }

  let processed = 0;
  let skipped = 0;
  let failed = 0;
  const seenKeys: string[] = [];

  for (const target of targets) {
    const result = await approveOne(session, {
      campaignId,
      contentType: target.contentType,
      contentId: target.contentId,
    });
    if (result.success) {
      processed += 1;
      if (target.notificationKey) seenKeys.push(target.notificationKey);
      continue;
    }
    if (result.skipped) skipped += 1;
    else failed += 1;
  }

  await markSeenForCurrentSession(seenKeys);
  if (processed > 0) revalidateReviewViews(true);

  if (processed === 0 && failed > 0) {
    return { success: false, processed, skipped, failed, error: "تایید گروهی ناموفق بود" };
  }
  return { success: processed > 0 || skipped > 0, processed, skipped, failed };
}

export async function bulkRejectContentForRevisionAction(input: {
  campaignId: string;
  items: BulkReviewTarget[];
  rejectionReason: string;
}): Promise<BulkReviewResult> {
  const session = await getAuthSession();
  if (!session || !canManageAllContent(session)) {
    return { success: false, processed: 0, skipped: 0, failed: 0, error: "فقط مدیر یا کارفرما می‌تواند محتوا را رد کند" };
  }
  if (!isPostgresConfigured()) {
    return { success: false, processed: 0, skipped: 0, failed: 0, error: "این قابلیت فقط با دیتابیس فعال است" };
  }

  const campaignId = input.campaignId?.trim() || "";
  const reason = input.rejectionReason?.trim() || "";
  if (!campaignId) {
    return { success: false, processed: 0, skipped: 0, failed: 0, error: "شناسه کمپین نامعتبر است" };
  }
  if (reason.length < 3) {
    return { success: false, processed: 0, skipped: 0, failed: 0, error: "دلیل رد حداقل ۳ کاراکتر باشد" };
  }

  const targets = dedupeReviewTargets(input.items);
  if (targets.length === 0) {
    return { success: false, processed: 0, skipped: 0, failed: 0, error: "موردی برای رد انتخاب نشده است" };
  }
  if (targets.length > MAX_BULK_REVIEW) {
    return {
      success: false,
      processed: 0,
      skipped: 0,
      failed: 0,
      error: `حداکثر ${MAX_BULK_REVIEW} مورد در هر بار قابل رد است`,
    };
  }

  let processed = 0;
  let skipped = 0;
  let failed = 0;
  const seenKeys: string[] = [];

  for (const target of targets) {
    const result = await rejectOne(session, {
      campaignId,
      contentType: target.contentType,
      contentId: target.contentId,
      rejectionReason: reason,
    });
    if (result.success) {
      processed += 1;
      if (target.notificationKey) seenKeys.push(target.notificationKey);
      continue;
    }
    if (result.skipped) skipped += 1;
    else failed += 1;
  }

  await markSeenForCurrentSession(seenKeys);
  if (processed > 0) revalidateReviewViews();

  if (processed === 0 && failed > 0) {
    return { success: false, processed, skipped, failed, error: "رد گروهی ناموفق بود" };
  }
  return { success: processed > 0 || skipped > 0, processed, skipped, failed };
}

export async function resubmitContentForReviewAction(input: {
  campaignId: string;
  contentType: string;
  contentId: string;
}): Promise<{ success: boolean; error?: string }> {
  const session = await getAuthSession();
  if (!session) return { success: false, error: "برای این عملیات وارد شوید" };
  if (!isPostgresConfigured()) return { success: false, error: "دیتابیس فعال نیست" };

  const contentType = parseReviewableType(input.contentType);
  if (!contentType) return { success: false, error: "نوع محتوا پشتیبانی نمی‌شود" };
  const campaignId = input.campaignId?.trim() || "";
  const contentId = input.contentId?.trim() || "";
  if (!campaignId || !contentId) return { success: false, error: "شناسه محتوا نامعتبر است" };

  const owner = await pgLookupContentOwner({ campaignId, contentId, contentType });
  if (!owner) return { success: false, error: "محتوا یافت نشد" };
  if (!canManageAllContent(session) && (!session.userId || session.userId !== owner.ownerUserId)) {
    return { success: false, error: "فقط مالک محتوا می‌تواند ارسال مجدد بزند" };
  }

  const current = await pgGetContentReview({ campaignId, contentType, contentId });
  if (!current || current.status === "approved") {
    return { success: false, error: "این محتوا در وضعیت برگشتی نیست" };
  }

  const review = await pgUpsertContentReview({
    campaignId,
    contentType,
    contentId,
    status: "resubmitted",
  });
  if (!review) return { success: false, error: "ثبت ارسال مجدد ناموفق بود" };

  await pgSetContentPublished({ campaignId, contentType, contentId, published: true });
  await pgUpdateFollowUpStatusForContent({
    campaignId,
    contentType,
    contentId,
    status: "open",
  });
  await logAuditForSession(session, {
    category: "content",
    action: "content.review.resubmit",
    entityType: "content_review",
    entityId: review.id,
    campaignId,
    label: owner.title || "ارسال مجدد محتوا",
    metadata: { contentType, contentId },
  });

  revalidateReviewViews();
  return { success: true };
}

export async function canManageContentReviewAction(): Promise<{ success: true; canManage: boolean }> {
  const session = await getAuthSession();
  return { success: true, canManage: Boolean(session && (isFullAdmin(session) || session.role === "client")) };
}

export async function listContentReviewsAction(input: {
  campaignId: string;
  statuses?: ContentReviewStatus[];
}): Promise<{
  success: boolean;
  reviews?: Awaited<ReturnType<typeof pgListContentReviews>>;
  canManage?: boolean;
  error?: string;
}> {
  const session = await getAuthSession();
  if (!session) return { success: false, error: "برای مشاهده این بخش وارد شوید" };
  if (!isPostgresConfigured()) return { success: true, reviews: [], canManage: canManageAllContent(session) };

  const campaignId = input.campaignId?.trim() || "";
  if (!campaignId) return { success: false, error: "کمپین نامعتبر است" };

  const ownerFilter = getOwnerFilter(session);
  const reviews = await pgListContentReviews({
    campaignId,
    statuses: input.statuses,
    ownerUserId: ownerFilter,
  });
  return { success: true, reviews, canManage: canManageAllContent(session) };
}
