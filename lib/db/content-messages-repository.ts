import { getSql } from "@/lib/db/client";
import { SCORE_TABLE_BY_TYPE } from "@/lib/scoring/persist-content-score";
import {
  CONTENT_MESSAGE_CONTENT_TYPES,
  type ContentMessage,
  type ContentMessageContentType,
} from "@/lib/content-messages/types";
import { isPostgresConfigured } from "@/lib/utils";

const CONTENT_TYPE_SET = new Set<string>(CONTENT_MESSAGE_CONTENT_TYPES);

let contentMessagesTableReady: Promise<void> | null = null;

export async function ensureContentMessagesTable(): Promise<void> {
  if (!isPostgresConfigured()) return;
  if (!contentMessagesTableReady) {
    contentMessagesTableReady = (async () => {
      const sql = getSql();
      await sql`
        CREATE TABLE IF NOT EXISTS content_messages (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          campaign_id UUID NOT NULL REFERENCES campaign_settings(id) ON DELETE CASCADE,
          content_type TEXT NOT NULL
            CHECK (content_type IN (
              'billboard',
              'poster',
              'video',
              'file',
              'raw_media',
              'social_post',
              'site_publication',
              'activity',
              'broadcast',
              'meeting'
            )),
          content_id UUID NOT NULL,
          content_title TEXT NOT NULL DEFAULT '',
          recipient_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          sender_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
          sender_name TEXT,
          sender_role TEXT,
          body TEXT NOT NULL,
          seen_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_content_messages_recipient
          ON content_messages(recipient_user_id, created_at DESC)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_content_messages_unread
          ON content_messages(recipient_user_id, created_at DESC)
          WHERE seen_at IS NULL
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_content_messages_campaign
          ON content_messages(campaign_id, created_at DESC)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_content_messages_content
          ON content_messages(content_type, content_id, created_at DESC)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_content_messages_sender
          ON content_messages(sender_user_id, created_at DESC)
          WHERE sender_user_id IS NOT NULL
      `;
    })().catch((error) => {
      contentMessagesTableReady = null;
      throw error;
    });
  }
  await contentMessagesTableReady;
}

function mapRow(row: Record<string, unknown>): ContentMessage {
  return {
    id: String(row.id),
    campaignId: String(row.campaign_id),
    contentType: row.content_type as ContentMessageContentType,
    contentId: String(row.content_id),
    contentTitle: String(row.content_title ?? ""),
    recipientUserId: String(row.recipient_user_id),
    senderUserId: row.sender_user_id ? String(row.sender_user_id) : null,
    senderName: row.sender_name ? String(row.sender_name) : null,
    senderRole: row.sender_role ? String(row.sender_role) : null,
    body: String(row.body ?? ""),
    seenAt: row.seen_at ? new Date(String(row.seen_at)).toISOString() : null,
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

export type ContentOwnerLookup = {
  ownerUserId: string | null;
  campaignId: string | null;
  title: string;
};

export async function pgLookupContentOwner(input: {
  contentType: ContentMessageContentType;
  contentId: string;
  campaignId?: string | null;
}): Promise<ContentOwnerLookup | null> {
  if (!isPostgresConfigured()) return null;
  if (!CONTENT_TYPE_SET.has(input.contentType)) return null;

  const table = SCORE_TABLE_BY_TYPE[input.contentType];
  if (!table) return null;

  await ensureContentMessagesTable();
  const sql = getSql();
  const campaignId = input.campaignId?.trim() || null;

  // Table names come from SCORE_TABLE_BY_TYPE allowlist only.
  const rows = await sql.unsafe(
    `SELECT owner_user_id, campaign_id, title
     FROM ${table}
     WHERE id = $1
       AND ($2::uuid IS NULL OR campaign_id = $2::uuid)
     LIMIT 1`,
    [input.contentId, campaignId]
  );

  if (!rows[0]) return null;
  return {
    ownerUserId: rows[0].owner_user_id ? String(rows[0].owner_user_id) : null,
    campaignId: rows[0].campaign_id ? String(rows[0].campaign_id) : null,
    title: String(rows[0].title ?? ""),
  };
}

export async function pgInsertContentMessage(input: {
  campaignId: string;
  contentType: ContentMessageContentType;
  contentId: string;
  contentTitle: string;
  recipientUserId: string;
  senderUserId?: string | null;
  senderName?: string | null;
  senderRole?: string | null;
  body: string;
}): Promise<ContentMessage | null> {
  if (!isPostgresConfigured()) return null;
  await ensureContentMessagesTable();

  const sql = getSql();
  const rows = await sql`
    INSERT INTO content_messages (
      campaign_id,
      content_type,
      content_id,
      content_title,
      recipient_user_id,
      sender_user_id,
      sender_name,
      sender_role,
      body
    ) VALUES (
      ${input.campaignId}::uuid,
      ${input.contentType},
      ${input.contentId}::uuid,
      ${input.contentTitle},
      ${input.recipientUserId}::uuid,
      ${input.senderUserId ?? null},
      ${input.senderName ?? null},
      ${input.senderRole ?? null},
      ${input.body}
    )
    RETURNING *
  `;

  return rows[0] ? mapRow(rows[0] as Record<string, unknown>) : null;
}

export async function pgListReceivedContentMessages(input: {
  recipientUserId: string;
  limit?: number;
}): Promise<ContentMessage[]> {
  if (!isPostgresConfigured()) return [];
  await ensureContentMessagesTable();

  const sql = getSql();
  const limit = Math.min(Math.max(input.limit ?? 100, 1), 200);

  const rows = await sql`
    SELECT *
    FROM content_messages
    WHERE recipient_user_id = ${input.recipientUserId}::uuid
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  return rows.map((row) => mapRow(row as Record<string, unknown>));
}

export async function pgListSentContentMessages(input: {
  senderUserId?: string | null;
  /** When true (env admin), include messages with null sender_user_id. */
  includeNullSender?: boolean;
  campaignId?: string | null;
  limit?: number;
}): Promise<ContentMessage[]> {
  if (!isPostgresConfigured()) return [];
  await ensureContentMessagesTable();

  const sql = getSql();
  const limit = Math.min(Math.max(input.limit ?? 100, 1), 200);
  const senderUserId = input.senderUserId?.trim() || null;
  const campaignId = input.campaignId?.trim() || null;
  const includeNullSender = Boolean(input.includeNullSender);

  if (!senderUserId && !includeNullSender) return [];

  const rows = await sql`
    SELECT *
    FROM content_messages
    WHERE (
      (${senderUserId}::uuid IS NOT NULL AND sender_user_id = ${senderUserId}::uuid)
      OR (${includeNullSender} AND sender_user_id IS NULL)
    )
      AND (${campaignId}::uuid IS NULL OR campaign_id = ${campaignId}::uuid)
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  return rows.map((row) => mapRow(row as Record<string, unknown>));
}

export async function pgCountUnreadContentMessages(recipientUserId: string): Promise<number> {
  if (!isPostgresConfigured()) return 0;
  await ensureContentMessagesTable();

  const sql = getSql();
  const rows = await sql`
    SELECT COUNT(*)::int AS count
    FROM content_messages
    WHERE recipient_user_id = ${recipientUserId}::uuid
      AND seen_at IS NULL
  `;

  return Number(rows[0]?.count ?? 0);
}

export async function pgMarkContentMessagesSeen(input: {
  recipientUserId: string;
  messageIds?: string[];
}): Promise<number> {
  if (!isPostgresConfigured()) return 0;
  await ensureContentMessagesTable();

  const sql = getSql();
  const ids = (input.messageIds ?? []).map((id) => id.trim()).filter(Boolean);

  if (ids.length > 0) {
    const rows = await sql`
      UPDATE content_messages
      SET seen_at = now()
      WHERE recipient_user_id = ${input.recipientUserId}::uuid
        AND seen_at IS NULL
        AND id = ANY(${ids}::uuid[])
      RETURNING id
    `;
    return rows.length;
  }

  const rows = await sql`
    UPDATE content_messages
    SET seen_at = now()
    WHERE recipient_user_id = ${input.recipientUserId}::uuid
      AND seen_at IS NULL
    RETURNING id
  `;
  return rows.length;
}

export async function pgListMessagesForContent(input: {
  contentType: ContentMessageContentType;
  contentId: string;
  limit?: number;
}): Promise<ContentMessage[]> {
  if (!isPostgresConfigured()) return [];
  await ensureContentMessagesTable();

  const sql = getSql();
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);

  const rows = await sql`
    SELECT *
    FROM content_messages
    WHERE content_type = ${input.contentType}
      AND content_id = ${input.contentId}::uuid
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  return rows.map((row) => mapRow(row as Record<string, unknown>));
}
