import type { DataOwnerGroup, Ownable } from "@/lib/types";

const ADMIN_KEY = "admin";

export const DEFAULT_ADMIN_OWNER_LABEL = "مدیریت";

export function resolveAdminOwnerLabel(label?: string | null): string {
  const trimmed = label?.trim();
  return trimmed || DEFAULT_ADMIN_OWNER_LABEL;
}

export function groupByOwner<T extends Ownable>(
  items: T[],
  adminLabel: string = DEFAULT_ADMIN_OWNER_LABEL
): DataOwnerGroup<T>[] {
  const resolvedAdminLabel = resolveAdminOwnerLabel(adminLabel);
  const groups = new Map<string, DataOwnerGroup<T>>();

  for (const item of items) {
    const ownerUserId = item.ownerUserId ?? null;
    const key = ownerUserId ?? ADMIN_KEY;
    const ownerLabel = ownerUserId ? (item.ownerName?.trim() || "کاربر") : resolvedAdminLabel;

    const existing = groups.get(key);
    if (existing) {
      existing.items.push(item);
      continue;
    }

    groups.set(key, {
      ownerKey: key,
      ownerLabel,
      ownerUserId,
      ownerProvince: ownerUserId ? (item.ownerProvince ?? null) : null,
      ownerCity: ownerUserId ? (item.ownerCity ?? null) : null,
      items: [item],
    });
  }

  const ordered = Array.from(groups.values());
  ordered.sort((a, b) => {
    if (a.ownerUserId === null) return -1;
    if (b.ownerUserId === null) return 1;
    return a.ownerLabel.localeCompare(b.ownerLabel, "fa");
  });

  return ordered;
}

export function filterOwnerGroups<T extends Ownable>(
  groups: DataOwnerGroup<T>[],
  predicate: (item: T) => boolean
): DataOwnerGroup<T>[] {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter(predicate),
    }))
    .filter((group) => group.items.length > 0);
}

export function hasUserOwnedGroups<T>(groups: DataOwnerGroup<T>[]): boolean {
  return groups.some((group) => group.ownerUserId !== null);
}
