import type {
  ScoreBreakdownEntry,
  ScoreableContentType,
  ScoringRule,
} from "@/lib/types";
import { getScoreableField } from "@/lib/scoring/scoreable-fields";
import {
  computeBillboardPolicyScore,
  computeFlatSectionScore,
  computeSocialAudienceScore,
  type CampaignScoringPolicy,
} from "@/lib/scoring/scoring-policy";

export interface ComputeContentScoreResult {
  autoScore: number;
  /** Score before company multipliers (phase / entitlement). */
  rawScore: number;
  breakdown: ScoreBreakdownEntry[];
}

function isFilled(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as object).length > 0;
  return false;
}

function normalizeComparable(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).join(",");
  return String(value).trim().toLowerCase();
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toDateKey(value: unknown): string | null {
  if (value == null || value === "") return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function matchRange(value: unknown, rule: ScoringRule, valueType: string): boolean {
  const hasMin = rule.min !== undefined && rule.min !== null && rule.min !== "";
  const hasMax = rule.max !== undefined && rule.max !== null && rule.max !== "";
  if (!hasMin && !hasMax) return false;

  if (valueType === "date") {
    const current = toDateKey(value);
    if (!current) return false;
    if (hasMin) {
      const minKey = toDateKey(rule.min);
      if (!minKey || current < minKey) return false;
    }
    if (hasMax) {
      const maxKey = toDateKey(rule.max);
      if (!maxKey || current > maxKey) return false;
    }
    return true;
  }

  const current = toNumber(value);
  if (current == null) return false;
  if (hasMin) {
    const min = toNumber(rule.min);
    if (min == null || current < min) return false;
  }
  if (hasMax) {
    const max = toNumber(rule.max);
    if (max == null || current > max) return false;
  }
  return true;
}

function readFieldValue(item: Record<string, unknown>, field: string): unknown {
  return item[field];
}

function ruleMatches(
  contentType: ScoreableContentType,
  item: Record<string, unknown>,
  rule: ScoringRule
): boolean {
  const fieldDef = getScoreableField(contentType, rule.field);
  const value = readFieldValue(item, rule.field);
  const valueType = fieldDef?.valueType ?? "text";

  switch (rule.kind) {
    case "filled":
      return isFilled(value);
    case "equals": {
      if (!isFilled(value) && rule.value !== "false") return false;
      const target = normalizeComparable(rule.value ?? "");
      if (Array.isArray(value)) {
        return value.some((entry) => normalizeComparable(entry) === target);
      }
      return normalizeComparable(value) === target;
    }
    case "range":
      return matchRange(value, rule, valueType);
    default:
      return false;
  }
}

function isRejectedOrDuplicate(item: Record<string, unknown>): boolean {
  const status = typeof item.status === "string" ? item.status.toLowerCase() : "";
  if (status === "rejected") return true;
  if (item.isDuplicate === true) return true;
  return false;
}

function computeFromFieldRules(
  contentType: ScoreableContentType,
  item: Record<string, unknown>,
  rules: ScoringRule[]
): ComputeContentScoreResult {
  if (!rules.length) {
    return { autoScore: 0, rawScore: 0, breakdown: [] };
  }

  const breakdown: ScoreBreakdownEntry[] = [];
  let autoScore = 0;

  for (const rule of rules) {
    const matched = ruleMatches(contentType, item, rule);
    const points = matched ? rule.points : 0;
    if (matched) autoScore += rule.points;
    breakdown.push({
      ruleId: rule.id,
      field: rule.field,
      points,
      matched,
    });
  }

  return { autoScore, rawScore: autoScore, breakdown };
}

/**
 * Compute automatic score from campaign policy (preferred) and/or field rules.
 */
export function computeContentScore(
  contentType: ScoreableContentType,
  item: Record<string, unknown>,
  rules: ScoringRule[],
  policy?: CampaignScoringPolicy | null
): ComputeContentScoreResult {
  if (isRejectedOrDuplicate(item)) {
    return { autoScore: 0, rawScore: 0, breakdown: [] };
  }

  if (policy?.enabled) {
    if (contentType === "billboard") {
      const result = computeBillboardPolicyScore(item, policy);
      return {
        autoScore: result.final,
        rawScore: result.raw,
        breakdown: [
          {
            ruleId: "policy.topic",
            field: "planLabels",
            points: result.topic,
            matched: true,
          },
          {
            ruleId: "policy.approvedDesign",
            field: "usesApprovedDesign",
            points: result.approvedDesign,
            matched: true,
          },
          {
            ruleId: "policy.mediaValue",
            field: "category",
            points: result.mediaValue,
            matched: true,
          },
          {
            ruleId: "policy.location",
            field: "locationType",
            points: result.location,
            matched: true,
          },
          {
            ruleId: "policy.area",
            field: "areaSqm",
            points: result.area,
            matched: true,
          },
          {
            ruleId: "policy.phase",
            field: "phase",
            points: result.phase,
            matched: true,
          },
          {
            ruleId: "policy.entitlement",
            field: "entitlement",
            points: result.entitlement,
            matched: true,
          },
        ],
      };
    }

    if (contentType === "poster" || contentType === "video") {
      const points = computeFlatSectionScore(contentType, policy);
      return {
        autoScore: points,
        rawScore: points,
        breakdown: [
          {
            ruleId: `policy.${contentType}`,
            field: "flat",
            points,
            matched: true,
          },
        ],
      };
    }

    if (contentType === "social_post" || contentType === "site_publication") {
      if (policy.socialAudienceRanges.length > 0) {
        const audience =
          toNumber(item.audienceCount) ??
          toNumber(item.views) ??
          toNumber(item.followers) ??
          null;
        const points = computeSocialAudienceScore(audience, policy);
        return {
          autoScore: points,
          rawScore: points,
          breakdown: [
            {
              ruleId: "policy.socialAudience",
              field: "audienceCount",
              points,
              matched: points > 0,
            },
          ],
        };
      }
    }
  }

  return computeFromFieldRules(contentType, item, rules);
}

export function sumFinalScore(
  autoScore: number | null | undefined,
  manualScore: number | null | undefined
): number {
  const auto = typeof autoScore === "number" && Number.isFinite(autoScore) ? autoScore : 0;
  const manual =
    typeof manualScore === "number" && Number.isFinite(manualScore) ? manualScore : 0;
  return auto + manual;
}
