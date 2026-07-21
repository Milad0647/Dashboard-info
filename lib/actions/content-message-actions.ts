"use server";

import { revalidatePath } from "next/cache";
import { canManageAllContent, canSendContentMessages } from "@/lib/auth/access";
import { getAuthSession } from "@/lib/auth/get-session";
import { logAuditForSession } from "@/lib/audit/log-event";
import {
  CONTENT_MESSAGE_CONTENT_TYPES,
  CONTENT_MESSAGE_TYPE_LABELS,
  buildContentMessageAdminPath,
  type ContentMessage,
  type ContentMessageContentType,
  type SendContentMessageInput,
} from "@/lib/content-messages/types";
import {
  pgCountUnreadContentMessages,
  pgInsertContentMessage,
  pgListMessagesForContent,
  pgListReceivedContentMessages,
  pgListSentContentMessages,
  pgLookupContentOwner,
  pgMarkContentMessagesSeen,
} from "@/lib/db/content-messages-repository";
import { pgGetUserById } from "@/lib/db/repository-extended";
import { isPostgresConfigured } from "@/lib/utils";

const CONTENT_TYPE_SET = new Set<string>(CONTENT_MESSAGE_CONTENT_TYPES);

export type ContentMessageListItem = ContentMessage & {
  contentTypeLabel: string;
  adminPath: string;
  isUnread: boolean;
};

function toListItem(message: ContentMessage): ContentMessageListItem {
  return {
    ...message,
    contentTypeLabel: CONTENT_MESSAGE_TYPE_LABELS[message.contentType] ?? message.contentType,
    adminPath: buildContentMessageAdminPath(
      message.contentType,
      message.campaignId,
      message.contentId
    ),
    isUnread: !message.seenAt,
  };
}

function parseContentType(value: string): ContentMessageContentType | null {
  return CONTENT_TYPE_SET.has(value) ? (value as ContentMessageContentType) : null;
}

export async function sendContentMessageAction(
  input: SendContentMessageInput
): Promise<{ success: boolean; error?: string; message?: ContentMessageListItem }> {
  const session = await getAuthSession();
  if (!session || !canSendContentMessages(session)) {
    return { success: false, error: "فقط مدیر و کارفرما می‌توانند پیام بفرستند" };
  }
  if (!isPostgresConfigured()) {
    return { success: false, error: "ارسال پیام فقط با دیتابیس فعال است" };
  }

  const contentType = parseContentType(input.contentType);
  if (!contentType) {
    return { success: false, error: "نوع محتوا نامعتبر است" };
  }

  const contentId = input.contentId?.trim() ?? "";
  const campaignId = input.campaignId?.trim() ?? "";
  const body = input.body?.trim() ?? "";

  if (!contentId || !campaignId) {
    return { success: false, error: "شناسه محتوا نامعتبر است" };
  }
  if (body.length < 3) {
    return { success: false, error: "متن پیام حداقل ۳ کاراکتر باشد" };
  }
  if (body.length > 2000) {
    return { success: false, error: "متن پیام حداکثر ۲۰۰۰ کاراکتر است" };
  }

  const owner = await pgLookupContentOwner({
    contentType,
    contentId,
    campaignId,
  });
  if (!owner) {
    return { success: false, error: "محتوا یافت نشد" };
  }
  if (!owner.ownerUserId) {
    return { success: false, error: "این محتوا مالک مشخصی ندارد و نمی‌توان پیام فرستاد" };
  }

  let senderName = session.name ?? null;
  if (session.type === "env_admin") {
    senderName = senderName ?? "مدیر سیستم";
  } else if (session.userId) {
    const user = await pgGetUserById(session.userId);
    senderName = senderName ?? user?.name ?? null;
  }

  const created = await pgInsertContentMessage({
    campaignId: owner.campaignId ?? campaignId,
    contentType,
    contentId,
    contentTitle: (input.contentTitle?.trim() || owner.title || "بدون عنوان").slice(0, 200),
    recipientUserId: owner.ownerUserId,
    senderUserId: session.type === "db_user" ? session.userId : null,
    senderName,
    senderRole: session.role ?? (session.type === "env_admin" ? "admin" : null),
    body: body.slice(0, 2000),
  });

  if (!created) {
    return { success: false, error: "ثبت پیام با خطا مواجه شد" };
  }

  await logAuditForSession(session, {
    category: "admin",
    action: "content.message",
    entityType: "content_message",
    entityId: created.id,
    campaignId: created.campaignId,
    label: created.contentTitle,
    metadata: {
      contentType,
      contentId,
      recipientUserId: created.recipientUserId,
    },
  });

  revalidatePath("/admin/messages");
  return { success: true, message: toListItem(created) };
}

export async function listMyContentMessagesAction(input?: {
  campaignId?: string | null;
}): Promise<{
  success: boolean;
  received?: ContentMessageListItem[];
  sent?: ContentMessageListItem[];
  canSend?: boolean;
  error?: string;
}> {
  const session = await getAuthSession();
  if (!session) {
    return { success: false, error: "برای مشاهده پیام‌ها باید وارد شوید" };
  }
  if (!isPostgresConfigured()) {
    return { success: false, error: "دیتابیس فعال نیست" };
  }

  const canSend = canSendContentMessages(session);
  const campaignId = input?.campaignId?.trim() || null;

  const received =
    session.userId
      ? (await pgListReceivedContentMessages({ recipientUserId: session.userId })).map(toListItem)
      : [];

  let sent: ContentMessageListItem[] = [];
  if (canSend) {
    sent = (
      await pgListSentContentMessages({
        senderUserId: session.type === "db_user" ? session.userId : null,
        includeNullSender: session.type === "env_admin",
        campaignId,
      })
    ).map(toListItem);
  }

  return { success: true, received, sent, canSend };
}

export async function getMyUnreadContentMessageCountAction(): Promise<{
  success: boolean;
  count?: number;
  error?: string;
}> {
  const session = await getAuthSession();
  if (!session) {
    return { success: false, error: "Unauthorized" };
  }
  if (!isPostgresConfigured() || !session.userId) {
    return { success: true, count: 0 };
  }

  const count = await pgCountUnreadContentMessages(session.userId);
  return { success: true, count };
}

export async function markMyContentMessagesSeenAction(input?: {
  messageIds?: string[];
}): Promise<{ success: boolean; marked?: number; error?: string }> {
  const session = await getAuthSession();
  if (!session?.userId) {
    return { success: false, error: "برای مشاهده پیام‌ها باید وارد شوید" };
  }
  if (!isPostgresConfigured()) {
    return { success: false, error: "دیتابیس فعال نیست" };
  }

  const marked = await pgMarkContentMessagesSeen({
    recipientUserId: session.userId,
    messageIds: input?.messageIds,
  });

  revalidatePath("/admin/messages");
  return { success: true, marked };
}

export async function listContentMessagesForCardAction(input: {
  contentType: string;
  contentId: string;
}): Promise<{ success: boolean; messages?: ContentMessageListItem[]; error?: string }> {
  const session = await getAuthSession();
  if (!session || !canManageAllContent(session)) {
    return { success: false, error: "دسترسی ندارید" };
  }
  if (!isPostgresConfigured()) {
    return { success: true, messages: [] };
  }

  const contentType = parseContentType(input.contentType);
  const contentId = input.contentId?.trim() ?? "";
  if (!contentType || !contentId) {
    return { success: false, error: "شناسه محتوا نامعتبر است" };
  }

  const messages = (await pgListMessagesForContent({ contentType, contentId })).map(toListItem);
  return { success: true, messages };
}
