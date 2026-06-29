"use client";

import { useMemo } from "react";
import type { DataOwnerGroup, Ownable } from "@/lib/types";
import { useOwnerLocationFilter } from "@/lib/context/owner-location-filter-context";
import { filterOwnerGroupsByLocation } from "@/lib/owner-location-filter";

export function useFilteredOwnerGroups<T extends Ownable>(
  groups: DataOwnerGroup<T>[]
): DataOwnerGroup<T>[] {
  const { filter } = useOwnerLocationFilter();

  return useMemo(
    () => filterOwnerGroupsByLocation(groups, filter),
    [groups, filter]
  );
}

export function useFilteredOwnableItems<T extends Ownable>(items: T[]): T[] {
  const { filter } = useOwnerLocationFilter();

  return useMemo(() => {
    if (filter.province === "all") return items;
    return items.filter((item) => {
      if (!item.ownerUserId) return true;
      if (item.ownerProvince !== filter.province) return false;
      if (filter.city === "all") return true;
      return item.ownerCity === filter.city;
    });
  }, [items, filter]);
}
