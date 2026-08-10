import { BILLBOARD_CATEGORIES, billboardCategoryLabels } from "@/lib/billboard-categories";
import { decodePlanLabel } from "@/lib/content-topics";
import { generateId } from "@/lib/utils";

/** Named coefficient row (topic, media type, location, …). */
export interface ScoringCoeffRow {
  id: string;
  key: string;
  label: string;
  coefficient: number;
}

/** Area range → coefficient (inclusive bounds in m²). */
export interface ScoringAreaRange {
  id: string;
  label: string;
  min: number | null;
  max: number | null;
  coefficient: number;
}

/** Fixed points + daily cap for a content section. */
export interface ScoringSectionFlat {
  pointsPerItem: number;
  dailyMaxItems: number;
}

/** Audience range for social publish/repost (filled later). */
export interface ScoringAudienceRange {
  id: string;
  label: string;
  minAudience: number | null;
  maxAudience: number | null;
  points: number;
}

/** Fixed points for media republication (IRIB / press) by coverage scope. */
export interface ScoringMediaRepublishRow {
  id: string;
  /** Stable key used on content forms (e.g. national, local). */
  key: string;
  label: string;
  points: number;
}

export const MEDIA_REPUBLISH_SCOPE_OPTIONS = [
  { key: "national", label: "سراسری" },
  { key: "local", label: "محلی" },
] as const;

export type MediaRepublishScope = (typeof MEDIA_REPUBLISH_SCOPE_OPTIONS)[number]["key"];

/** Per-company multipliers (phase coverage / entitlement). */
export interface ScoringCompanyCoeff {
  id: string;
  /** users.id when known; otherwise match by company/user display name. */
  userId?: string | null;
  label: string;
  coefficient: number;
}

export type ScoringSectionKey = "billboard" | "poster" | "video" | "social" | "broadcast";

/**
 * Campaign-level scoring policy — editable from /admin/scoring, never hardcoded in UI logic.
 * Stored as campaign_settings.scoring_policy JSONB.
 */
export interface CampaignScoringPolicy {
  version: 1;
  enabled: boolean;
  /** Topic key (plan label / topic name) → coefficient. Unlisted topics use defaultTopicCoefficient. */
  topicCoefficients: ScoringCoeffRow[];
  defaultTopicCoefficient: number;
  /** true/false keys for approved design usage. */
  approvedDesignCoefficients: ScoringCoeffRow[];
  /** Billboard structure category → media value coefficient. */
  mediaValueCoefficients: ScoringCoeffRow[];
  defaultMediaValueCoefficient: number;
  /** Location type (بزرگراه، بلوار، …). */
  locationCoefficients: ScoringCoeffRow[];
  defaultLocationCoefficient: number;
  areaRanges: ScoringAreaRange[];
  defaultAreaCoefficient: number;
  poster: ScoringSectionFlat;
  video: ScoringSectionFlat;
  /** Social publish/repost by audience — empty until table is provided. */
  socialAudienceRanges: ScoringAudienceRange[];
  /** IRIB / press republication points by coverage scope (national / local / custom). */
  mediaRepublishRows: ScoringMediaRepublishRow[];
  /**
   * Phase coverage points per company; added into the billboard sum when section is in phaseAppliesTo.
   */
  phaseCoefficients: ScoringCompanyCoeff[];
  defaultPhaseCoefficient: number;
  phaseAppliesTo: ScoringSectionKey[];
  /** Entitlement multiplier; applied only to sections in entitlementAppliesTo. */
  entitlementCoefficients: ScoringCompanyCoeff[];
  defaultEntitlementCoefficient: number;
  entitlementAppliesTo: ScoringSectionKey[];
}

export const DEFAULT_LOCATION_TYPES: Array<{ key: string; label: string; coefficient: number }> = [
  { key: "highway", label: "بزرگراه", coefficient: 10 },
  { key: "boulevard", label: "بلوار", coefficient: 6 },
  { key: "main_street", label: "خیابان اصلی", coefficient: 5 },
  { key: "square", label: "میدان", coefficient: 5 },
  { key: "metro", label: "مترو", coefficient: 7 },
  { key: "bus_station", label: "ایستگاه اتوبوس", coefficient: 4 },
  { key: "other", label: "سایر", coefficient: 1 },
];

export function createDefaultScoringPolicy(): CampaignScoringPolicy {
  return {
    version: 1,
    enabled: true,
    topicCoefficients: [
      {
        id: generateId(),
        key: "قرار همدلی",
        label: "کمپین ۲۵ درجه، قرار همدلی",
        coefficient: 2,
      },
      {
        id: generateId(),
        key: "25 درجه قرار همدلی",
        label: "۲۵ درجه قرار همدلی",
        coefficient: 2,
      },
    ],
    defaultTopicCoefficient: 1,
    approvedDesignCoefficients: [
      { id: generateId(), key: "true", label: "استفاده از طرح مصوب", coefficient: 3 },
      { id: generateId(), key: "false", label: "بدون طرح مصوب", coefficient: 1 },
    ],
    mediaValueCoefficients: BILLBOARD_CATEGORIES.map((key) => ({
      id: generateId(),
      key,
      label: billboardCategoryLabels[key],
      coefficient: key === "billboard" ? 10 : key === "straboard" ? 7 : key === "lightbox" ? 5 : 3,
    })),
    defaultMediaValueCoefficient: 1,
    locationCoefficients: DEFAULT_LOCATION_TYPES.map((row) => ({
      id: generateId(),
      ...row,
    })),
    defaultLocationCoefficient: 1,
    areaRanges: [
      {
        id: generateId(),
        label: "کمتر از ۱۲ متر",
        min: null,
        max: 11.999,
        coefficient: 2,
      },
      {
        id: generateId(),
        label: "۱۲ تا ۲۴ متر",
        min: 12,
        max: 24,
        coefficient: 4,
      },
      {
        id: generateId(),
        label: "بیش از ۲۴ تا ۴۸ متر",
        min: 24.001,
        max: 48,
        coefficient: 6,
      },
      {
        id: generateId(),
        label: "بیش از ۴۸ متر",
        min: 48.001,
        max: null,
        coefficient: 8,
      },
    ],
    defaultAreaCoefficient: 1,
    poster: { pointsPerItem: 2, dailyMaxItems: 5 },
    video: { pointsPerItem: 5, dailyMaxItems: 5 },
    socialAudienceRanges: [],
    mediaRepublishRows: [
      {
        id: generateId(),
        key: "national",
        label: "پخش خبر و محتوا در روزنامه‌ها و صداوسیمای سراسری",
        points: 15,
      },
      {
        id: generateId(),
        key: "local",
        label: "پخش خبر و محتوا در روزنامه‌ها و صداوسیمای محلی",
        points: 10,
      },
    ],
    phaseCoefficients: [],
    defaultPhaseCoefficient: 0,
    phaseAppliesTo: ["billboard"],
    entitlementCoefficients: [],
    defaultEntitlementCoefficient: 1,
    entitlementAppliesTo: ["billboard"],
  };
}

function asFiniteNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeCoeffRows(raw: unknown): ScoringCoeffRow[] {
  if (!Array.isArray(raw)) return [];
  const rows: ScoringCoeffRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const key = typeof obj.key === "string" ? obj.key.trim() : "";
    const label = typeof obj.label === "string" ? obj.label.trim() : key;
    if (!key) continue;
    rows.push({
      id: typeof obj.id === "string" && obj.id.trim() ? obj.id.trim() : generateId(),
      key,
      label: label || key,
      coefficient: Math.max(0, asFiniteNumber(obj.coefficient, 0)),
    });
  }
  return rows;
}

function normalizeAreaRanges(raw: unknown): ScoringAreaRange[] {
  if (!Array.isArray(raw)) return [];
  const rows: ScoringAreaRange[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const label = typeof obj.label === "string" ? obj.label.trim() : "";
    rows.push({
      id: typeof obj.id === "string" && obj.id.trim() ? obj.id.trim() : generateId(),
      label: label || "بازه متراژ",
      min:
        obj.min === null || obj.min === undefined || obj.min === ""
          ? null
          : asFiniteNumber(obj.min, 0),
      max:
        obj.max === null || obj.max === undefined || obj.max === ""
          ? null
          : asFiniteNumber(obj.max, 0),
      coefficient: Math.max(0, asFiniteNumber(obj.coefficient, 0)),
    });
  }
  return rows;
}

function normalizeAudienceRanges(raw: unknown): ScoringAudienceRange[] {
  if (!Array.isArray(raw)) return [];
  const rows: ScoringAudienceRange[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const label = typeof obj.label === "string" ? obj.label.trim() : "";
    rows.push({
      id: typeof obj.id === "string" && obj.id.trim() ? obj.id.trim() : generateId(),
      label: label || "بازه مخاطب",
      minAudience:
        obj.minAudience === null || obj.minAudience === undefined || obj.minAudience === ""
          ? null
          : asFiniteNumber(obj.minAudience, 0),
      maxAudience:
        obj.maxAudience === null || obj.maxAudience === undefined || obj.maxAudience === ""
          ? null
          : asFiniteNumber(obj.maxAudience, 0),
      points: Math.max(0, asFiniteNumber(obj.points, 0)),
    });
  }
  return rows;
}

function normalizeMediaRepublishRows(raw: unknown): ScoringMediaRepublishRow[] {
  if (!Array.isArray(raw)) return [];
  const rows: ScoringMediaRepublishRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const key = typeof obj.key === "string" ? obj.key.trim() : "";
    const label = typeof obj.label === "string" ? obj.label.trim() : key;
    if (!key && !label) continue;
    rows.push({
      id: typeof obj.id === "string" && obj.id.trim() ? obj.id.trim() : generateId(),
      key: key || label,
      label: label || key,
      points: Math.max(0, asFiniteNumber(obj.points, 0)),
    });
  }
  return rows;
}

function normalizeCompanyCoeffs(raw: unknown): ScoringCompanyCoeff[] {
  if (!Array.isArray(raw)) return [];
  const rows: ScoringCompanyCoeff[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const label = typeof obj.label === "string" ? obj.label.trim() : "";
    if (!label && !(typeof obj.userId === "string" && obj.userId.trim())) continue;
    rows.push({
      id: typeof obj.id === "string" && obj.id.trim() ? obj.id.trim() : generateId(),
      userId: typeof obj.userId === "string" && obj.userId.trim() ? obj.userId.trim() : null,
      label: label || "شرکت",
      coefficient: Math.max(0, asFiniteNumber(obj.coefficient, 1)),
    });
  }
  return rows;
}

function normalizeSectionKeys(raw: unknown, fallback: ScoringSectionKey[]): ScoringSectionKey[] {
  const allowed: ScoringSectionKey[] = ["billboard", "poster", "video", "social", "broadcast"];
  if (!Array.isArray(raw)) return [...fallback];
  const next = raw.filter((v): v is ScoringSectionKey =>
    allowed.includes(v as ScoringSectionKey)
  );
  return next.length > 0 ? [...new Set(next)] : [...fallback];
}

function normalizeFlatSection(raw: unknown, fallback: ScoringSectionFlat): ScoringSectionFlat {
  if (!raw || typeof raw !== "object") return { ...fallback };
  const obj = raw as Record<string, unknown>;
  return {
    pointsPerItem: Math.max(0, asFiniteNumber(obj.pointsPerItem, fallback.pointsPerItem)),
    dailyMaxItems: Math.max(0, Math.floor(asFiniteNumber(obj.dailyMaxItems, fallback.dailyMaxItems))),
  };
}

/** Normalize scoring_policy JSON from DB / client. */
export function normalizeScoringPolicy(raw: unknown): CampaignScoringPolicy {
  const defaults = createDefaultScoringPolicy();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return defaults;
  const source = raw as Record<string, unknown>;

  const topicCoefficients = normalizeCoeffRows(source.topicCoefficients);
  const approvedDesignCoefficients = normalizeCoeffRows(source.approvedDesignCoefficients);
  const mediaValueCoefficients = normalizeCoeffRows(source.mediaValueCoefficients);
  const locationCoefficients = normalizeCoeffRows(source.locationCoefficients);
  const areaRanges = normalizeAreaRanges(source.areaRanges);

  return {
    version: 1,
    enabled: source.enabled !== false,
    topicCoefficients:
      topicCoefficients.length > 0 ? topicCoefficients : defaults.topicCoefficients,
    defaultTopicCoefficient: Math.max(
      0,
      asFiniteNumber(source.defaultTopicCoefficient, defaults.defaultTopicCoefficient)
    ),
    approvedDesignCoefficients:
      approvedDesignCoefficients.length > 0
        ? approvedDesignCoefficients
        : defaults.approvedDesignCoefficients,
    mediaValueCoefficients:
      mediaValueCoefficients.length > 0
        ? mediaValueCoefficients
        : defaults.mediaValueCoefficients,
    defaultMediaValueCoefficient: Math.max(
      0,
      asFiniteNumber(source.defaultMediaValueCoefficient, defaults.defaultMediaValueCoefficient)
    ),
    locationCoefficients:
      locationCoefficients.length > 0 ? locationCoefficients : defaults.locationCoefficients,
    defaultLocationCoefficient: Math.max(
      0,
      asFiniteNumber(source.defaultLocationCoefficient, defaults.defaultLocationCoefficient)
    ),
    areaRanges: areaRanges.length > 0 ? areaRanges : defaults.areaRanges,
    defaultAreaCoefficient: Math.max(
      0,
      asFiniteNumber(source.defaultAreaCoefficient, defaults.defaultAreaCoefficient)
    ),
    poster: normalizeFlatSection(source.poster, defaults.poster),
    video: normalizeFlatSection(source.video, defaults.video),
    socialAudienceRanges: normalizeAudienceRanges(source.socialAudienceRanges),
    mediaRepublishRows:
      !("mediaRepublishRows" in source)
        ? defaults.mediaRepublishRows
        : normalizeMediaRepublishRows(source.mediaRepublishRows),
    phaseCoefficients: normalizeCompanyCoeffs(source.phaseCoefficients),
    defaultPhaseCoefficient: Math.max(
      0,
      asFiniteNumber(source.defaultPhaseCoefficient, defaults.defaultPhaseCoefficient)
    ),
    phaseAppliesTo: normalizeSectionKeys(source.phaseAppliesTo, defaults.phaseAppliesTo),
    entitlementCoefficients: normalizeCompanyCoeffs(source.entitlementCoefficients),
    defaultEntitlementCoefficient: Math.max(
      0,
      asFiniteNumber(source.defaultEntitlementCoefficient, defaults.defaultEntitlementCoefficient)
    ),
    entitlementAppliesTo: normalizeSectionKeys(
      source.entitlementAppliesTo,
      defaults.entitlementAppliesTo
    ),
  };
}

function normalizeMatchKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\u200c\s]+/g, " ")
    .replace(/[،,.;:_\-–—/\\|()[\]{}'"`]/g, "")
    .trim();
}

function findCoeff(
  rows: ScoringCoeffRow[],
  candidates: string[],
  fallback: number
): { coefficient: number; matchedKey: string | null } {
  const normalizedRows = rows.map((row) => ({
    row,
    key: normalizeMatchKey(row.key),
    label: normalizeMatchKey(row.label),
  }));
  for (const candidate of candidates) {
    const needle = normalizeMatchKey(candidate);
    if (!needle) continue;
    const hit = normalizedRows.find(
      (entry) =>
        entry.key === needle ||
        entry.label === needle ||
        (entry.key.length > 2 && (entry.key.includes(needle) || needle.includes(entry.key)))
    );
    if (hit) return { coefficient: hit.row.coefficient, matchedKey: hit.row.key };
  }
  return { coefficient: fallback, matchedKey: null };
}

function findAreaCoeff(
  ranges: ScoringAreaRange[],
  areaSqm: number | null | undefined,
  fallback: number
): { coefficient: number; matchedLabel: string | null } {
  if (areaSqm == null || !Number.isFinite(areaSqm)) {
    return { coefficient: fallback, matchedLabel: null };
  }
  for (const range of ranges) {
    const minOk = range.min == null || areaSqm >= range.min;
    const maxOk = range.max == null || areaSqm <= range.max;
    if (minOk && maxOk) {
      return { coefficient: range.coefficient, matchedLabel: range.label };
    }
  }
  return { coefficient: fallback, matchedLabel: null };
}

export function findCompanyCoeff(
  rows: ScoringCompanyCoeff[],
  ownerUserId: string | null | undefined,
  ownerName: string | null | undefined,
  fallback: number
): number {
  if (ownerUserId) {
    const byId = rows.find((row) => row.userId && row.userId === ownerUserId);
    if (byId) return byId.coefficient;
  }
  if (ownerName?.trim()) {
    const needle = normalizeMatchKey(ownerName);
    const byName = rows.find((row) => normalizeMatchKey(row.label) === needle);
    if (byName) return byName.coefficient;
  }
  return fallback;
}

function topicCandidatesFromItem(item: Record<string, unknown>): string[] {
  const out: string[] = [];
  const planLabels = item.planLabels;
  if (Array.isArray(planLabels)) {
    for (const entry of planLabels) {
      const raw = String(entry ?? "").trim();
      if (!raw) continue;
      out.push(raw);
      const decoded = decodePlanLabel(raw);
      if (decoded.topic) out.push(decoded.topic);
    }
  }
  const planLabel = typeof item.planLabel === "string" ? item.planLabel.trim() : "";
  if (planLabel) {
    out.push(planLabel);
    const decoded = decodePlanLabel(planLabel);
    if (decoded.topic) out.push(decoded.topic);
  }
  return out;
}

export interface BillboardScoreBreakdown {
  topic: number;
  approvedDesign: number;
  mediaValue: number;
  location: number;
  area: number;
  raw: number;
  phase: number;
  entitlement: number;
  final: number;
  matched: {
    topicKey: string | null;
    approvedDesignKey: string | null;
    mediaKey: string | null;
    locationKey: string | null;
    areaLabel: string | null;
  };
}

export function computeBillboardPolicyScore(
  item: Record<string, unknown>,
  policy: CampaignScoringPolicy
): BillboardScoreBreakdown {
  const topicHit = findCoeff(
    policy.topicCoefficients,
    topicCandidatesFromItem(item),
    policy.defaultTopicCoefficient
  );

  const usesApproved =
    item.usesApprovedDesign === true ||
    item.usesApprovedDesign === "true" ||
    item.usesApprovedDesign === 1;
  const approvedHit = findCoeff(
    policy.approvedDesignCoefficients,
    [usesApproved ? "true" : "false"],
    usesApproved ? 3 : 1
  );

  const category = typeof item.category === "string" ? item.category : "";
  const billboardTypeLabel =
    typeof item.billboardTypeLabel === "string" ? item.billboardTypeLabel : "";
  const mediaHit = findCoeff(
    policy.mediaValueCoefficients,
    [category, billboardTypeLabel].filter(Boolean),
    policy.defaultMediaValueCoefficient
  );

  const locationType = typeof item.locationType === "string" ? item.locationType : "";
  const locationLabel =
    typeof item.locationTypeLabel === "string" ? item.locationTypeLabel : "";
  const locationHit = findCoeff(
    policy.locationCoefficients,
    [locationType, locationLabel].filter(Boolean),
    policy.defaultLocationCoefficient
  );

  const areaSqm =
    typeof item.areaSqm === "number"
      ? item.areaSqm
      : typeof item.areaSqm === "string"
        ? Number(item.areaSqm)
        : null;
  const areaHit = findAreaCoeff(policy.areaRanges, areaSqm, policy.defaultAreaCoefficient);

  /** Additive base (topic + design + media + location + area). */
  const raw =
    topicHit.coefficient +
    approvedHit.coefficient +
    mediaHit.coefficient +
    locationHit.coefficient +
    areaHit.coefficient;

  const ownerUserId = typeof item.ownerUserId === "string" ? item.ownerUserId : null;
  const ownerName = typeof item.ownerName === "string" ? item.ownerName : null;

  const phaseApplies = policy.phaseAppliesTo.includes("billboard");
  const phase = phaseApplies
    ? findCompanyCoeff(
        policy.phaseCoefficients,
        ownerUserId,
        ownerName,
        policy.defaultPhaseCoefficient
      )
    : 1;

  const entitlement = policy.entitlementAppliesTo.includes("billboard")
    ? findCompanyCoeff(
        policy.entitlementCoefficients,
        ownerUserId,
        ownerName,
        policy.defaultEntitlementCoefficient
      )
    : 1;

  /** Only entitlement multiplies; phase (when applied) is added to the base sum. */
  const final = (raw + (phaseApplies ? phase : 0)) * entitlement;

  return {
    topic: topicHit.coefficient,
    approvedDesign: approvedHit.coefficient,
    mediaValue: mediaHit.coefficient,
    location: locationHit.coefficient,
    area: areaHit.coefficient,
    raw,
    phase,
    entitlement,
    final,
    matched: {
      topicKey: topicHit.matchedKey,
      approvedDesignKey: approvedHit.matchedKey,
      mediaKey: mediaHit.matchedKey,
      locationKey: locationHit.matchedKey,
      areaLabel: areaHit.matchedLabel,
    },
  };
}

export function computeFlatSectionScore(
  section: "poster" | "video",
  policy: CampaignScoringPolicy
): number {
  return section === "poster" ? policy.poster.pointsPerItem : policy.video.pointsPerItem;
}

export function computeSocialAudienceScore(
  audienceCount: number | null | undefined,
  policy: CampaignScoringPolicy
): number {
  if (policy.socialAudienceRanges.length === 0) return 0;
  if (audienceCount == null || !Number.isFinite(audienceCount)) return 0;
  for (const range of policy.socialAudienceRanges) {
    const minOk = range.minAudience == null || audienceCount >= range.minAudience;
    const maxOk = range.maxAudience == null || audienceCount <= range.maxAudience;
    if (minOk && maxOk) return range.points;
  }
  return 0;
}

export function computeMediaRepublishScore(
  mediaScope: string | null | undefined,
  policy: CampaignScoringPolicy
): number {
  if (policy.mediaRepublishRows.length === 0) return 0;
  const raw = typeof mediaScope === "string" ? mediaScope.trim() : "";
  if (!raw) return 0;
  const needle = normalizeMatchKey(raw);
  for (const row of policy.mediaRepublishRows) {
    if (
      normalizeMatchKey(row.key) === needle ||
      normalizeMatchKey(row.label) === needle
    ) {
      return row.points;
    }
  }
  return 0;
}

export const DAILY_CAP_MESSAGE =
  "سقف مجاز ثبت روزانه این بخش برای شرکت شما تکمیل شده است.";

export function normalizeTitleForDuplicate(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[\u200c\s]+/g, "")
    .replace(/[،,.;:_\-–—/\\|()[\]{}'"`؟!?]+/g, "");
}
