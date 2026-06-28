import type { DataOwnerGroup } from "@/lib/types";

interface OwnableItem {
  ownerUserId?: string | null;
  ownerName?: string | null;
}

const ADMIN_KEY = "admin";

export function groupByOwner<T extends OwnableItem>(
  items: T[],
  adminLabel = "مدیریت"
): DataOwnerGroup<T>[] {
  const groups = new Map<string, DataOwnerGroup<T>>();

  for (const item of items) {
    const ownerUserId = item.ownerUserId ?? null;
    const key = ownerUserId ?? ADMIN_KEY;
    const ownerLabel = ownerUserId ? (item.ownerName?.trim() || "کاربر") : adminLabel;

    const existing = groups.get(key);
    if (existing) {
      existing.items.push(item);
      continue;
    }

    groups.set(key, {
      ownerKey: key,
      ownerLabel,
      ownerUserId,
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

export function filterOwnerGroups<T extends OwnableItem>(
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
