import type { AdminRole } from "@/lib/types";

export type ChatMessageStatus = "sent" | "delivered" | "seen";

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderKey: string;
  senderUserId: string | null;
  senderName: string | null;
  body: string;
  createdAt: string;
  deliveredAt: string | null;
  seenAt: string | null;
  editedAt: string | null;
  deletedAt: string | null;
  isDeleted: boolean;
  /** Status from the sender's perspective for their own messages. */
  status: ChatMessageStatus;
  isMine: boolean;
}

export interface ChatPeer {
  participantKey: string;
  userId: string | null;
  name: string;
  email: string | null;
  role: AdminRole | "env_admin" | null;
  phone: string | null;
  isOnline: boolean;
  lastSeenAt: string | null;
}

export interface ChatConversationSummary {
  id: string;
  peer: ChatPeer;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  lastMessageSenderKey: string | null;
  unreadCount: number;
  updatedAt: string;
  createdAt: string;
}

export interface ChatSyncPayload {
  conversations: ChatConversationSummary[];
  messages: ChatMessage[];
  peersOnline: Record<string, boolean>;
  unreadTotal: number;
  serverTime: string;
}

export function chatMessageStatus(message: {
  deliveredAt: string | null;
  seenAt: string | null;
}): ChatMessageStatus {
  if (message.seenAt) return "seen";
  if (message.deliveredAt) return "delivered";
  return "sent";
}

export const CHAT_ONLINE_THRESHOLD_MS = 90_000;
export const CHAT_MAX_BODY_LENGTH = 4000;
export const CHAT_MIN_BODY_LENGTH = 1;
