import { IRAN_PROVINCES, normalizeImportedProvince } from "@/lib/iran-locations";
import type { ScoreableContentType } from "@/lib/types";
import { USER_COMPANY_TYPES, userCompanyTypeLabels, type UserCompanyType } from "@/lib/user-company-types";
import { USER_REGIONS, userRegionLabels, type UserRegion } from "@/lib/user-regions";

export const UNCATEGORIZED_POSTING_LIMIT_KEY = "uncategorized" as const;

export type PostingLimitCategoryKey =
  | UserRegion
  | UserCompanyType
  | typeof UNCATEGORIZED_POSTING_LIMIT_KEY;

export interface CategoryDailyLimit {
  enabled: boolean;
  /** Max content items per Tehran calendar day. 0 = unlimited. */
  dailyMax: number;
}

export interface DailyPostingLimitsConfig {
  version: 1;
  /** Master switch. When false, no category limits apply. */
  enabled: boolean;
  byCategory: Partial<Record<PostingLimitCategoryKey, CategoryDailyLimit>>;
  /** Province name → daily limit. */
  byProvince: Record<string, CategoryDailyLimit>;
  /** User/company id → daily limit. Overrides category limits when enabled. */
  byCompany: Record<string, CategoryDailyLimit>;
  /** Per content type (billboard, poster, …). Counted separately from the total cap. */
  byContentType: Partial<Record<ScoreableContentType, CategoryDailyLimit>>;
}

export const POSTING_LIMIT_REGION_KEYS: UserRegion[] = [...USER_REGIONS];
export const POSTING_LIMIT_COMPANY_TYPE_KEYS: UserCompanyType[] = [...USER_COMPANY_TYPES];
export const POSTING_LIMIT_PROVINCE_KEYS = [...IRAN_PROVINCES];
export const POSTING_LIMIT_CONTENT_TYPES: ScoreableContentType[] = [
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

export const POSTING_LIMIT_CONTENT_TYPE_LABELS: Record<ScoreableContentType, string> = {
  billboard: "تبلیغات محیطی",
  poster: "پوسترها",
  video: "ویدیوها",
  file: "فایل‌ها",
  raw_media: "راش تصویر",
  social_post: "پست شبکه اجتماعی",
  site_publication: "انتشار در سایت",
  activity: "اقدامات",
  broadcast: "پخش صدا و سیما",
  meeting: "جلسات و مصوبات",
};

export const ALL_POSTING_LIMIT_CATEGORY_KEYS: PostingLimitCategoryKey[] = [
  ...POSTING_LIMIT_REGION_KEYS,
  ...POSTING_LIMIT_COMPANY_TYPE_KEYS,
  UNCATEGORIZED_POSTING_LIMIT_KEY,
];

const DEFAULT_DAILY_MAX = 5;

export function createDefaultCategoryDailyLimit(): CategoryDailyLimit {
  return { enabled: false, dailyMax: DEFAULT_DAILY_MAX };
}

export function createDefaultDailyPostingLimits(): DailyPostingLimitsConfig {
  const byCategory: DailyPostingLimitsConfig["byCategory"] = {};
  for (const key of ALL_POSTING_LIMIT_CATEGORY_KEYS) {
    byCategory[key] = createDefaultCategoryDailyLimit();
  }
  return {
    version: 1,
    enabled: false,
    byCategory,
    byProvince: {},
    byCompany: {},
    byContentType: {},
  };
}

export function getPostingLimitCategoryLabel(key: PostingLimitCategoryKey): string {
  if (key === UNCATEGORIZED_POSTING_LIMIT_KEY) return "بدون دسته‌بندی";
  if (key in userRegionLabels) return userRegionLabels[key as UserRegion];
  if (key in userCompanyTypeLabels) return userCompanyTypeLabels[key as UserCompanyType];
  return key;
}

function asFiniteInt(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.floor(n));
}

export function normalizeCategoryLimit(raw: unknown): CategoryDailyLimit {
  const fallback = createDefaultCategoryDailyLimit();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fallback;
  const obj = raw as Record<string, unknown>;
  return {
    enabled: Boolean(obj.enabled),
    dailyMax: asFiniteInt(obj.dailyMax, fallback.dailyMax),
  };
}

function isCategoryKey(value: string): value is PostingLimitCategoryKey {
  return (ALL_POSTING_LIMIT_CATEGORY_KEYS as string[]).includes(value);
}

function normalizeLimitMap(raw: unknown): Record<string, CategoryDailyLimit> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const next: Record<string, CategoryDailyLimit> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const trimmed = key.trim();
    if (!trimmed) continue;
    next[trimmed] = normalizeCategoryLimit(value);
  }
  return next;
}

function normalizeContentTypeLimits(
  raw: unknown
): Partial<Record<ScoreableContentType, CategoryDailyLimit>> {
  const map = normalizeLimitMap(raw);
  const next: Partial<Record<ScoreableContentType, CategoryDailyLimit>> = {};
  for (const key of POSTING_LIMIT_CONTENT_TYPES) {
    if (map[key]) next[key] = map[key];
  }
  return next;
}

export function normalizeDailyPostingLimits(raw: unknown): DailyPostingLimitsConfig {
  const defaults = createDefaultDailyPostingLimits();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return defaults;
  const source = raw as Record<string, unknown>;
  const byCategory = { ...defaults.byCategory };
  const incoming =
    source.byCategory && typeof source.byCategory === "object" && !Array.isArray(source.byCategory)
      ? (source.byCategory as Record<string, unknown>)
      : {};

  for (const [key, value] of Object.entries(incoming)) {
    if (!isCategoryKey(key)) continue;
    byCategory[key] = normalizeCategoryLimit(value);
  }

  return {
    version: 1,
    enabled: Boolean(source.enabled),
    byCategory,
    byProvince: normalizeLimitMap(source.byProvince),
    byCompany: normalizeLimitMap(source.byCompany),
    byContentType: normalizeContentTypeLimits(source.byContentType),
  };
}

function enabledDailyMax(row: CategoryDailyLimit | undefined): number | null {
  if (!row?.enabled || row.dailyMax <= 0) return null;
  return row.dailyMax;
}

function lookupProvinceLimit(
  byProvince: Record<string, CategoryDailyLimit>,
  province?: string | null
): CategoryDailyLimit | undefined {
  const trimmed = province?.trim();
  if (!trimmed) return undefined;
  if (byProvince[trimmed]) return byProvince[trimmed];
  const normalized = normalizeImportedProvince(trimmed);
  if (normalized && byProvince[normalized]) return byProvince[normalized];
  return undefined;
}

export function resolveDailyPostingMax(input: {
  config: DailyPostingLimitsConfig;
  userId?: string | null;
  region?: UserRegion | null;
  companyType?: UserCompanyType | null;
  province?: string | null;
}): number | null {
  const { config, userId, region, companyType, province } = input;
  if (!config.enabled) return null;

  if (userId) {
    const companyMax = enabledDailyMax(config.byCompany[userId]);
    if (companyMax != null) return companyMax;
  }

  const limits: number[] = [];
  const regionMax = region ? enabledDailyMax(config.byCategory[region]) : null;
  if (regionMax != null) limits.push(regionMax);
  const typeMax = companyType ? enabledDailyMax(config.byCategory[companyType]) : null;
  if (typeMax != null) limits.push(typeMax);
  const provinceMax = enabledDailyMax(lookupProvinceLimit(config.byProvince, province));
  if (provinceMax != null) limits.push(provinceMax);

  if (limits.length > 0) return Math.min(...limits);

  const hasAnyCategory = Boolean(region || companyType || province?.trim());
  if (!hasAnyCategory) {
    const uncategorized = enabledDailyMax(config.byCategory[UNCATEGORIZED_POSTING_LIMIT_KEY]);
    if (uncategorized != null) return uncategorized;
  }

  return null;
}

export function resolveContentTypeDailyMax(
  config: DailyPostingLimitsConfig,
  contentType: ScoreableContentType
): number | null {
  if (!config.enabled) return null;
  return enabledDailyMax(config.byContentType[contentType]);
}

export function dailyPostingLimitMessage(dailyMax: number): string {
  return `سقف مجاز بارگذاری روزانه برای دسته شما تکمیل شده است. امروز حداکثر ${dailyMax} محتوا می‌توانید ثبت کنید.`;
}

export function dailyContentTypeLimitMessage(label: string, dailyMax: number): string {
  return `سقف مجاز بارگذاری روزانه برای «${label}» تکمیل شده است. امروز حداکثر ${dailyMax} مورد می‌توانید ثبت کنید.`;
}
