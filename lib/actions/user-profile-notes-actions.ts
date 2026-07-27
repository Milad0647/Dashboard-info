"use server";

import { canManageUserProfileNotes } from "@/lib/auth/access";
import { getAuthSession, isFullAdmin } from "@/lib/auth/get-session";
import { pgGetUserById } from "@/lib/db/repository-extended";
import {
  pgDeleteUserProfileNote,
  pgInsertUserProfileNote,
  pgListUserProfileNotes,
} from "@/lib/db/user-profile-notes-repository";
import type { UserProfileNote } from "@/lib/user-profile-notes/types";
import { isPostgresConfigured } from "@/lib/utils";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MIN_BODY_LENGTH = 3;
const MAX_BODY_LENGTH = 4000;

function parseUserId(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return UUID_RE.test(trimmed) ? trimmed : null;
}

export async function listUserProfileNotesAction(
  subjectUserId: string
): Promise<{ success: boolean; error?: string; notes?: UserProfileNote[] }> {
  const session = await getAuthSession();
  if (!session || !canManageUserProfileNotes(session)) {
    return { success: false, error: "فقط مدیر و کارفرما می‌توانند یادداشت‌ها را ببینند" };
  }
  if (!isPostgresConfigured()) {
    return { success: false, error: "پایگاه‌داده پیکربندی نشده است" };
  }

  const userId = parseUserId(subjectUserId);
  if (!userId) {
    return { success: false, error: "شناسه کاربر نامعتبر است" };
  }

  const subject = await pgGetUserById(userId);
  if (!subject) {
    return { success: false, error: "کاربر یافت نشد" };
  }

  const notes = await pgListUserProfileNotes({ subjectUserId: userId });
  return { success: true, notes };
}

export async function createUserProfileNoteAction(input: {
  subjectUserId: string;
  body: string;
}): Promise<{ success: boolean; error?: string; note?: UserProfileNote }> {
  const session = await getAuthSession();
  if (!session || !canManageUserProfileNotes(session)) {
    return { success: false, error: "فقط مدیر و کارفرما می‌توانند یادداشت ثبت کنند" };
  }
  if (!isPostgresConfigured()) {
    return { success: false, error: "پایگاه‌داده پیکربندی نشده است" };
  }

  const subjectUserId = parseUserId(input.subjectUserId);
  if (!subjectUserId) {
    return { success: false, error: "شناسه کاربر نامعتبر است" };
  }

  const body = input.body?.trim() ?? "";
  if (body.length < MIN_BODY_LENGTH) {
    return { success: false, error: `متن یادداشت حداقل ${MIN_BODY_LENGTH} کاراکتر باشد` };
  }
  if (body.length > MAX_BODY_LENGTH) {
    return { success: false, error: `متن یادداشت حداکثر ${MAX_BODY_LENGTH} کاراکتر است` };
  }

  const subject = await pgGetUserById(subjectUserId);
  if (!subject) {
    return { success: false, error: "کاربر یافت نشد" };
  }

  let authorName = session.name ?? null;
  let authorRole: string | null = session.role ?? null;
  const authorUserId = session.type === "db_user" ? session.userId : null;

  if (session.type === "env_admin") {
    authorName = authorName ?? "مدیر سیستم";
    authorRole = "admin";
  } else if (authorUserId) {
    const author = await pgGetUserById(authorUserId);
    authorName = authorName ?? author?.name ?? null;
    authorRole = author?.role ?? authorRole;
  }

  const note = await pgInsertUserProfileNote({
    subjectUserId,
    authorUserId,
    authorName,
    authorRole,
    body,
  });

  if (!note) {
    return { success: false, error: "ثبت یادداشت ناموفق بود" };
  }

  return { success: true, note };
}

export async function deleteUserProfileNoteAction(input: {
  noteId: string;
}): Promise<{ success: boolean; error?: string }> {
  const session = await getAuthSession();
  if (!session || !canManageUserProfileNotes(session)) {
    return { success: false, error: "دسترسی مجاز نیست" };
  }
  if (!isPostgresConfigured()) {
    return { success: false, error: "پایگاه‌داده پیکربندی نشده است" };
  }

  const noteId = parseUserId(input.noteId);
  if (!noteId) {
    return { success: false, error: "شناسه یادداشت نامعتبر است" };
  }

  const deleted = await pgDeleteUserProfileNote({
    noteId,
    authorUserId: session.type === "db_user" ? session.userId : null,
    allowAnyAuthor: isFullAdmin(session),
  });

  if (!deleted) {
    return {
      success: false,
      error: isFullAdmin(session)
        ? "یادداشت یافت نشد"
        : "فقط نویسنده یادداشت یا مدیر می‌تواند آن را حذف کند",
    };
  }

  return { success: true };
}
