import type { DataOwnerGroup, Ownable } from "@/lib/types";
import { filterOwnerGroups } from "@/lib/owner-groups";
import { normalizeStoredUserEmail } from "@/lib/auth/user-login";

export const OWNER_LOCATION_ALL = "all";
export const OWNER_USER_ALL = "all";

export interface OwnerLocationFilter {
  province: string;
  city: string;
  userKey: string;
}

export const DEFAULT_OWNER_LOCATION_FILTER: OwnerLocationFilter = {
  province: OWNER_LOCATION_ALL,
  city: OWNER_LOCATION_ALL,
  userKey: OWNER_USER_ALL,
};

export function isOwnerLocationFilterActive(filter: OwnerLocationFilter): boolean {
  return filter.province !== OWNER_LOCATION_ALL;
}

export function isOwnerUserFilterActive(filter: OwnerLocationFilter): boolean {
  return filter.userKey !== OWNER_USER_ALL;
}

export function isOwnerFilterActive(filter: OwnerLocationFilter): boolean {
  return isOwnerLocationFilterActive(filter) || isOwnerUserFilterActive(filter);
}

function matchesOwnerUser(item: Ownable, filter: OwnerLocationFilter): boolean {
  if (filter.userKey === OWNER_USER_ALL) return true;
  if (!item.ownerUserId && !item.ownerEmail) return false;

  if (item.ownerUserId && item.ownerUserId === filter.userKey) return true;

  const itemEmail = item.ownerEmail?.trim().toLowerCase();
  const filterKey = filter.userKey.trim().toLowerCase();
  if (itemEmail && itemEmail === filterKey) return true;
  if (itemEmail && normalizeStoredUserEmail(itemEmail) === filterKey) return true;

  return false;
}

export function matchesOwnerLocation(
  item: Ownable,
  filter: OwnerLocationFilter
): boolean {
  if (!matchesOwnerUser(item, filter)) return false;

  if (filter.province === OWNER_LOCATION_ALL) return true;
  if (!item.ownerUserId && !item.ownerEmail) return false;
  if (item.ownerProvince !== filter.province) return false;
  if (filter.city === OWNER_LOCATION_ALL) return true;
  return item.ownerCity === filter.city;
}

export function filterOwnerGroupsByLocation<T extends Ownable>(
  groups: DataOwnerGroup<T>[],
  filter: OwnerLocationFilter
): DataOwnerGroup<T>[] {
  return filterOwnerGroups(groups, (item) => matchesOwnerLocation(item, filter));
}

export function filterItemsByOwnerLocation<T extends Ownable>(
  items: T[],
  filter: OwnerLocationFilter
): T[] {
  return items.filter((item) => matchesOwnerLocation(item, filter));
}

export function collectOwnerLocations(groups: DataOwnerGroup<Ownable>[]): {
  provinces: string[];
  citiesByProvince: Record<string, string[]>;
} {
  const provinceSet = new Set<string>();
  const citiesByProvince = new Map<string, Set<string>>();

  for (const group of groups) {
    if (!group.ownerUserId) continue;
    const province = group.ownerProvince?.trim();
    const city = group.ownerCity?.trim();
    if (!province) continue;

    provinceSet.add(province);
    if (!citiesByProvince.has(province)) {
      citiesByProvince.set(province, new Set());
    }
    if (city) {
      citiesByProvince.get(province)?.add(city);
    }
  }

  const provinces = [...provinceSet].sort((a, b) => a.localeCompare(b, "fa"));
  const citiesRecord: Record<string, string[]> = {};

  for (const province of provinces) {
    citiesRecord[province] = [...(citiesByProvince.get(province) ?? [])].sort((a, b) =>
      a.localeCompare(b, "fa")
    );
  }

  return { provinces, citiesByProvince: citiesRecord };
}
