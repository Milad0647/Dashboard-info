import { getSql } from "@/lib/db/client";
import {
  normalizeDailyPostingLimits,
  type DailyPostingLimitsConfig,
} from "@/lib/posting-limits";
import { isPostgresConfigured } from "@/lib/utils";

async function ensureDailyPostingLimitsColumn() {
  const sql = getSql();
  await sql`
    ALTER TABLE campaign_settings
    ADD COLUMN IF NOT EXISTS daily_posting_limits JSONB NOT NULL DEFAULT '{}'::jsonb
  `;
}

export async function loadDailyPostingLimits(
  campaignId: string
): Promise<DailyPostingLimitsConfig> {
  if (!isPostgresConfigured()) return normalizeDailyPostingLimits(null);
  await ensureDailyPostingLimitsColumn();
  const sql = getSql();
  const rows = await sql`
    SELECT daily_posting_limits FROM campaign_settings WHERE id = ${campaignId} LIMIT 1
  `;
  return normalizeDailyPostingLimits(rows[0]?.daily_posting_limits);
}

export async function saveDailyPostingLimits(
  campaignId: string,
  config: DailyPostingLimitsConfig
): Promise<{ success: boolean; error?: string }> {
  if (!isPostgresConfigured()) {
    return { success: false, error: "ذخیره محدودیت فقط روی دیتابیس فعال است" };
  }
  await ensureDailyPostingLimitsColumn();
  const sql = getSql();
  const now = new Date().toISOString();
  const normalized = normalizeDailyPostingLimits(config);
  await sql`
    UPDATE campaign_settings
    SET daily_posting_limits = ${sql.json(JSON.parse(JSON.stringify(normalized)))},
        updated_at = ${now}
    WHERE id = ${campaignId}
  `;
  return { success: true };
}
