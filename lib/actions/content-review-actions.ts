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
import { isPostgresConfigured } from "@/lib/utils";

const REVIEWABLE_SET = new Set<string>(REVIEWABLE_CONTENT_TYPES);

function parseReviewableType(value: string): ReviewableContentType | null {
  return REVIEWABLE_SET.has(value) ? (value as ReviewableContentType) : null;
}

async function markSeenForCurrentSession(contentKey?: string | null) {
  if (!contentKey || !isPostgresConfigured()) return;
  const session = await getAuthSession();
  if (!session || !canManageAllContent(session)) return;
  await pgMarkNotificationReads(getNotificationReaderKey(session), [contentKey], true);
}

function revalidateReviewViews() {
  revalidatePath("/admin/elanha");
  revalidatePath("/admin/notifications");
  revalidatePath("/admin/returned-content");
  revalidatePath("/admin/messages");
  revalidatePath("/admin/audit");
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

  const owner = await pgLookupContentOwner({ campaignId, contentId, contentType });
  if (!owner) return { success: false, error: "محتوا یافت نشد" };

  const review = await pgUpsertContentReview({
    campaignId,
    contentType,
    contentId,
    status: "needs_revision",
    rejectionReason: reason.slice(0, 2000),
    rejectedByUserId: session.userId,
  });
  if (!review) return { success: false, error: "ثبت وضعیت رد ناموفق بود" };

  await pgSetContentPublished({ campaignId, contentType, contentId, published: false });
  await clearOfficialScoreOnReject({ campaignId, contentType, contentId });
  await markSeenForCurrentSession(input.notificationKey);

  if (owner.ownerUserId) {
    await pgInsertContentMessage({
      campaignId,
      contentType,
      contentId,
      contentTitle: owner.title || "بدون عنوان",
      recipientUserId: owner.ownerUserId,
      senderUserId: session.type === "db_user" ? session.userId : null,
      senderName: session.name ?? (session.type === "env_admin" ? "مدیر سیستم" : null),
      senderRole: session.role ?? (session.type === "env_admin" ? "admin" : null),
      body: `این محتوا برای ویرایش برگشت داده شد:\n${reason}`,
      parentMessageId: null,
      followUpStatus: "awaiting_user",
    });
  }
  await pgUpdateFollowUpStatusForContent({
    campaignId,
    contentType,
    contentId,
    status: "awaiting_user",
  });

  await logAuditForSession(session, {
    category: "content",
    action: "content.review.reject",
    entityType: "content_review",
    entityId: review.id,
    campaignId,
    label: owner.title || "رد محتوا",
    metadata: { contentType, contentId, reason },
  });

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

  const owner = await pgLookupContentOwner({ campaignId, contentId, contentType });
  if (!owner) return { success: false, error: "محتوا یافت نشد" };

  const review = await pgUpsertContentReview({
    campaignId,
    contentType,
    contentId,
    status: "approved",
  });
  await pgSetContentPublished({ campaignId, contentType, contentId, published: true });
  await finalizeOfficialScore({ campaignId, contentType, contentId });
  await pgUpdateFollowUpStatusForContent({
    campaignId,
    contentType,
    contentId,
    status: "resolved",
  });
  await markSeenForCurrentSession(input.notificationKey);

  await logAuditForSession(session, {
    category: "content",
    action: "content.review.approve",
    entityType: "content_review",
    entityId: review?.id ?? contentId,
    campaignId,
    label: owner.title || "تایید محتوا",
    metadata: { contentType, contentId, everRejected: review?.everRejected ?? false },
  });

  revalidateReviewViews();
  revalidatePath("/admin/performance");
  revalidatePath("/campaign");
  return { success: true };
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
