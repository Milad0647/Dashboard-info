import { normalizePlanLabels } from "@/lib/content-topics";
import { normalizeImportedProvince } from "@/lib/iran-locations";
import type {
  CampaignScoringConfig,
  ScoreBreakdownEntry,
  ScoreableContentType,
  ScoringRule,
} from "@/lib/types";
import { getScoreableField } from "@/lib/scoring/scoreable-fields";
import {
  getCategoryConfig,
  getGeneralRules,
  normalizeScoringRules,
} from "@/lib/scoring/normalize-scoring-rules";
import { normalizeUserRegion } from "@/lib/user-regions";

export interface ComputeContentScoreResult {
  autoScore: number;
  /** Same as autoScore in v2 (no phase/entitlement pipeline). */
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

function ruleMatches(
  contentType: ScoreableContentType,
  item: Record<string, unknown>,
  rule: ScoringRule
): boolean {
  const fieldDef = getScoreableField(contentType, rule.field);
  const value = item[rule.field];
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

function firstNonEmptyString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

/** Normalize owner province/region so general scoring rules can match user data. */
function prepareScoreItem(item: Record<string, unknown>): Record<string, unknown> {
  const rawProvince = firstNonEmptyString(item.ownerProvince, item.province);
  const ownerProvince = rawProvince
    ? (normalizeImportedProvince(rawProvince) ?? rawProvince)
    : null;
  const ownerRegion = normalizeUserRegion(item.ownerRegion);
  const planLabels = normalizePlanLabels(
    Array.isArray(item.planLabels) ? (item.planLabels as string[]) : null,
    typeof item.planLabel === "string" ? item.planLabel : null
  );
  return { ...item, ownerProvince, ownerRegion, planLabels };
}

/** For these fields, multiple matching equals rules keep only the highest points. */
const BEST_OF_EQUALS_FIELDS = new Set(["planLabels"]);

function pickBestEqualsRuleId(
  contentType: ScoreableContentType,
  item: Record<string, unknown>,
  rules: ScoringRule[],
  field: string
): string | null {
  let bestId: string | null = null;
  let bestPoints = -1;
  for (const rule of rules) {
    if (rule.field !== field || rule.kind !== "equals") continue;
    if (!ruleMatches(contentType, item, rule)) continue;
    if (rule.points > bestPoints) {
      bestPoints = rule.points;
      bestId = rule.id;
    }
  }
  return bestId;
}

function applyRules(
  contentType: ScoreableContentType,
  item: Record<string, unknown>,
  rules: ScoringRule[],
  breakdown: ScoreBreakdownEntry[],
  labelPrefix?: string
): number {
  let total = 0;
  const matchedRangeFields = new Set<string>();
  const bestEqualsRuleByField = new Map<string, string | null>();

  for (const field of BEST_OF_EQUALS_FIELDS) {
    bestEqualsRuleByField.set(field, pickBestEqualsRuleId(contentType, item, rules, field));
  }

  for (const rule of rules) {
    let matched = ruleMatches(contentType, item, rule);
    if (matched && rule.kind === "range") {
      if (matchedRangeFields.has(rule.field)) {
        matched = false;
      } else {
        matchedRangeFields.add(rule.field);
      }
    }
    if (matched && rule.kind === "equals" && BEST_OF_EQUALS_FIELDS.has(rule.field)) {
      const bestId = bestEqualsRuleByField.get(rule.field);
      if (bestId !== rule.id) {
        matched = false;
      }
    }
    const points = matched ? rule.points : 0;
    if (matched) total += rule.points;
    breakdown.push({
      ruleId: rule.id,
      field: rule.field,
      points,
      matched,
      label: labelPrefix,
      kind: rule.kind,
    });
  }

  return total;
}

/**
 * Compute preview score: basePoints + general rules + type field rules.
 * Pure / client-safe (no I/O).
 */
export function computeContentScore(
  contentType: ScoreableContentType,
  item: Record<string, unknown>,
  configOrRules: CampaignScoringConfig | ScoringRule[] | null | undefined
): ComputeContentScoreResult {
  if (isRejectedOrDuplicate(item)) {
    return { autoScore: 0, rawScore: 0, breakdown: [] };
  }

  const prepared = prepareScoreItem(item);

  const config: CampaignScoringConfig = Array.isArray(configOrRules)
    ? {
        version: 2,
        general: [],
        byType: { [contentType]: { basePoints: 0, rules: configOrRules } },
      }
    : normalizeScoringRules(configOrRules ?? {});

  const category = getCategoryConfig(config, contentType);
  const general = getGeneralRules(config);
  const breakdown: ScoreBreakdownEntry[] = [];

  let autoScore = 0;
  if (category.basePoints > 0) {
    autoScore += category.basePoints;
    breakdown.push({
      ruleId: "base",
      field: "_base",
      points: category.basePoints,
      matched: true,
      label: "امتیاز پایه اثر",
      kind: "base",
    });
  }

  autoScore += applyRules(contentType, prepared, general, breakdown, "تنظیمات کلی");
  autoScore += applyRules(contentType, prepared, category.rules, breakdown, "فیلد دسته");

  return { autoScore, rawScore: autoScore, breakdown };
}

/** Official score from preview, rejection flag, and manual bonus. */
export function computeOfficialScore(input: {
  autoScore: number;
  manualScore?: number | null;
  everRejected?: boolean;
  /** When false, official score is 0 (pending review). */
  approved?: boolean;
  /** Non-reviewable types are always "approved" for scoring. */
  requiresApproval?: boolean;
}): number {
  const auto =
    typeof input.autoScore === "number" && Number.isFinite(input.autoScore)
      ? input.autoScore
      : 0;
  const manual =
    typeof input.manualScore === "number" && Number.isFinite(input.manualScore)
      ? input.manualScore
      : 0;
  const requiresApproval = input.requiresApproval !== false;
  if (requiresApproval && !input.approved) return 0;
  const factor = input.everRejected ? 0.5 : 1;
  return auto * factor + manual;
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
