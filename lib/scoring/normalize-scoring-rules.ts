import type {
  CampaignScoringRules,
  ScoreableContentType,
  ScoringRule,
  ScoringRuleKind,
} from "@/lib/types";

const SCOREABLE_TYPES: ScoreableContentType[] = [
  "billboard",
  "poster",
  "video",
  "file",
  "raw_media",
  "social_post",
  "site_publication",
  "activity",
  "broadcast",
  "meeting",
];

const RULE_KINDS: ScoringRuleKind[] = ["filled", "equals", "range"];

function normalizeRule(raw: unknown): ScoringRule | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const id = typeof obj.id === "string" && obj.id.trim() ? obj.id.trim() : null;
  const field = typeof obj.field === "string" && obj.field.trim() ? obj.field.trim() : null;
  const kind = RULE_KINDS.includes(obj.kind as ScoringRuleKind)
    ? (obj.kind as ScoringRuleKind)
    : null;
  const points = Number(obj.points);
  if (!id || !field || !kind || !Number.isFinite(points) || points < 0) return null;

  const rule: ScoringRule = { id, field, kind, points };
  if (typeof obj.value === "string") rule.value = obj.value;
  if (obj.min !== undefined && obj.min !== null && obj.min !== "") {
    rule.min = typeof obj.min === "number" ? obj.min : String(obj.min);
  }
  if (obj.max !== undefined && obj.max !== null && obj.max !== "") {
    rule.max = typeof obj.max === "number" ? obj.max : String(obj.max);
  }
  return rule;
}

/** Normalize scoring_rules JSON from DB / client into a typed map. */
export function normalizeScoringRules(raw: unknown): CampaignScoringRules {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const source = raw as Record<string, unknown>;
  const result: CampaignScoringRules = {};

  for (const type of SCOREABLE_TYPES) {
    const list = source[type];
    if (!Array.isArray(list)) continue;
    const rules = list.map(normalizeRule).filter((r): r is ScoringRule => r !== null);
    if (rules.length > 0) result[type] = rules;
  }

  return result;
}

export function getRulesForContentType(
  scoringRules: CampaignScoringRules | null | undefined,
  contentType: ScoreableContentType
): ScoringRule[] {
  if (!scoringRules) return [];
  return scoringRules[contentType] ?? [];
}
