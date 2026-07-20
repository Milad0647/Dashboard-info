import type {
  ScoreBreakdownEntry,
  ScoreableContentType,
  ScoringRule,
} from "@/lib/types";
import { getScoreableField } from "@/lib/scoring/scoreable-fields";

export interface ComputeContentScoreResult {
  autoScore: number;
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
  // Prefer YYYY-MM-DD prefix for ISO / date columns
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
      return normalizeComparable(value) === normalizeComparable(rule.value ?? "");
    }
    case "range":
      return matchRange(value, rule, valueType);
    default:
      return false;
  }
}

/**
 * Compute automatic score from campaign rules for one content item.
 * All matching rules add points (including multiple ranges on the same field).
 */
export function computeContentScore(
  contentType: ScoreableContentType,
  item: Record<string, unknown>,
  rules: ScoringRule[]
): ComputeContentScoreResult {
  if (!rules.length) {
    return { autoScore: 0, breakdown: [] };
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

  return { autoScore, breakdown };
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
