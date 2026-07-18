import { getSql } from "@/lib/db/client";
import type {
  CampaignDirective,
  DirectiveActionType,
  DirectiveAttachment,
  DirectiveAudienceType,
  DirectivePriority,
  DirectiveRecipient,
  DirectiveSmsStatus,
  DirectiveSystemAction,
} from "@/lib/types";
import { isDirectiveActionType, isDirectiveSystemAction } from "@/lib/directive-cta";
import type { UserRegion } from "@/lib/user-regions";
import { generateId } from "@/lib/utils";

function toDateString(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) return value.toISOString().split("T")[0];
  return String(value).split("T")[0] || null;
}

function toIsoString(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function mapAttachment(row: Record<string, unknown>): DirectiveAttachment {
  const fileName = String(row.file_name ?? "");
  const titleRaw = String(row.title ?? "").trim();
  return {
    id: String(row.id),
    directiveId: String(row.directive_id),
    title: titleRaw || fileName,
    fileUrl: String(row.file_url ?? ""),
    fileName,
    mimeType: String(row.mime_type ?? "application/octet-stream"),
    fileSize: Number(row.file_size ?? 0),
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: toIsoString(row.created_at) ?? new Date().toISOString(),
  };
}

function mapPriority(value: unknown): DirectivePriority {
  return value === "urgent" ? "urgent" : "normal";
}

function mapAudienceType(value: unknown): DirectiveAudienceType {
  if (value === "region" || value === "users") return value;
  return "all";
}

function mapRegion(value: unknown): UserRegion | null {
  if (value === "north" || value === "south" || value === "east" || value === "west") {
    return value;
  }
  return null;
}

function mapSmsStatus(value: unknown): DirectiveSmsStatus {
  if (
    value === "sent" ||
    value === "failed" ||
    value === "no_phone" ||
    value === "skipped" ||
    value === "pending"
  ) {
    return value;
  }
  return "pending";
}

function mapActionType(value: unknown): DirectiveActionType {
  return isDirectiveActionType(value) ? value : "none";
}

function mapSystemAction(value: unknown): DirectiveSystemAction | null {
  return isDirectiveSystemAction(value) ? value : null;
}

function mapDirectiveRow(
  row: Record<string, unknown>,
  attachments: DirectiveAttachment[]
): CampaignDirective {
  const dueDate = toDateString(row.due_date);
  const startDate = toDateString(row.start_date);
  const endDate = toDateString(row.end_date) ?? dueDate;
  const letterFileUrl = row.letter_file_url ? String(row.letter_file_url) : null;
  const letterFromAttachment =
    !letterFileUrl && attachments[0]
      ? {
          letterFileUrl: attachments[0].fileUrl,
          letterFileName: attachments[0].fileName,
          letterMimeType: attachments[0].mimeType,
          letterFileSize: attachments[0].fileSize,
        }
      : null;

  return {
    id: String(row.id),
    campaignId: String(row.campaign_id),
    createdByUserId: row.created_by_user_id ? String(row.created_by_user_id) : null,
    createdByName: row.created_by_name ? String(row.created_by_name) : null,
    title: String(row.title ?? ""),
    body: String(row.body ?? ""),
    priority: mapPriority(row.priority),
    dueDate,
    startDate,
    endDate,
    letterFileUrl: letterFileUrl ?? letterFromAttachment?.letterFileUrl ?? null,
    letterFileName: row.letter_file_name
      ? String(row.letter_file_name)
      : letterFromAttachment?.letterFileName ?? null,
    letterMimeType: row.letter_mime_type
      ? String(row.letter_mime_type)
      : letterFromAttachment?.letterMimeType ?? null,
    letterFileSize:
      row.letter_file_size != null
        ? Number(row.letter_file_size)
        : letterFromAttachment?.letterFileSize ?? 0,
    audienceType: mapAudienceType(row.audience_type),
    audienceRegion: mapRegion(row.audience_region),
    actionType: mapActionType(row.action_type),
    actionLabel: row.action_label ? String(row.action_label) : null,
    actionUrl: row.action_url ? String(row.action_url) : null,
    systemAction: mapSystemAction(row.system_action),
    published: Boolean(row.published),
    publishedAt: toIsoString(row.published_at),
    sortOrder: Number(row.sort_order ?? 0),
    attachments,
    seenCount: row.seen_count != null ? Number(row.seen_count) : undefined,
    unseenCount: row.unseen_count != null ? Number(row.unseen_count) : undefined,
    recipientCount: row.recipient_count != null ? Number(row.recipient_count) : undefined,
    confirmed: row.confirmed != null ? Boolean(row.confirmed) : undefined,
    seenAt: toIsoString(row.seen_at),
    createdAt: toIsoString(row.created_at) ?? new Date().toISOString(),
    updatedAt: toIsoString(row.updated_at) ?? new Date().toISOString(),
  };
}

async function loadAttachmentsForDirectives(
  directiveIds: string[]
): Promise<Map<string, DirectiveAttachment[]>> {
  const map = new Map<string, DirectiveAttachment[]>();
  if (directiveIds.length === 0) return map;

  const sql = getSql();
  const rows = await sql`
    SELECT * FROM directive_attachments
    WHERE directive_id IN ${sql(directiveIds)}
    ORDER BY sort_order ASC, created_at ASC
  `;

  for (const row of rows) {
    const attachment = mapAttachment(row as Record<string, unknown>);
    const list = map.get(attachment.directiveId) ?? [];
    list.push(attachment);
    map.set(attachment.directiveId, list);
  }
  return map;
}

export async function pgListCampaignUsersForDirectives(campaignId: string): Promise<
  Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    region: UserRegion | null;
    phone: string | null;
  }>
> {
  const sql = getSql();
  const rows = await sql`
    SELECT u.id, u.name, u.email, u.role, u.region, u.phone
    FROM users u
    INNER JOIN user_campaign_access uca ON uca.user_id = u.id
    WHERE uca.campaign_id = ${campaignId}
      AND u.role IN ('contributor', 'client')
    ORDER BY u.name ASC
  `;

  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name ?? ""),
    email: String(row.email ?? ""),
    role: String(row.role ?? "contributor"),
    region: mapRegion(row.region),
    phone: typeof row.phone === "string" && row.phone.trim() ? String(row.phone).trim() : null,
  }));
}

export async function pgResolveDirectiveAudienceUserIds(input: {
  campaignId: string;
  audienceType: DirectiveAudienceType;
  audienceRegion?: UserRegion | null;
  selectedUserIds?: string[];
}): Promise<string[]> {
  const users = await pgListCampaignUsersForDirectives(input.campaignId);

  if (input.audienceType === "users") {
    const selected = new Set(input.selectedUserIds ?? []);
    return users.filter((user) => selected.has(user.id)).map((user) => user.id);
  }

  if (input.audienceType === "region") {
    const region = input.audienceRegion;
    if (!region) return [];
    return users.filter((user) => user.region === region).map((user) => user.id);
  }

  return users.map((user) => user.id);
}

export async function pgListDirectivesForCampaign(
  campaignId: string
): Promise<CampaignDirective[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT
      d.*,
      creator.name AS created_by_name,
      COALESCE(stats.recipient_count, 0)::int AS recipient_count,
      COALESCE(stats.seen_count, 0)::int AS seen_count,
      COALESCE(stats.unseen_count, 0)::int AS unseen_count
    FROM campaign_directives d
    LEFT JOIN users creator ON creator.id = d.created_by_user_id
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*)::int AS recipient_count,
        COUNT(*) FILTER (WHERE confirmed = true)::int AS seen_count,
        COUNT(*) FILTER (WHERE confirmed = false)::int AS unseen_count
      FROM directive_recipients r
      WHERE r.directive_id = d.id
    ) stats ON true
    WHERE d.campaign_id = ${campaignId}
    ORDER BY d.created_at DESC
  `;

  const ids = rows.map((row) => String(row.id));
  const attachmentsMap = await loadAttachmentsForDirectives(ids);

  return rows.map((row) =>
    mapDirectiveRow(row as Record<string, unknown>, attachmentsMap.get(String(row.id)) ?? [])
  );
}

export async function pgListDirectivesForUserInbox(
  campaignId: string,
  userId: string
): Promise<CampaignDirective[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT
      d.*,
      creator.name AS created_by_name,
      r.confirmed,
      r.seen_at
    FROM campaign_directives d
    INNER JOIN directive_recipients r ON r.directive_id = d.id AND r.user_id = ${userId}
    LEFT JOIN users creator ON creator.id = d.created_by_user_id
    WHERE d.campaign_id = ${campaignId}
      AND d.published = true
    ORDER BY d.created_at DESC
  `;

  const ids = rows.map((row) => String(row.id));
  const attachmentsMap = await loadAttachmentsForDirectives(ids);

  return rows.map((row) =>
    mapDirectiveRow(row as Record<string, unknown>, attachmentsMap.get(String(row.id)) ?? [])
  );
}

export async function pgGetDirectiveById(id: string): Promise<CampaignDirective | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT
      d.*,
      creator.name AS created_by_name,
      COALESCE(stats.recipient_count, 0)::int AS recipient_count,
      COALESCE(stats.seen_count, 0)::int AS seen_count,
      COALESCE(stats.unseen_count, 0)::int AS unseen_count
    FROM campaign_directives d
    LEFT JOIN users creator ON creator.id = d.created_by_user_id
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*)::int AS recipient_count,
        COUNT(*) FILTER (WHERE confirmed = true)::int AS seen_count,
        COUNT(*) FILTER (WHERE confirmed = false)::int AS unseen_count
      FROM directive_recipients r
      WHERE r.directive_id = d.id
    ) stats ON true
    WHERE d.id = ${id}
    LIMIT 1
  `;
  if (!rows[0]) return null;

  const attachmentsMap = await loadAttachmentsForDirectives([id]);
  return mapDirectiveRow(
    rows[0] as Record<string, unknown>,
    attachmentsMap.get(id) ?? []
  );
}

export async function pgListDirectiveRecipients(
  directiveId: string
): Promise<DirectiveRecipient[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT
      r.*,
      u.name AS user_name,
      u.email AS user_email,
      u.role AS user_role,
      u.phone AS user_phone
    FROM directive_recipients r
    INNER JOIN users u ON u.id = r.user_id
    WHERE r.directive_id = ${directiveId}
    ORDER BY u.name ASC
  `;

  return rows.map((row) => ({
    directiveId: String(row.directive_id),
    userId: String(row.user_id),
    userName: String(row.user_name ?? ""),
    userEmail: String(row.user_email ?? ""),
    userRole: (row.user_role === "admin" || row.user_role === "client"
      ? row.user_role
      : "contributor") as DirectiveRecipient["userRole"],
    userPhone:
      typeof row.user_phone === "string" && row.user_phone.trim()
        ? String(row.user_phone).trim()
        : null,
    smsStatus: mapSmsStatus(row.sms_status),
    smsError: row.sms_error ? String(row.sms_error) : null,
    smsSentAt: toIsoString(row.sms_sent_at),
    seenAt: toIsoString(row.seen_at),
    confirmed: Boolean(row.confirmed),
  }));
}

export interface SaveDirectiveInput {
  id?: string;
  campaignId: string;
  createdByUserId?: string | null;
  title: string;
  body: string;
  priority: DirectivePriority;
  startDate?: string | null;
  endDate?: string | null;
  letterFileUrl?: string | null;
  letterFileName?: string | null;
  letterMimeType?: string | null;
  letterFileSize?: number;
  audienceType: DirectiveAudienceType;
  audienceRegion?: UserRegion | null;
  actionType?: DirectiveActionType;
  actionLabel?: string | null;
  actionUrl?: string | null;
  systemAction?: DirectiveSystemAction | null;
  published?: boolean;
  attachments?: Array<{
    id?: string;
    title: string;
    fileUrl: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
  }>;
  selectedUserIds?: string[];
}

export async function pgSaveDirective(input: SaveDirectiveInput): Promise<{ id: string }> {
  const sql = getSql();
  const id = input.id ?? generateId();
  const now = new Date().toISOString();
  const published = input.published ?? true;
  const startDate = input.startDate?.trim() || null;
  const endDate = input.endDate?.trim() || null;
  const letterFileUrl = input.letterFileUrl?.trim() || null;
  const letterFileName = input.letterFileName?.trim() || null;
  const letterMimeType = input.letterMimeType?.trim() || null;
  const letterFileSize = letterFileUrl ? Number(input.letterFileSize ?? 0) : 0;
  const audienceRegion =
    input.audienceType === "region" ? (input.audienceRegion ?? null) : null;
  const actionType = input.actionType ?? "none";
  const actionLabel =
    actionType === "none" ? null : input.actionLabel?.trim() || null;
  const actionUrl = actionType === "custom_url" ? input.actionUrl?.trim() || null : null;
  const systemAction = actionType === "system" ? input.systemAction ?? null : null;

  const existing = input.id
    ? await sql`SELECT id, published_at FROM campaign_directives WHERE id = ${id} LIMIT 1`
    : [];
  const wasNew = existing.length === 0;
  const previousPublishedAt = existing[0]?.published_at
    ? toIsoString(existing[0].published_at)
    : null;
  const publishedAt = published
    ? previousPublishedAt ?? now
    : null;

  await sql`
    INSERT INTO campaign_directives (
      id, campaign_id, created_by_user_id, title, body, priority, due_date,
      start_date, end_date, letter_file_url, letter_file_name, letter_mime_type, letter_file_size,
      audience_type, audience_region, action_type, action_label, action_url, system_action,
      published, published_at, sort_order, created_at, updated_at
    ) VALUES (
      ${id},
      ${input.campaignId},
      ${input.createdByUserId ?? null},
      ${input.title},
      ${input.body},
      ${input.priority},
      ${endDate},
      ${startDate},
      ${endDate},
      ${letterFileUrl},
      ${letterFileName},
      ${letterMimeType},
      ${letterFileSize},
      ${input.audienceType},
      ${audienceRegion},
      ${actionType},
      ${actionLabel},
      ${actionUrl},
      ${systemAction},
      ${published},
      ${publishedAt},
      0,
      ${now},
      ${now}
    )
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      body = EXCLUDED.body,
      priority = EXCLUDED.priority,
      due_date = EXCLUDED.due_date,
      start_date = EXCLUDED.start_date,
      end_date = EXCLUDED.end_date,
      letter_file_url = EXCLUDED.letter_file_url,
      letter_file_name = EXCLUDED.letter_file_name,
      letter_mime_type = EXCLUDED.letter_mime_type,
      letter_file_size = EXCLUDED.letter_file_size,
      audience_type = EXCLUDED.audience_type,
      audience_region = EXCLUDED.audience_region,
      action_type = EXCLUDED.action_type,
      action_label = EXCLUDED.action_label,
      action_url = EXCLUDED.action_url,
      system_action = EXCLUDED.system_action,
      published = EXCLUDED.published,
      published_at = COALESCE(campaign_directives.published_at, EXCLUDED.published_at),
      updated_at = EXCLUDED.updated_at
  `;

  await sql`DELETE FROM directive_attachments WHERE directive_id = ${id}`;
  const attachments = input.attachments ?? [];
  for (let index = 0; index < attachments.length; index += 1) {
    const attachment = attachments[index];
    const attachmentId = attachment.id ?? generateId();
    const attachmentTitle =
      attachment.title?.trim() || attachment.fileName?.trim() || `پیوست ${index + 1}`;
    await sql`
      INSERT INTO directive_attachments (
        id, directive_id, title, file_url, file_name, mime_type, file_size, sort_order, created_at
      ) VALUES (
        ${attachmentId},
        ${id},
        ${attachmentTitle},
        ${attachment.fileUrl},
        ${attachment.fileName},
        ${attachment.mimeType || "application/octet-stream"},
        ${attachment.fileSize || 0},
        ${index},
        ${now}
      )
    `;
  }

  const recipientIds = published
    ? await pgResolveDirectiveAudienceUserIds({
        campaignId: input.campaignId,
        audienceType: input.audienceType,
        audienceRegion,
        selectedUserIds: input.selectedUserIds,
      })
    : [];

  const existingRecipients = await sql`
    SELECT user_id, confirmed, seen_at, sms_status, sms_error, sms_sent_at
    FROM directive_recipients
    WHERE directive_id = ${id}
  `;
  const previousByUser = new Map(
    existingRecipients.map((row) => [String(row.user_id), row])
  );

  await sql`DELETE FROM directive_recipients WHERE directive_id = ${id}`;

  for (const userId of recipientIds) {
    const previous = previousByUser.get(userId);
    await sql`
      INSERT INTO directive_recipients (
        directive_id, user_id, sms_status, sms_error, sms_sent_at, seen_at, confirmed, created_at
      ) VALUES (
        ${id},
        ${userId},
        ${previous ? String(previous.sms_status ?? "pending") : "pending"},
        ${previous?.sms_error ? String(previous.sms_error) : null},
        ${previous?.sms_sent_at ? toIsoString(previous.sms_sent_at) : null},
        ${previous?.seen_at ? toIsoString(previous.seen_at) : null},
        ${previous ? Boolean(previous.confirmed) : false},
        ${now}
      )
    `;
  }

  void wasNew;
  return { id };
}

export async function pgDeleteDirective(id: string): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM campaign_directives WHERE id = ${id}`;
}

export async function pgConfirmDirectiveSeen(
  directiveId: string,
  userId: string
): Promise<boolean> {
  const sql = getSql();
  const now = new Date().toISOString();
  const rows = await sql`
    UPDATE directive_recipients
    SET confirmed = true,
        seen_at = COALESCE(seen_at, ${now})
    WHERE directive_id = ${directiveId}
      AND user_id = ${userId}
    RETURNING user_id
  `;
  return rows.length > 0;
}

export async function pgUpdateRecipientSmsStatus(input: {
  directiveId: string;
  userId: string;
  smsStatus: DirectiveSmsStatus;
  smsError?: string | null;
}): Promise<void> {
  const sql = getSql();
  const sentAt = input.smsStatus === "sent" ? new Date().toISOString() : null;
  await sql`
    UPDATE directive_recipients
    SET sms_status = ${input.smsStatus},
        sms_error = ${input.smsError ?? null},
        sms_sent_at = CASE
          WHEN ${input.smsStatus} = 'sent' THEN COALESCE(sms_sent_at, ${sentAt})
          ELSE sms_sent_at
        END
    WHERE directive_id = ${input.directiveId}
      AND user_id = ${input.userId}
  `;
}

export async function pgGetPendingSmsRecipients(directiveId: string): Promise<
  Array<{ userId: string; phone: string | null; userName: string }>
> {
  const sql = getSql();
  const rows = await sql`
    SELECT r.user_id, u.phone, u.name
    FROM directive_recipients r
    INNER JOIN users u ON u.id = r.user_id
    WHERE r.directive_id = ${directiveId}
      AND r.sms_status IN ('pending', 'failed')
  `;
  return rows.map((row) => ({
    userId: String(row.user_id),
    phone: typeof row.phone === "string" && row.phone.trim() ? String(row.phone).trim() : null,
    userName: String(row.name ?? ""),
  }));
}
