import { getSql } from "@/lib/db/client";
import type { UserProfileNote } from "@/lib/user-profile-notes/types";
import { isPostgresConfigured } from "@/lib/utils";

let userProfileNotesTableReady: Promise<void> | null = null;

export async function ensureUserProfileNotesTable(): Promise<void> {
  if (!isPostgresConfigured()) return;
  if (!userProfileNotesTableReady) {
    userProfileNotesTableReady = (async () => {
      const sql = getSql();
      await sql`
        CREATE TABLE IF NOT EXISTS user_profile_notes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          subject_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          author_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
          author_name TEXT,
          author_role TEXT,
          body TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_user_profile_notes_subject
          ON user_profile_notes(subject_user_id, created_at DESC)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_user_profile_notes_author
          ON user_profile_notes(author_user_id, created_at DESC)
          WHERE author_user_id IS NOT NULL
      `;
    })().catch((error) => {
      userProfileNotesTableReady = null;
      throw error;
    });
  }
  await userProfileNotesTableReady;
}

function mapRow(row: Record<string, unknown>): UserProfileNote {
  return {
    id: String(row.id),
    subjectUserId: String(row.subject_user_id),
    authorUserId: row.author_user_id ? String(row.author_user_id) : null,
    authorName: row.author_name ? String(row.author_name) : null,
    authorRole: row.author_role ? String(row.author_role) : null,
    body: String(row.body ?? ""),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

export async function pgListUserProfileNotes(input: {
  subjectUserId: string;
  limit?: number;
}): Promise<UserProfileNote[]> {
  if (!isPostgresConfigured()) return [];
  await ensureUserProfileNotesTable();

  const sql = getSql();
  const limit = Math.min(Math.max(input.limit ?? 100, 1), 200);

  const rows = await sql`
    SELECT *
    FROM user_profile_notes
    WHERE subject_user_id = ${input.subjectUserId}::uuid
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  return rows.map((row) => mapRow(row as Record<string, unknown>));
}

export async function pgCountUserProfileNotes(subjectUserId: string): Promise<number> {
  if (!isPostgresConfigured()) return 0;
  await ensureUserProfileNotesTable();

  const sql = getSql();
  const rows = await sql`
    SELECT COUNT(*)::int AS count
    FROM user_profile_notes
    WHERE subject_user_id = ${subjectUserId}::uuid
  `;

  return Number(rows[0]?.count ?? 0);
}

export async function pgInsertUserProfileNote(input: {
  subjectUserId: string;
  authorUserId?: string | null;
  authorName?: string | null;
  authorRole?: string | null;
  body: string;
}): Promise<UserProfileNote | null> {
  if (!isPostgresConfigured()) return null;
  await ensureUserProfileNotesTable();

  const sql = getSql();
  const rows = await sql`
    INSERT INTO user_profile_notes (
      subject_user_id,
      author_user_id,
      author_name,
      author_role,
      body
    ) VALUES (
      ${input.subjectUserId}::uuid,
      ${input.authorUserId ?? null},
      ${input.authorName ?? null},
      ${input.authorRole ?? null},
      ${input.body}
    )
    RETURNING *
  `;

  return rows[0] ? mapRow(rows[0] as Record<string, unknown>) : null;
}

export async function pgDeleteUserProfileNote(input: {
  noteId: string;
  /** When set, only the author may delete (non-admin path). */
  authorUserId?: string | null;
  allowAnyAuthor?: boolean;
}): Promise<boolean> {
  if (!isPostgresConfigured()) return false;
  await ensureUserProfileNotesTable();

  const sql = getSql();
  const noteId = input.noteId.trim();
  if (!noteId) return false;

  if (input.allowAnyAuthor) {
    const rows = await sql`
      DELETE FROM user_profile_notes
      WHERE id = ${noteId}::uuid
      RETURNING id
    `;
    return rows.length > 0;
  }

  const authorUserId = input.authorUserId?.trim() || null;
  if (!authorUserId) return false;

  const rows = await sql`
    DELETE FROM user_profile_notes
    WHERE id = ${noteId}::uuid
      AND author_user_id = ${authorUserId}::uuid
    RETURNING id
  `;
  return rows.length > 0;
}
