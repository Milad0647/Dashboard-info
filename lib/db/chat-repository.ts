import { getSql } from "@/lib/db/client";
import {
  ENV_ADMIN_DISPLAY_NAME,
  ENV_ADMIN_PARTICIPANT_KEY,
  normalizeConversationPair,
  otherParticipantKey,
  parseParticipantKey,
  userIdFromParticipantKey,
  userParticipantKey,
} from "@/lib/chat/participant";
import {
  CHAT_ONLINE_THRESHOLD_MS,
  chatMessageStatus,
  type ChatConversationSummary,
  type ChatMessage,
  type ChatPeer,
} from "@/lib/chat/types";
import type { AdminRole } from "@/lib/types";
import { isPostgresConfigured } from "@/lib/utils";

let chatTablesReady: Promise<void> | null = null;

export async function ensureChatTables(): Promise<void> {
  if (!isPostgresConfigured()) return;
  if (!chatTablesReady) {
    chatTablesReady = (async () => {
      const sql = getSql();
      await sql`
        CREATE TABLE IF NOT EXISTS chat_conversations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          participant_a_key TEXT NOT NULL,
          participant_b_key TEXT NOT NULL,
          last_message_at TIMESTAMPTZ,
          last_message_preview TEXT,
          last_message_sender_key TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT chat_conversations_pair_chk CHECK (participant_a_key < participant_b_key),
          CONSTRAINT chat_conversations_pair_uniq UNIQUE (participant_a_key, participant_b_key)
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS chat_messages (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
          sender_key TEXT NOT NULL,
          sender_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
          sender_name TEXT,
          body TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          delivered_at TIMESTAMPTZ,
          seen_at TIMESTAMPTZ,
          edited_at TIMESTAMPTZ,
          deleted_at TIMESTAMPTZ
        )
      `;
      // Existing installs created chat_messages before edit/delete columns existed.
      await sql`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ`;
      await sql`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`;
      await sql`
        CREATE TABLE IF NOT EXISTS chat_presence (
          participant_key TEXT PRIMARY KEY,
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          active_conversation_id UUID REFERENCES chat_conversations(id) ON DELETE SET NULL
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_chat_conversations_a
          ON chat_conversations(participant_a_key, last_message_at DESC NULLS LAST)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_chat_conversations_b
          ON chat_conversations(participant_b_key, last_message_at DESC NULLS LAST)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation
          ON chat_messages(conversation_id, created_at ASC)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_chat_messages_undelivered
          ON chat_messages(conversation_id, created_at ASC)
          WHERE delivered_at IS NULL
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_chat_messages_unseen
          ON chat_messages(conversation_id, created_at ASC)
          WHERE seen_at IS NULL AND deleted_at IS NULL
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_chat_messages_edited
          ON chat_messages(conversation_id, edited_at DESC)
          WHERE edited_at IS NOT NULL
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_chat_messages_deleted
          ON chat_messages(conversation_id, deleted_at DESC)
          WHERE deleted_at IS NOT NULL
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_chat_presence_seen
          ON chat_presence(last_seen_at DESC)
      `;
    })().catch((error) => {
      chatTablesReady = null;
      throw error;
    });
  }
  await chatTablesReady;
}

function isOnlineFromLastSeen(lastSeenAt: string | null | undefined, nowMs = Date.now()): boolean {
  if (!lastSeenAt) return false;
  const ts = new Date(lastSeenAt).getTime();
  if (!Number.isFinite(ts)) return false;
  return nowMs - ts <= CHAT_ONLINE_THRESHOLD_MS;
}

function mapMessageRow(
  row: Record<string, unknown>,
  myKey: string
): ChatMessage {
  const deliveredAt = row.delivered_at ? new Date(String(row.delivered_at)).toISOString() : null;
  const seenAt = row.seen_at ? new Date(String(row.seen_at)).toISOString() : null;
  const editedAt = row.edited_at ? new Date(String(row.edited_at)).toISOString() : null;
  const deletedAt = row.deleted_at ? new Date(String(row.deleted_at)).toISOString() : null;
  const isDeleted = Boolean(deletedAt);
  const senderKey = String(row.sender_key);
  return {
    id: String(row.id),
    conversationId: String(row.conversation_id),
    senderKey,
    senderUserId: row.sender_user_id ? String(row.sender_user_id) : null,
    senderName: row.sender_name ? String(row.sender_name) : null,
    // Hide original text from clients once deleted for everyone.
    body: isDeleted ? "" : String(row.body ?? ""),
    createdAt: new Date(String(row.created_at)).toISOString(),
    deliveredAt,
    seenAt,
    editedAt,
    deletedAt,
    isDeleted,
    status: chatMessageStatus({ deliveredAt, seenAt }),
    isMine: senderKey === myKey,
  };
}

async function refreshConversationLastMessage(conversationId: string): Promise<void> {
  const sql = getSql();
  const latest = await sql`
    SELECT sender_key, body, created_at
    FROM chat_messages
    WHERE conversation_id = ${conversationId}::uuid
      AND deleted_at IS NULL
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `;
  if (!latest[0]) {
    await sql`
      UPDATE chat_conversations SET
        last_message_at = NULL,
        last_message_preview = NULL,
        last_message_sender_key = NULL,
        updated_at = now()
      WHERE id = ${conversationId}::uuid
    `;
    return;
  }
  const preview = String(latest[0].body ?? "").trim().slice(0, 120);
  await sql`
    UPDATE chat_conversations SET
      last_message_at = ${new Date(String(latest[0].created_at))},
      last_message_preview = ${preview},
      last_message_sender_key = ${String(latest[0].sender_key)},
      updated_at = now()
    WHERE id = ${conversationId}::uuid
  `;
}

async function loadPeerMap(
  keys: string[]
): Promise<Map<string, Omit<ChatPeer, "isOnline" | "lastSeenAt">>> {
  const map = new Map<string, Omit<ChatPeer, "isOnline" | "lastSeenAt">>();
  const unique = [...new Set(keys.filter(Boolean))];
  if (unique.length === 0) return map;

  for (const key of unique) {
    if (key === ENV_ADMIN_PARTICIPANT_KEY) {
      map.set(key, {
        participantKey: key,
        userId: null,
        name: ENV_ADMIN_DISPLAY_NAME,
        email: null,
        role: "env_admin",
        phone: null,
      });
    }
  }

  const userIds = unique
    .map((key) => userIdFromParticipantKey(key))
    .filter((id): id is string => Boolean(id));

  if (userIds.length > 0) {
    const sql = getSql();
    const rows = await sql`
      SELECT id, name, email, role, phone
      FROM users
      WHERE id IN ${sql(userIds)}
    `;
    for (const row of rows) {
      const userId = String(row.id);
      const key = userParticipantKey(userId);
      map.set(key, {
        participantKey: key,
        userId,
        name: String(row.name ?? "بدون نام"),
        email: row.email ? String(row.email) : null,
        role: (row.role as AdminRole) ?? null,
        phone: row.phone ? String(row.phone) : null,
      });
    }
  }

  for (const key of unique) {
    if (!map.has(key)) {
      map.set(key, {
        participantKey: key,
        userId: userIdFromParticipantKey(key),
        name: "کاربر حذف‌شده",
        email: null,
        role: null,
        phone: null,
      });
    }
  }

  return map;
}

async function loadPresenceMap(
  keys: string[]
): Promise<Map<string, { lastSeenAt: string | null; activeConversationId: string | null }>> {
  const map = new Map<string, { lastSeenAt: string | null; activeConversationId: string | null }>();
  const unique = [...new Set(keys.filter(Boolean))];
  if (unique.length === 0) return map;

  const sql = getSql();
  const rows = await sql`
    SELECT participant_key, last_seen_at, active_conversation_id
    FROM chat_presence
    WHERE participant_key IN ${sql(unique)}
  `;
  for (const row of rows) {
    map.set(String(row.participant_key), {
      lastSeenAt: row.last_seen_at ? new Date(String(row.last_seen_at)).toISOString() : null,
      activeConversationId: row.active_conversation_id
        ? String(row.active_conversation_id)
        : null,
    });
  }
  return map;
}

function buildPeer(
  base: Omit<ChatPeer, "isOnline" | "lastSeenAt">,
  presence: { lastSeenAt: string | null } | undefined,
  nowMs: number
): ChatPeer {
  const lastSeenAt = presence?.lastSeenAt ?? null;
  return {
    ...base,
    lastSeenAt,
    isOnline: isOnlineFromLastSeen(lastSeenAt, nowMs),
  };
}

export async function pgUpsertChatPresence(input: {
  participantKey: string;
  userId: string | null;
  activeConversationId?: string | null;
}): Promise<void> {
  if (!isPostgresConfigured()) return;
  await ensureChatTables();
  const sql = getSql();
  const activeId = input.activeConversationId?.trim() || null;
  await sql`
    INSERT INTO chat_presence (participant_key, user_id, last_seen_at, active_conversation_id)
    VALUES (
      ${input.participantKey},
      ${input.userId},
      now(),
      ${activeId}::uuid
    )
    ON CONFLICT (participant_key) DO UPDATE SET
      user_id = COALESCE(EXCLUDED.user_id, chat_presence.user_id),
      last_seen_at = now(),
      active_conversation_id = EXCLUDED.active_conversation_id
  `;
}

export async function pgIsParticipantOnline(participantKey: string): Promise<boolean> {
  if (!isPostgresConfigured()) return false;
  await ensureChatTables();
  const sql = getSql();
  const rows = await sql`
    SELECT last_seen_at
    FROM chat_presence
    WHERE participant_key = ${participantKey}
    LIMIT 1
  `;
  const lastSeenAt = rows[0]?.last_seen_at
    ? new Date(String(rows[0].last_seen_at)).toISOString()
    : null;
  return isOnlineFromLastSeen(lastSeenAt);
}

export async function pgGetPresenceActiveConversation(
  participantKey: string
): Promise<string | null> {
  if (!isPostgresConfigured()) return null;
  await ensureChatTables();
  const sql = getSql();
  const rows = await sql`
    SELECT active_conversation_id, last_seen_at
    FROM chat_presence
    WHERE participant_key = ${participantKey}
    LIMIT 1
  `;
  if (!rows[0]) return null;
  const lastSeenAt = rows[0].last_seen_at
    ? new Date(String(rows[0].last_seen_at)).toISOString()
    : null;
  if (!isOnlineFromLastSeen(lastSeenAt)) return null;
  return rows[0].active_conversation_id ? String(rows[0].active_conversation_id) : null;
}

export async function pgGetOrCreateConversation(input: {
  myKey: string;
  peerKey: string;
}): Promise<{ id: string; created: boolean } | null> {
  if (!isPostgresConfigured()) return null;
  await ensureChatTables();
  const { participantAKey, participantBKey } = normalizeConversationPair(
    input.myKey,
    input.peerKey
  );
  const sql = getSql();

  const existing = await sql`
    SELECT id FROM chat_conversations
    WHERE participant_a_key = ${participantAKey}
      AND participant_b_key = ${participantBKey}
    LIMIT 1
  `;
  if (existing[0]?.id) {
    return { id: String(existing[0].id), created: false };
  }

  const inserted = await sql`
    INSERT INTO chat_conversations (participant_a_key, participant_b_key)
    VALUES (${participantAKey}, ${participantBKey})
    ON CONFLICT (participant_a_key, participant_b_key) DO UPDATE
      SET updated_at = chat_conversations.updated_at
    RETURNING id
  `;
  const id = inserted[0]?.id ? String(inserted[0].id) : null;
  if (!id) return null;

  const wasExisting = Boolean(existing[0]?.id);
  return { id, created: !wasExisting };
}

export async function pgGetConversationForParticipant(input: {
  conversationId: string;
  myKey: string;
}): Promise<{
  id: string;
  participantAKey: string;
  participantBKey: string;
  peerKey: string;
} | null> {
  if (!isPostgresConfigured()) return null;
  await ensureChatTables();
  const sql = getSql();
  const rows = await sql`
    SELECT id, participant_a_key, participant_b_key
    FROM chat_conversations
    WHERE id = ${input.conversationId}
      AND (
        participant_a_key = ${input.myKey}
        OR participant_b_key = ${input.myKey}
      )
    LIMIT 1
  `;
  if (!rows[0]) return null;
  const participantAKey = String(rows[0].participant_a_key);
  const participantBKey = String(rows[0].participant_b_key);
  return {
    id: String(rows[0].id),
    participantAKey,
    participantBKey,
    peerKey: otherParticipantKey(participantAKey, participantBKey, input.myKey),
  };
}

export async function pgInsertChatMessage(input: {
  conversationId: string;
  senderKey: string;
  senderUserId: string | null;
  senderName: string | null;
  body: string;
  deliveredAt?: string | null;
  seenAt?: string | null;
}): Promise<ChatMessage | null> {
  if (!isPostgresConfigured()) return null;
  await ensureChatTables();
  const sql = getSql();
  const preview = input.body.trim().slice(0, 120);

  const rows = await sql`
    INSERT INTO chat_messages (
      conversation_id,
      sender_key,
      sender_user_id,
      sender_name,
      body,
      delivered_at,
      seen_at
    )
    VALUES (
      ${input.conversationId}::uuid,
      ${input.senderKey},
      ${input.senderUserId},
      ${input.senderName},
      ${input.body},
      ${input.deliveredAt ? new Date(input.deliveredAt) : null},
      ${input.seenAt ? new Date(input.seenAt) : null}
    )
    RETURNING *
  `;

  await sql`
    UPDATE chat_conversations SET
      last_message_at = now(),
      last_message_preview = ${preview},
      last_message_sender_key = ${input.senderKey},
      updated_at = now()
    WHERE id = ${input.conversationId}::uuid
  `;

  if (!rows[0]) return null;
  return mapMessageRow(rows[0] as Record<string, unknown>, input.senderKey);
}

export async function pgListConversationsForParticipant(
  myKey: string
): Promise<ChatConversationSummary[]> {
  if (!isPostgresConfigured()) return [];
  await ensureChatTables();
  const sql = getSql();
  const rows = await sql`
    SELECT
      c.id,
      c.participant_a_key,
      c.participant_b_key,
      c.last_message_at,
      c.last_message_preview,
      c.last_message_sender_key,
      c.created_at,
      c.updated_at,
      (
        SELECT COUNT(*)::int
        FROM chat_messages m
        WHERE m.conversation_id = c.id
          AND m.sender_key <> ${myKey}
          AND m.seen_at IS NULL
          AND m.deleted_at IS NULL
      ) AS unread_count
    FROM chat_conversations c
    WHERE c.participant_a_key = ${myKey}
       OR c.participant_b_key = ${myKey}
    ORDER BY COALESCE(c.last_message_at, c.created_at) DESC
  `;

  const peerKeys = rows.map((row) =>
    otherParticipantKey(String(row.participant_a_key), String(row.participant_b_key), myKey)
  );
  const [peerMap, presenceMap] = await Promise.all([
    loadPeerMap(peerKeys),
    loadPresenceMap(peerKeys),
  ]);
  const nowMs = Date.now();

  return rows.map((row) => {
    const peerKey = otherParticipantKey(
      String(row.participant_a_key),
      String(row.participant_b_key),
      myKey
    );
    const base = peerMap.get(peerKey)!;
    return {
      id: String(row.id),
      peer: buildPeer(base, presenceMap.get(peerKey), nowMs),
      lastMessageAt: row.last_message_at
        ? new Date(String(row.last_message_at)).toISOString()
        : null,
      lastMessagePreview: row.last_message_preview ? String(row.last_message_preview) : null,
      lastMessageSenderKey: row.last_message_sender_key
        ? String(row.last_message_sender_key)
        : null,
      unreadCount: Number(row.unread_count ?? 0),
      createdAt: new Date(String(row.created_at)).toISOString(),
      updatedAt: new Date(String(row.updated_at)).toISOString(),
    };
  });
}

export async function pgListMessages(input: {
  conversationId: string;
  myKey: string;
  afterCreatedAt?: string | null;
  afterId?: string | null;
  limit?: number;
}): Promise<ChatMessage[]> {
  if (!isPostgresConfigured()) return [];
  await ensureChatTables();
  const sql = getSql();
  const limit = Math.min(Math.max(input.limit ?? 200, 1), 500);
  const afterCreatedAt = input.afterCreatedAt?.trim() || null;
  const afterId = input.afterId?.trim() || null;

  const rows =
    afterCreatedAt && afterId
      ? await sql`
          SELECT *
          FROM chat_messages
          WHERE conversation_id = ${input.conversationId}::uuid
            AND (
              created_at > ${new Date(afterCreatedAt)}
              OR (created_at = ${new Date(afterCreatedAt)} AND id > ${afterId}::uuid)
            )
          ORDER BY created_at ASC, id ASC
          LIMIT ${limit}
        `
      : await sql`
          SELECT *
          FROM (
            SELECT *
            FROM chat_messages
            WHERE conversation_id = ${input.conversationId}::uuid
            ORDER BY created_at DESC, id DESC
            LIMIT ${limit}
          ) recent
          ORDER BY created_at ASC, id ASC
        `;

  return rows.map((row) => mapMessageRow(row as Record<string, unknown>, input.myKey));
}

export async function pgMarkMessagesDelivered(input: {
  conversationId: string;
  recipientKey: string;
}): Promise<number> {
  if (!isPostgresConfigured()) return 0;
  await ensureChatTables();
  const sql = getSql();
  const rows = await sql`
    UPDATE chat_messages
    SET delivered_at = now()
    WHERE conversation_id = ${input.conversationId}::uuid
      AND sender_key <> ${input.recipientKey}
      AND delivered_at IS NULL
      AND deleted_at IS NULL
    RETURNING id
  `;
  return rows.length;
}

export async function pgMarkMessagesSeen(input: {
  conversationId: string;
  recipientKey: string;
}): Promise<number> {
  if (!isPostgresConfigured()) return 0;
  await ensureChatTables();
  const sql = getSql();
  const rows = await sql`
    UPDATE chat_messages
    SET
      delivered_at = COALESCE(delivered_at, now()),
      seen_at = now()
    WHERE conversation_id = ${input.conversationId}::uuid
      AND sender_key <> ${input.recipientKey}
      AND seen_at IS NULL
      AND deleted_at IS NULL
    RETURNING id
  `;
  return rows.length;
}

export async function pgCountUnreadChatMessages(myKey: string): Promise<number> {
  if (!isPostgresConfigured()) return 0;
  await ensureChatTables();
  const sql = getSql();
  const rows = await sql`
    SELECT COUNT(*)::int AS count
    FROM chat_messages m
    INNER JOIN chat_conversations c ON c.id = m.conversation_id
    WHERE (c.participant_a_key = ${myKey} OR c.participant_b_key = ${myKey})
      AND m.sender_key <> ${myKey}
      AND m.seen_at IS NULL
      AND m.deleted_at IS NULL
  `;
  return Number(rows[0]?.count ?? 0);
}

export async function pgListChatContacts(input: {
  myKey: string;
  canMessageAnyone: boolean;
}): Promise<ChatPeer[]> {
  if (!isPostgresConfigured()) return [];
  await ensureChatTables();
  const sql = getSql();
  const myUserId = userIdFromParticipantKey(input.myKey);

  const rows = input.canMessageAnyone
    ? await sql`
        SELECT id, name, email, role, phone
        FROM users
        WHERE (${myUserId}::uuid IS NULL OR id <> ${myUserId}::uuid)
        ORDER BY
          CASE role
            WHEN 'admin' THEN 0
            WHEN 'client' THEN 1
            ELSE 2
          END,
          name ASC
      `
    : await sql`
        SELECT id, name, email, role, phone
        FROM users
        WHERE role IN ('admin', 'client')
          AND (${myUserId}::uuid IS NULL OR id <> ${myUserId}::uuid)
        ORDER BY
          CASE role WHEN 'admin' THEN 0 ELSE 1 END,
          name ASC
      `;

  const keys = rows.map((row) => userParticipantKey(String(row.id)));
  if (!input.canMessageAnyone) {
    keys.push(ENV_ADMIN_PARTICIPANT_KEY);
  }

  const presenceMap = await loadPresenceMap(keys);
  const nowMs = Date.now();
  const peers: ChatPeer[] = [];

  if (!input.canMessageAnyone) {
    peers.push(
      buildPeer(
        {
          participantKey: ENV_ADMIN_PARTICIPANT_KEY,
          userId: null,
          name: ENV_ADMIN_DISPLAY_NAME,
          email: null,
          role: "env_admin",
          phone: null,
        },
        presenceMap.get(ENV_ADMIN_PARTICIPANT_KEY),
        nowMs
      )
    );
  }

  for (const row of rows) {
    const key = userParticipantKey(String(row.id));
    peers.push(
      buildPeer(
        {
          participantKey: key,
          userId: String(row.id),
          name: String(row.name ?? "بدون نام"),
          email: row.email ? String(row.email) : null,
          role: (row.role as AdminRole) ?? null,
          phone: row.phone ? String(row.phone) : null,
        },
        presenceMap.get(key),
        nowMs
      )
    );
  }

  // Online contacts first when starting a new conversation.
  peers.sort((a, b) => {
    if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
    return a.name.localeCompare(b.name, "fa");
  });

  return peers;
}

export async function pgGetPeerByKey(peerKey: string): Promise<ChatPeer | null> {
  if (!isPostgresConfigured()) return null;
  await ensureChatTables();
  const parsed = parseParticipantKey(peerKey);
  if (!parsed) return null;
  const [peerMap, presenceMap] = await Promise.all([
    loadPeerMap([peerKey]),
    loadPresenceMap([peerKey]),
  ]);
  const base = peerMap.get(peerKey);
  if (!base) return null;
  return buildPeer(base, presenceMap.get(peerKey), Date.now());
}

export async function pgListMessageStatusUpdates(input: {
  conversationId: string;
  myKey: string;
  sinceIso: string;
}): Promise<ChatMessage[]> {
  if (!isPostgresConfigured()) return [];
  await ensureChatTables();
  const sql = getSql();
  const since = new Date(input.sinceIso);
  const rows = await sql`
    SELECT *
    FROM chat_messages
    WHERE conversation_id = ${input.conversationId}::uuid
      AND (
        (
          sender_key = ${input.myKey}
          AND (
            (delivered_at IS NOT NULL AND delivered_at > ${since})
            OR (seen_at IS NOT NULL AND seen_at > ${since})
          )
        )
        OR (edited_at IS NOT NULL AND edited_at > ${since})
        OR (deleted_at IS NOT NULL AND deleted_at > ${since})
      )
    ORDER BY created_at ASC, id ASC
  `;
  return rows.map((row) => mapMessageRow(row as Record<string, unknown>, input.myKey));
}

export async function pgGetChatMessageForSender(input: {
  messageId: string;
  senderKey: string;
}): Promise<{
  id: string;
  conversationId: string;
  body: string;
  deletedAt: string | null;
} | null> {
  if (!isPostgresConfigured()) return null;
  await ensureChatTables();
  const sql = getSql();
  const rows = await sql`
    SELECT id, conversation_id, body, deleted_at
    FROM chat_messages
    WHERE id = ${input.messageId}::uuid
      AND sender_key = ${input.senderKey}
    LIMIT 1
  `;
  if (!rows[0]) return null;
  return {
    id: String(rows[0].id),
    conversationId: String(rows[0].conversation_id),
    body: String(rows[0].body ?? ""),
    deletedAt: rows[0].deleted_at ? new Date(String(rows[0].deleted_at)).toISOString() : null,
  };
}

export async function pgEditChatMessage(input: {
  messageId: string;
  senderKey: string;
  body: string;
}): Promise<ChatMessage | null> {
  if (!isPostgresConfigured()) return null;
  await ensureChatTables();
  const sql = getSql();
  const rows = await sql`
    UPDATE chat_messages
    SET
      body = ${input.body},
      edited_at = now()
    WHERE id = ${input.messageId}::uuid
      AND sender_key = ${input.senderKey}
      AND deleted_at IS NULL
    RETURNING *
  `;
  if (!rows[0]) return null;

  const conversationId = String(rows[0].conversation_id);
  await refreshConversationLastMessage(conversationId);
  return mapMessageRow(rows[0] as Record<string, unknown>, input.senderKey);
}

export async function pgSoftDeleteChatMessage(input: {
  messageId: string;
  senderKey: string;
}): Promise<ChatMessage | null> {
  if (!isPostgresConfigured()) return null;
  await ensureChatTables();
  const sql = getSql();
  const rows = await sql`
    UPDATE chat_messages
    SET
      deleted_at = now(),
      body = ''
    WHERE id = ${input.messageId}::uuid
      AND sender_key = ${input.senderKey}
      AND deleted_at IS NULL
    RETURNING *
  `;
  if (!rows[0]) return null;

  const conversationId = String(rows[0].conversation_id);
  await refreshConversationLastMessage(conversationId);
  return mapMessageRow(rows[0] as Record<string, unknown>, input.senderKey);
}
