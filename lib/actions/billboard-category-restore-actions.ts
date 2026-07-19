"use server";

import { revalidatePath } from "next/cache";
import { getAuthSession, isFullAdmin } from "@/lib/auth/get-session";
import {
  restoreBillboardCategories,
  type RestoreBillboardCategoriesResult,
} from "@/lib/services/restore-billboard-categories";
import { isPostgresConfigured } from "@/lib/utils";

export async function restoreBillboardCategoriesAction(
  campaignId: string
): Promise<{ success: boolean; error?: string; result?: RestoreBillboardCategoriesResult }> {
  const session = await getAuthSession();
  if (!session || !isFullAdmin(session)) {
    return { success: false, error: "فقط مدیر می‌تواند دسته‌بندی‌ها را بازیابی کند" };
  }

  if (!campaignId.trim()) {
    return { success: false, error: "شناسه کمپین الزامی است" };
  }

  if (!isPostgresConfigured()) {
    return { success: false, error: "دیتابیس پیکربندی نشده است" };
  }

  try {
    const result = await restoreBillboardCategories(campaignId.trim());
    revalidatePath("/admin/billboards");
    revalidatePath("/admin");
    revalidatePath("/campaign");
    return { success: true, result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "بازیابی دسته‌بندی‌ها ناموفق بود",
    };
  }
}
