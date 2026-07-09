"use server";

import { revalidatePath } from "next/cache";
import { getAuthSession } from "@/lib/auth/get-session";
import { canAccessNotifications } from "@/lib/auth/access";
import { pgGetNotificationReads, pgMarkNotificationReads } from "@/lib/db/repository-extended";
import { getNotificationReaderKey } from "@/lib/notification-reader";
import { isPostgresConfigured } from "@/lib/utils";

export async function getNotificationReadsAction(): Promise<string[]> {
  const session = await getAuthSession();
  if (!session?.userId && session?.type !== "env_admin") {
    return [];
  }
  if (!canAccessNotifications(session)) {
    return [];
  }

  if (!isPostgresConfigured()) {
    return [];
  }

  const readerKey = getNotificationReaderKey(session);
  return pgGetNotificationReads(readerKey);
}

export async function markNotificationsSeenAction(
  campaignId: string,
  contentKeys: string[],
  confirmed = false
) {
  const session = await getAuthSession();
  if (!session?.userId && session?.type !== "env_admin") {
    return { success: false, error: "Unauthorized" };
  }
  if (!canAccessNotifications(session)) {
    return { success: false, error: "Unauthorized" };
  }

  if (!isPostgresConfigured()) {
    return { success: true };
  }

  try {
    const readerKey = getNotificationReaderKey(session);
    await pgMarkNotificationReads(readerKey, contentKeys, confirmed);
    revalidatePath("/admin/elanha");
    revalidatePath("/admin/notifications");
    return { success: true };
  } catch (error) {
    console.error("markNotificationsSeenAction failed:", error);
    return { success: false, error: "Failed to save notification reads" };
  }
}
