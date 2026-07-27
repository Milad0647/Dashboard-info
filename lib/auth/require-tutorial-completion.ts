import { getAuthSession, isFullAdmin } from "@/lib/auth/get-session";
import { pgIdExists } from "@/lib/db/pg-id-exists";
import {
  pgGetTutorialCompletionStatus,
} from "@/lib/db/repository-tutorials";
import { pgIsSectionTutorialEnabled } from "@/lib/db/tutorial-settings";
import type { TutorialSectionKey } from "@/lib/section-tutorials";
import { isPostgresConfigured } from "@/lib/utils";

/**
 * Blocks contributor create flows until the current tutorial version is completed.
 * Admins and clients are not gated. Missing tutorial content also blocks contributors.
 * When a section's tutorial is disabled by an admin, the gate is skipped for that section.
 */
export async function assertContributorTutorialCompleted(
  sectionKey: TutorialSectionKey
): Promise<{ success: false; error: string } | null> {
  const session = await getAuthSession();
  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  if (isFullAdmin(session) || session.role === "client") {
    return null;
  }

  if (session.role !== "contributor") {
    return null;
  }

  if (!session.userId) {
    return { success: false, error: "Unauthorized" };
  }

  if (!isPostgresConfigured()) {
    return null;
  }

  if (!(await pgIsSectionTutorialEnabled(sectionKey))) {
    return null;
  }

  const status = await pgGetTutorialCompletionStatus(session.userId, sectionKey);

  if (!status.hasContent) {
    return {
      success: false,
      error: "آموزش این بخش هنوز توسط مدیر آماده نشده است",
    };
  }

  if (!status.isCompleted) {
    return {
      success: false,
      error: "ابتدا آموزش این بخش را تکمیل کنید",
    };
  }

  return null;
}

type ExistsTable = Parameters<typeof pgIdExists>[0];

/**
 * Gate create-only saves. If `id` already exists in the table, treat as update and skip.
 */
export async function assertTutorialForPossibleCreate(
  sectionKey: TutorialSectionKey,
  table: ExistsTable,
  id: string | undefined | null
): Promise<{ success: false; error: string } | null> {
  if (!isPostgresConfigured()) return null;

  if (id) {
    const exists = await pgIdExists(table, id);
    if (exists) return null;
  }

  return assertContributorTutorialCompleted(sectionKey);
}
