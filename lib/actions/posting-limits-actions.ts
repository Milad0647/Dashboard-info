"use server";

import { revalidatePath } from "next/cache";
import { canManagePostingLimits } from "@/lib/auth/access";
import { getAuthSession } from "@/lib/auth/get-session";
import { logAuditForSession } from "@/lib/audit/log-event";
import { saveDailyPostingLimits } from "@/lib/db/posting-limits-repository";
import {
  normalizeDailyPostingLimits,
  type DailyPostingLimitsConfig,
} from "@/lib/posting-limits";
import { isPostgresConfigured } from "@/lib/utils";

export async function saveDailyPostingLimitsAction(input: {
  campaignId: string;
  config: DailyPostingLimitsConfig;
}): Promise<{ success: boolean; error?: string }> {
  const session = await getAuthSession();
  if (!session || !canManagePostingLimits(session)) {
    return { success: false, error: "فقط مدیر و کارفرما می‌توانند محدودیت روزانه را تنظیم کنند" };
  }

  if (!isPostgresConfigured()) {
    return { success: false, error: "ذخیره محدودیت فقط روی دیتابیس فعال است" };
  }

  const config = normalizeDailyPostingLimits(input.config);
  const saved = await saveDailyPostingLimits(input.campaignId, config);
  if (!saved.success) {
    return { success: false, error: saved.error };
  }

  await logAuditForSession(session, {
    category: "admin",
    action: "campaign.daily_posting_limits",
    entityType: "campaign",
    entityId: input.campaignId,
    campaignId: input.campaignId,
    label: config.enabled ? "محدودیت بارگذاری روزانه فعال شد" : "محدودیت بارگذاری روزانه غیرفعال شد",
    metadata: { enabled: config.enabled },
  });

  revalidatePath("/admin/posting-limits");
  return { success: true };
}
