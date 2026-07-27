"use server";

import { revalidatePath } from "next/cache";
import { getAuthSession, isFullAdmin } from "@/lib/auth/get-session";
import {
  pgCompleteTutorial,
  pgGetSectionTutorial,
  pgGetTutorialCompletionStatus,
  pgListSectionTutorials,
  pgListTutorialCompletionStatuses,
  pgSaveSectionTutorial,
} from "@/lib/db/repository-tutorials";
import {
  pgGetSectionTutorialsEnabledMap,
  pgIsSectionTutorialEnabled,
  pgSetSectionTutorialEnabled,
} from "@/lib/db/tutorial-settings";
import {
  isTutorialSectionKey,
  normalizeTutorialSteps,
  type TutorialSectionKey,
  type TutorialStep,
} from "@/lib/section-tutorials";
import { isPostgresConfigured } from "@/lib/utils";

function requirePostgres() {
  if (!isPostgresConfigured()) {
    return { success: false as const, error: "Database required" };
  }
  return null;
}

export async function getTutorialStatusAction(sectionKey: string) {
  const session = await getAuthSession();
  if (!session) return { success: false as const, error: "Unauthorized" };
  if (!isTutorialSectionKey(sectionKey)) {
    return { success: false as const, error: "بخش نامعتبر است" };
  }

  const dbError = requirePostgres();
  if (dbError) return dbError;

  const tutorialEnabled = await pgIsSectionTutorialEnabled(sectionKey);
  if (!tutorialEnabled || isFullAdmin(session) || session.role === "client" || !session.userId) {
    const tutorial = await pgGetSectionTutorial(sectionKey);
    return {
      success: true as const,
      bypass: true as const,
      status: {
        sectionKey,
        hasContent: Boolean(tutorial?.steps.length),
        title: tutorial?.title ?? "",
        version: tutorial?.version ?? 0,
        steps: tutorial?.steps ?? [],
        isCompleted: true,
        completedVersion: tutorial?.version ?? null,
      },
    };
  }

  const status = await pgGetTutorialCompletionStatus(session.userId, sectionKey);
  return { success: true as const, bypass: false as const, status };
}

export async function getSectionTutorialsEnabledMapAction() {
  const session = await getAuthSession();
  if (!session || !isFullAdmin(session)) {
    return { success: false as const, error: "Unauthorized" };
  }

  const dbError = requirePostgres();
  if (dbError) return dbError;

  const enabledMap = await pgGetSectionTutorialsEnabledMap();
  return { success: true as const, enabledMap };
}

export async function setSectionTutorialEnabledAction(
  sectionKey: string,
  enabled: boolean
) {
  const session = await getAuthSession();
  if (!session || !isFullAdmin(session)) {
    return { success: false as const, error: "Unauthorized" };
  }
  if (!isTutorialSectionKey(sectionKey)) {
    return { success: false as const, error: "بخش نامعتبر است" };
  }

  const dbError = requirePostgres();
  if (dbError) return dbError;

  const result = await pgSetSectionTutorialEnabled(sectionKey, enabled);
  if (result.success) {
    revalidatePath("/admin/tutorials");
  }
  return result;
}

export async function completeTutorialAction(sectionKey: string) {
  const session = await getAuthSession();
  if (!session?.userId) {
    return { success: false as const, error: "Unauthorized" };
  }
  if (!isTutorialSectionKey(sectionKey)) {
    return { success: false as const, error: "بخش نامعتبر است" };
  }

  const dbError = requirePostgres();
  if (dbError) return dbError;

  if (isFullAdmin(session)) {
    return { success: true as const };
  }

  const tutorial = await pgGetSectionTutorial(sectionKey);
  if (!tutorial || tutorial.steps.length === 0) {
    return {
      success: false as const,
      error: "آموزش این بخش هنوز توسط مدیر آماده نشده است",
    };
  }

  return pgCompleteTutorial({
    userId: session.userId,
    sectionKey,
    tutorialVersion: tutorial.version,
  });
}

export async function listTutorialsForAdminAction() {
  const session = await getAuthSession();
  if (!session || !isFullAdmin(session)) {
    return { success: false as const, error: "Unauthorized" };
  }

  const dbError = requirePostgres();
  if (dbError) return dbError;

  const tutorials = await pgListSectionTutorials();
  return { success: true as const, tutorials };
}

export async function listMyTutorialStatusesAction() {
  const session = await getAuthSession();
  if (!session) return { success: false as const, error: "Unauthorized" };

  const dbError = requirePostgres();
  if (dbError) return dbError;

  if (!session.userId || isFullAdmin(session) || session.role === "client") {
    return { success: true as const, statuses: [] };
  }

  const statuses = await pgListTutorialCompletionStatuses(session.userId);
  return { success: true as const, statuses };
}

export async function saveSectionTutorialAction(input: {
  sectionKey: TutorialSectionKey;
  title: string;
  steps: TutorialStep[];
}) {
  const session = await getAuthSession();
  if (!session || !isFullAdmin(session)) {
    return { success: false as const, error: "Unauthorized" };
  }
  if (!isTutorialSectionKey(input.sectionKey)) {
    return { success: false as const, error: "بخش نامعتبر است" };
  }

  const dbError = requirePostgres();
  if (dbError) return dbError;

  const steps = normalizeTutorialSteps(input.steps);
  if (steps.length === 0) {
    return {
      success: false as const,
      error: "حداقل یک مرحله آموزشی لازم است",
    };
  }

  for (const step of steps) {
    if (!step.title.trim()) {
      return { success: false as const, error: "عنوان هر مرحله الزامی است" };
    }
    if (!step.body.trim()) {
      return { success: false as const, error: "متن هر مرحله الزامی است" };
    }
  }

  const result = await pgSaveSectionTutorial({
    sectionKey: input.sectionKey,
    title: input.title,
    steps,
    bumpVersion: true,
  });

  if (result.success) {
    revalidatePath("/admin/tutorials");
  }

  return result;
}
