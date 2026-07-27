export const USER_COMPANY_TYPES = ["distribution", "regional_electricity"] as const;

export type UserCompanyType = (typeof USER_COMPANY_TYPES)[number];

export const userCompanyTypeLabels: Record<UserCompanyType, string> = {
  distribution: "شرکت توزیع",
  regional_electricity: "برق منطقه‌ای",
};

export function isUserCompanyType(value: unknown): value is UserCompanyType {
  return typeof value === "string" && (USER_COMPANY_TYPES as readonly string[]).includes(value);
}

export function normalizeUserCompanyType(value: unknown): UserCompanyType | null {
  if (!isUserCompanyType(value)) return null;
  return value;
}

export function getUserCompanyTypeLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return isUserCompanyType(value) ? userCompanyTypeLabels[value] : value;
}
