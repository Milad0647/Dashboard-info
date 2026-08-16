import type {
  CampaignScoringConfig,
  CampaignScoringRules,
  CategoryScoringConfig,
  ScoreableContentType,
  ScoringRule,
  ScoringRuleKind,
} from "@/lib/types";

export const SCOREABLE_TYPES: ScoreableContentType[] = [
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

function normalizeRuleList(raw: unknown): ScoringRule[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeRule).filter((r): r is ScoringRule => r !== null);
}

function normalizeCategoryConfig(raw: unknown): CategoryScoringConfig {
  if (Array.isArray(raw)) {
    return { basePoints: 0, rules: normalizeRuleList(raw) };
  }
  if (!raw || typeof raw !== "object") {
    return { basePoints: 0, rules: [] };
  }
  const obj = raw as Record<string, unknown>;
  const baseRaw = Number(obj.basePoints);
  const basePoints = Number.isFinite(baseRaw) && baseRaw >= 0 ? baseRaw : 0;
  const rules = normalizeRuleList(obj.rules);
  return { basePoints, rules };
}

function emptyConfig(): CampaignScoringConfig {
  return { version: 2, general: [], byType: {} };
}

/** Migrate legacy v1 map { billboard: ScoringRule[] } into v2 config. */
function migrateV1Rules(source: Record<string, unknown>): CampaignScoringConfig {
  const byType: CampaignScoringConfig["byType"] = {};
  for (const type of SCOREABLE_TYPES) {
    const list = source[type];
    if (!Array.isArray(list)) continue;
    const rules = normalizeRuleList(list);
    if (rules.length > 0) {
      byType[type] = { basePoints: 0, rules };
    }
  }
  return { version: 2, general: [], byType };
}

/**
 * Normalize scoring_rules JSON from DB / client into CampaignScoringConfig (v2).
 * Accepts legacy v1 per-type rule arrays.
 */
export function normalizeScoringRules(raw: unknown): CampaignScoringConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return emptyConfig();
  const source = raw as Record<string, unknown>;

  if (source.version === 2 || source.byType != null || source.general != null) {
    const general = normalizeRuleList(source.general);
    const byTypeRaw =
      source.byType && typeof source.byType === "object" && !Array.isArray(source.byType)
        ? (source.byType as Record<string, unknown>)
        : source;
    const byType: CampaignScoringConfig["byType"] = {};
    for (const type of SCOREABLE_TYPES) {
      if (byTypeRaw[type] == null) continue;
      const cat = normalizeCategoryConfig(byTypeRaw[type]);
      if (cat.basePoints > 0 || cat.rules.length > 0) {
        byType[type] = cat;
      }
    }
    // If version flag missing but top-level still has v1 arrays, merge them
    if (Object.keys(byType).length === 0 && source.version !== 2) {
      const migrated = migrateV1Rules(source);
      return { version: 2, general, byType: migrated.byType };
    }
    return { version: 2, general, byType };
  }

  return migrateV1Rules(source);
}

/** @deprecated Use getCategoryConfig / getGeneralRules */
export function getRulesForContentType(
  scoringRules: CampaignScoringConfig | CampaignScoringRules | null | undefined,
  contentType: ScoreableContentType
): ScoringRule[] {
  const config = normalizeScoringRules(scoringRules ?? {});
  return config.byType[contentType]?.rules ?? [];
}

export function getCategoryConfig(
  scoringRules: CampaignScoringConfig | null | undefined,
  contentType: ScoreableContentType
): CategoryScoringConfig {
  const config = normalizeScoringRules(scoringRules ?? {});
  return config.byType[contentType] ?? { basePoints: 0, rules: [] };
}

export function getGeneralRules(
  scoringRules: CampaignScoringConfig | null | undefined
): ScoringRule[] {
  return normalizeScoringRules(scoringRules ?? {}).general;
}

export function emptyScoringConfig(): CampaignScoringConfig {
  return emptyConfig();
}
