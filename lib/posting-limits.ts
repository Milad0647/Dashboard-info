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
}

export const POSTING_LIMIT_REGION_KEYS: UserRegion[] = [...USER_REGIONS];
export const POSTING_LIMIT_COMPANY_TYPE_KEYS: UserCompanyType[] = [...USER_COMPANY_TYPES];

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

function normalizeCategoryLimit(raw: unknown): CategoryDailyLimit {
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
  };
}

export function resolveDailyPostingMax(input: {
  config: DailyPostingLimitsConfig;
  region?: UserRegion | null;
  companyType?: UserCompanyType | null;
}): number | null {
  const { config, region, companyType } = input;
  if (!config.enabled) return null;

  const limits: number[] = [];
  if (region) {
    const row = config.byCategory[region];
    if (row?.enabled && row.dailyMax > 0) limits.push(row.dailyMax);
  }
  if (companyType) {
    const row = config.byCategory[companyType];
    if (row?.enabled && row.dailyMax > 0) limits.push(row.dailyMax);
  }

  if (limits.length > 0) return Math.min(...limits);

  if (!region && !companyType) {
    const uncategorized = config.byCategory[UNCATEGORIZED_POSTING_LIMIT_KEY];
    if (uncategorized?.enabled && uncategorized.dailyMax > 0) {
      return uncategorized.dailyMax;
    }
  }

  return null;
}

export function dailyPostingLimitMessage(dailyMax: number): string {
  return `سقف مجاز بارگذاری روزانه برای دسته شما تکمیل شده است. امروز حداکثر ${dailyMax} محتوا می‌توانید ثبت کنید.`;
}
