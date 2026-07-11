export const USER_REGIONS = ["north", "south", "east", "west"] as const;

export type UserRegion = (typeof USER_REGIONS)[number];

export const userRegionLabels: Record<UserRegion, string> = {
  north: "شمال",
  south: "جنوب",
  east: "شرق",
  west: "غرب",
};

export function isUserRegion(value: unknown): value is UserRegion {
  return typeof value === "string" && (USER_REGIONS as readonly string[]).includes(value);
}

export function normalizeUserRegion(value: unknown): UserRegion | null {
  if (!isUserRegion(value)) return null;
  return value;
}

export function getUserRegionLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return isUserRegion(value) ? userRegionLabels[value] : value;
}
