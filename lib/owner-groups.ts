import { getOwnableUploadDate, sortCampaignContent } from "@/lib/campaign-content-filter";
import type { CampaignContentSort } from "@/lib/owner-location-filter";
import type { DataOwnerGroup, Ownable } from "@/lib/types";

const ADMIN_KEY = "admin";

export const DEFAULT_ADMIN_OWNER_LABEL = "توانیر";

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
      ownerCompanyType: ownerUserId ? (item.ownerCompanyType ?? null) : null,
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

export function groupByOwnerPreservingOrder<T extends Ownable>(
  items: T[],
  adminLabel: string = DEFAULT_ADMIN_OWNER_LABEL
): DataOwnerGroup<T>[] {
  const resolvedAdminLabel = resolveAdminOwnerLabel(adminLabel);
  const groups = new Map<string, DataOwnerGroup<T>>();
  const order: string[] = [];

  for (const item of items) {
    const ownerUserId = item.ownerUserId ?? null;
    const key = ownerUserId ?? ADMIN_KEY;
    const ownerLabel = ownerUserId ? (item.ownerName?.trim() || "کاربر") : resolvedAdminLabel;

    const existing = groups.get(key);
    if (existing) {
      existing.items.push(item);
      continue;
    }

    order.push(key);
    groups.set(key, {
      ownerKey: key,
      ownerLabel,
      ownerUserId,
      ownerProvince: ownerUserId ? (item.ownerProvince ?? null) : null,
      ownerCity: ownerUserId ? (item.ownerCity ?? null) : null,
      ownerCompanyType: ownerUserId ? (item.ownerCompanyType ?? null) : null,
      items: [item],
    });
  }

  return order.map((key) => groups.get(key)!);
}

export function sortOwnerGroupsByItemDate<T extends Ownable>(
  groups: DataOwnerGroup<T>[],
  sort: CampaignContentSort
): DataOwnerGroup<T>[] {
  if (sort === "default") return groups;

  return [...groups].sort((a, b) => {
    const dateA = a.items[0]
      ? getOwnableUploadDate(a.items[0] as T & Record<string, unknown>)
      : "";
    const dateB = b.items[0]
      ? getOwnableUploadDate(b.items[0] as T & Record<string, unknown>)
      : "";
    return sort === "newest" ? dateB.localeCompare(dateA) : dateA.localeCompare(dateB);
  });
}

export function isGlobalContentSortActive(sort: CampaignContentSort): boolean {
  return sort === "newest" || sort === "oldest" || sort === "top_scored";
}

/** Newest / oldest / top-scored should render as a flat upload-time stream. */
export function shouldRenderChronologically(sort: string): boolean {
  return sort === "newest" || sort === "oldest" || sort === "top_scored";
}

export function flattenOwnerGroupsInSortOrder<T extends Ownable>(
  groups: DataOwnerGroup<T>[],
  sort: CampaignContentSort
): T[] {
  const flat = groups.flatMap((group) => group.items);

  return sortCampaignContent(
    flat,
    sort,
    (item) => getOwnableUploadDate(item as T & Record<string, unknown>),
    (item) => ("sortOrder" in item ? Number(item.sortOrder) : 0) || 0
  );
}
