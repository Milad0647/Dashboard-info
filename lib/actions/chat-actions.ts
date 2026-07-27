"use server";

import { canManageAllContent } from "@/lib/auth/access";
import { getAuthSession } from "@/lib/auth/get-session";
import { logAuditForSession } from "@/lib/audit/log-event";
import {
  ENV_ADMIN_DISPLAY_NAME,
  participantKeyFromSession,
  tryParticipantKeyFromSession,
  userIdFromParticipantKey,
} from "@/lib/chat/participant";
import {
  CHAT_MAX_BODY_LENGTH,
  CHAT_MIN_BODY_LENGTH,
  type ChatConversationSummary,
  type ChatMessage,
  type ChatPeer,
} from "@/lib/chat/types";
import {
  pgCountUnreadChatMessages,
  pgGetConversationForParticipant,
  pgGetOrCreateConversation,
  pgGetPeerByKey,
  pgGetPresenceActiveConversation,
  pgInsertChatMessage,
  pgIsParticipantOnline,
  pgListChatContacts,
  pgListConversationsForParticipant,
  pgListMessages,
  pgListMessageStatusUpdates,
  pgMarkMessagesDelivered,
  pgMarkMessagesSeen,
  pgUpsertChatPresence,
} from "@/lib/db/chat-repository";
import { pgGetUserById } from "@/lib/db/repository-extended";
import { pgGetSmsProviderSettings } from "@/lib/db/system-settings";
import { sendSms } from "@/lib/sms/provider";
import { isPostgresConfigured } from "@/lib/utils";

function requireChatSession() {
  return getAuthSession();
}

async function resolveSenderName(
  session: NonNullable<Awaited<ReturnType<typeof getAuthSession>>>
): Promise<string> {
  if (session.type === "env_admin") {
    return session.name?.trim() || ENV_ADMIN_DISPLAY_NAME;
  }
  if (session.name?.trim()) return session.name.trim();
  if (session.userId) {
    const user = await pgGetUserById(session.userId);
    if (user?.name?.trim()) return user.name.trim();
  }
  return "کاربر";
}

async function notifyOfflineRecipient(input: {
  peer: ChatPeer;
  senderName: string;
  bodyPreview: string;
}): Promise<void> {
  const phone = input.peer.phone?.trim();
  if (!phone) return;

  const settings = await pgGetSmsProviderSettings();
  const preview = input.bodyPreview.trim().slice(0, 80);
  const text = `پیام جدید از ${input.senderName} در سامانه: ${preview}`;
  await sendSms(phone, text, settings);
}

export async function heartbeatChatPresenceAction(input?: {
  activeConversationId?: string | null;
}): Promise<{ success: boolean; error?: string }> {
  const session = await requireChatSession();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!isPostgresConfigured()) return { success: true };

  const myKey = tryParticipantKeyFromSession(session);
  if (!myKey) return { success: false, error: "Session invalid" };

  await pgUpsertChatPresence({
    participantKey: myKey,
    userId: session.userId,
    activeConversationId: input?.activeConversationId ?? null,
  });
  return { success: true };
}

export async function listChatConversationsAction(): Promise<{
  success: boolean;
  conversations?: ChatConversationSummary[];
  unreadTotal?: number;
  error?: string;
}> {
  const session = await requireChatSession();
  if (!session) return { success: false, error: "برای مشاهده چت باید وارد شوید" };
  if (!isPostgresConfigured()) {
    return { success: false, error: "چت فقط با دیتابیس فعال است" };
  }

  const myKey = tryParticipantKeyFromSession(session);
  if (!myKey) return { success: false, error: "Session invalid" };

  const conversations = await pgListConversationsForParticipant(myKey);
  const unreadTotal = conversations.reduce((sum, item) => sum + item.unreadCount, 0);
  return { success: true, conversations, unreadTotal };
}

export async function listChatContactsAction(): Promise<{
  success: boolean;
  contacts?: ChatPeer[];
  canStartWithAnyone?: boolean;
  error?: string;
}> {
  const session = await requireChatSession();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!isPostgresConfigured()) {
    return { success: false, error: "چت فقط با دیتابیس فعال است" };
  }

  const myKey = tryParticipantKeyFromSession(session);
  if (!myKey) return { success: false, error: "Session invalid" };

  const canStartWithAnyone = canManageAllContent(session);
  const contacts = await pgListChatContacts({
    myKey,
    canMessageAnyone: canStartWithAnyone,
  });
  return { success: true, contacts, canStartWithAnyone };
}

export async function openChatWithPeerAction(input: {
  peerKey: string;
}): Promise<{
  success: boolean;
  conversationId?: string;
  peer?: ChatPeer;
  error?: string;
}> {
  const session = await requireChatSession();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!isPostgresConfigured()) {
    return { success: false, error: "چت فقط با دیتابیس فعال است" };
  }

  const myKey = participantKeyFromSession(session);
  const peerKey = input.peerKey?.trim() ?? "";
  if (!peerKey || peerKey === myKey) {
    return { success: false, error: "مخاطب نامعتبر است" };
  }

  const canStartWithAnyone = canManageAllContent(session);
  if (!canStartWithAnyone) {
    const peerUserId = userIdFromParticipantKey(peerKey);
    if (peerKey !== "env_admin") {
      if (!peerUserId) return { success: false, error: "مخاطب نامعتبر است" };
      const peerUser = await pgGetUserById(peerUserId);
      if (!peerUser || (peerUser.role !== "admin" && peerUser.role !== "client")) {
        return { success: false, error: "فقط می‌توانید با مدیر یا کارفرما گفتگو کنید" };
      }
    }
  }

  const peer = await pgGetPeerByKey(peerKey);
  if (!peer) return { success: false, error: "مخاطب یافت نشد" };

  const conversation = await pgGetOrCreateConversation({ myKey, peerKey });
  if (!conversation) return { success: false, error: "ایجاد گفتگو ناموفق بود" };

  return { success: true, conversationId: conversation.id, peer };
}

export async function listChatMessagesAction(input: {
  conversationId: string;
  afterCreatedAt?: string | null;
  afterId?: string | null;
}): Promise<{
  success: boolean;
  messages?: ChatMessage[];
  peer?: ChatPeer;
  error?: string;
}> {
  const session = await requireChatSession();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!isPostgresConfigured()) {
    return { success: false, error: "چت فقط با دیتابیس فعال است" };
  }

  const myKey = participantKeyFromSession(session);
  const conversationId = input.conversationId?.trim() ?? "";
  if (!conversationId) return { success: false, error: "شناسه گفتگو نامعتبر است" };

  const conversation = await pgGetConversationForParticipant({ conversationId, myKey });
  if (!conversation) return { success: false, error: "گفتگو یافت نشد" };

  await pgMarkMessagesDelivered({ conversationId, recipientKey: myKey });

  const [messages, peer] = await Promise.all([
    pgListMessages({
      conversationId,
      myKey,
      afterCreatedAt: input.afterCreatedAt,
      afterId: input.afterId,
    }),
    pgGetPeerByKey(conversation.peerKey),
  ]);

  return { success: true, messages, peer: peer ?? undefined };
}

export async function sendChatMessageAction(input: {
  conversationId: string;
  body: string;
}): Promise<{ success: boolean; message?: ChatMessage; error?: string }> {
  const session = await requireChatSession();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!isPostgresConfigured()) {
    return { success: false, error: "چت فقط با دیتابیس فعال است" };
  }

  const myKey = participantKeyFromSession(session);
  const conversationId = input.conversationId?.trim() ?? "";
  const body = input.body?.trim() ?? "";

  if (!conversationId) return { success: false, error: "شناسه گفتگو نامعتبر است" };
  if (body.length < CHAT_MIN_BODY_LENGTH) {
    return { success: false, error: "متن پیام خالی است" };
  }
  if (body.length > CHAT_MAX_BODY_LENGTH) {
    return { success: false, error: `متن پیام حداکثر ${CHAT_MAX_BODY_LENGTH} کاراکتر است` };
  }

  const conversation = await pgGetConversationForParticipant({ conversationId, myKey });
  if (!conversation) return { success: false, error: "گفتگو یافت نشد" };

  const senderName = await resolveSenderName(session);
  const peerOnline = await pgIsParticipantOnline(conversation.peerKey);
  const peerActiveConversation = peerOnline
    ? await pgGetPresenceActiveConversation(conversation.peerKey)
    : null;

  const nowIso = new Date().toISOString();
  const deliveredAt = peerOnline ? nowIso : null;
  const seenAt =
    peerOnline && peerActiveConversation === conversationId ? nowIso : null;

  const message = await pgInsertChatMessage({
    conversationId,
    senderKey: myKey,
    senderUserId: session.type === "db_user" ? session.userId : null,
    senderName,
    body: body.slice(0, CHAT_MAX_BODY_LENGTH),
    deliveredAt,
    seenAt,
  });

  if (!message) return { success: false, error: "ثبت پیام ناموفق بود" };

  if (!peerOnline) {
    const peer = await pgGetPeerByKey(conversation.peerKey);
    if (peer) {
      void notifyOfflineRecipient({
        peer,
        senderName,
        bodyPreview: body,
      });
    }
  }

  await logAuditForSession(session, {
    category: "admin",
    action: "chat.message",
    entityType: "chat_message",
    entityId: message.id,
    label: senderName,
    metadata: {
      conversationId,
      peerKey: conversation.peerKey,
      offlineNotify: !peerOnline,
    },
  });

  return { success: true, message };
}

export async function markChatConversationSeenAction(input: {
  conversationId: string;
}): Promise<{ success: boolean; marked?: number; unreadTotal?: number; error?: string }> {
  const session = await requireChatSession();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!isPostgresConfigured()) return { success: true, marked: 0, unreadTotal: 0 };

  const myKey = participantKeyFromSession(session);
  const conversationId = input.conversationId?.trim() ?? "";
  if (!conversationId) return { success: false, error: "شناسه گفتگو نامعتبر است" };

  const conversation = await pgGetConversationForParticipant({ conversationId, myKey });
  if (!conversation) return { success: false, error: "گفتگو یافت نشد" };

  const marked = await pgMarkMessagesSeen({ conversationId, recipientKey: myKey });
  await pgUpsertChatPresence({
    participantKey: myKey,
    userId: session.userId,
    activeConversationId: conversationId,
  });
  const unreadTotal = await pgCountUnreadChatMessages(myKey);
  return { success: true, marked, unreadTotal };
}

export async function getMyUnreadChatCountAction(): Promise<{
  success: boolean;
  count?: number;
  error?: string;
}> {
  const session = await requireChatSession();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!isPostgresConfigured()) return { success: true, count: 0 };

  const myKey = tryParticipantKeyFromSession(session);
  if (!myKey) return { success: true, count: 0 };

  const count = await pgCountUnreadChatMessages(myKey);
  return { success: true, count };
}

export async function syncChatAction(input: {
  conversationId?: string | null;
  afterCreatedAt?: string | null;
  afterId?: string | null;
  statusSince?: string | null;
}): Promise<{
  success: boolean;
  conversations?: ChatConversationSummary[];
  messages?: ChatMessage[];
  statusUpdates?: ChatMessage[];
  unreadTotal?: number;
  peer?: ChatPeer;
  serverTime?: string;
  error?: string;
}> {
  const session = await requireChatSession();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!isPostgresConfigured()) {
    return { success: false, error: "چت فقط با دیتابیس فعال است" };
  }

  const myKey = participantKeyFromSession(session);
  const conversationId = input.conversationId?.trim() || null;

  await pgUpsertChatPresence({
    participantKey: myKey,
    userId: session.userId,
    activeConversationId: conversationId,
  });

  const conversations = await pgListConversationsForParticipant(myKey);
  const unreadTotal = conversations.reduce((sum, item) => sum + item.unreadCount, 0);
  const serverTime = new Date().toISOString();

  if (!conversationId) {
    return { success: true, conversations, unreadTotal, serverTime, messages: [] };
  }

  const conversation = await pgGetConversationForParticipant({ conversationId, myKey });
  if (!conversation) {
    return { success: true, conversations, unreadTotal, serverTime, messages: [] };
  }

  await pgMarkMessagesDelivered({ conversationId, recipientKey: myKey });

  const [messages, statusUpdates, peer] = await Promise.all([
    pgListMessages({
      conversationId,
      myKey,
      afterCreatedAt: input.afterCreatedAt,
      afterId: input.afterId,
      limit: input.afterCreatedAt ? 100 : 200,
    }),
    input.statusSince
      ? pgListMessageStatusUpdates({
          conversationId,
          myKey,
          sinceIso: input.statusSince,
        })
      : Promise.resolve([] as ChatMessage[]),
    pgGetPeerByKey(conversation.peerKey),
  ]);

  return {
    success: true,
    conversations,
    messages,
    statusUpdates,
    unreadTotal,
    peer: peer ?? undefined,
    serverTime,
  };
}
