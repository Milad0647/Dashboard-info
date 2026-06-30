"use client";

import { useMemo } from "react";
import type { DataOwnerGroup, Ownable } from "@/lib/types";
import { useOwnerLocationFilter } from "@/lib/context/owner-location-filter-context";
import {
  filterItemsByOwnerLocation,
  filterOwnerGroupsByLocation,
} from "@/lib/owner-location-filter";

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

  return useMemo(() => filterItemsByOwnerLocation(items, filter), [items, filter]);
}
