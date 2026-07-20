"use server";

import { revalidatePath } from "next/cache";
import { canScoreContent } from "@/lib/auth/access";
import { getAuthSession } from "@/lib/auth/get-session";
import { normalizeScoreValue } from "@/lib/content-score";
import { logAuditForSession } from "@/lib/audit/log-event";
import {
  recalculateCampaignScores,
  saveCampaignScoringRules,
  setManualScore,
} from "@/lib/scoring/persist-content-score";
import { normalizeScoringRules } from "@/lib/scoring/normalize-scoring-rules";
import type { CampaignScoringRules, ScoreableContentType } from "@/lib/types";
import { isPostgresConfigured } from "@/lib/utils";

export async function saveContentScoreAction(input: {
  campaignId: string;
  contentType: ScoreableContentType;
  contentId: string;
  /** Manual bonus only; final score = auto + manual. */
  score: number | null;
}): Promise<{
  success: boolean;
  error?: string;
  autoScore?: number;
  manualScore?: number;
  score?: number;
}> {
  const session = await getAuthSession();
  if (!session || !canScoreContent(session)) {
    return { success: false, error: "فقط مدیر و کارفرما می‌توانند امتیاز بدهند" };
  }

  if (!isPostgresConfigured()) {
    return { success: false, error: "ذخیره امتیاز فقط روی دیتابیس فعال است" };
  }

  const normalized = normalizeScoreValue(input.score);
  if (!normalized.ok) {
    return { success: false, error: normalized.error };
  }

  const result = await setManualScore({
    campaignId: input.campaignId,
    contentType: input.contentType,
    contentId: input.contentId,
    manualScore: normalized.value,
  });

  if (!result.success) {
    return { success: false, error: result.error ?? "ذخیره امتیاز ناموفق بود" };
  }

  await logAuditForSession(session, {
    category: "content",
    action: "content.score",
    entityType: input.contentType,
    entityId: input.contentId,
    campaignId: input.campaignId,
    label: `امتیاز دستی اضافه (${result.manualScore ?? 0}) — جمع ${result.score ?? 0}`,
    metadata: {
      manualScore: result.manualScore,
      autoScore: result.autoScore,
      score: result.score,
    },
  });

  revalidatePath(`/admin`);
  revalidatePath(`/campaign`);
  return {
    success: true,
    autoScore: result.autoScore,
    manualScore: result.manualScore,
    score: result.score,
  };
}

export async function saveScoringRulesAction(input: {
  campaignId: string;
  scoringRules: CampaignScoringRules;
  /** When true, recalculate all content and reset manual bonuses. */
  applyAndRecalculate?: boolean;
}): Promise<{ success: boolean; error?: string; updated?: number }> {
  const session = await getAuthSession();
  if (!session || !canScoreContent(session)) {
    return { success: false, error: "فقط مدیر و کارفرما می‌توانند قوانین امتیاز را ذخیره کنند" };
  }

  if (!isPostgresConfigured()) {
    return { success: false, error: "ذخیره قوانین فقط روی دیتابیس فعال است" };
  }

  const scoringRules = normalizeScoringRules(input.scoringRules);
  const saved = await saveCampaignScoringRules(input.campaignId, scoringRules);
  if (!saved.success) {
    return { success: false, error: saved.error };
  }

  let updated = 0;
  if (input.applyAndRecalculate !== false) {
    const recalc = await recalculateCampaignScores({
      campaignId: input.campaignId,
      scoringRules,
      resetManual: true,
    });
    if (!recalc.success) {
      return { success: false, error: recalc.error };
    }
    updated = recalc.updated;
  }

  await logAuditForSession(session, {
    category: "admin",
    action: "campaign.scoring_rules",
    entityType: "campaign",
    entityId: input.campaignId,
    campaignId: input.campaignId,
    label: `ذخیره قوانین امتیازدهی${updated ? ` و محاسبه مجدد (${updated} مورد)` : ""}`,
    metadata: { updated, applyAndRecalculate: input.applyAndRecalculate !== false },
  });

  revalidatePath(`/admin`);
  revalidatePath(`/campaign`);
  return { success: true, updated };
}

export async function recalculateCampaignScoresAction(input: {
  campaignId: string;
}): Promise<{ success: boolean; error?: string; updated?: number }> {
  const session = await getAuthSession();
  if (!session || !canScoreContent(session)) {
    return { success: false, error: "فقط مدیر و کارفرما می‌توانند امتیازها را محاسبه کنند" };
  }

  const result = await recalculateCampaignScores({
    campaignId: input.campaignId,
    resetManual: true,
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  revalidatePath(`/admin`);
  revalidatePath(`/campaign`);
  return { success: true, updated: result.updated };
}
