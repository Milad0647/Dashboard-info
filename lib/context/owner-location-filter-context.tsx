"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { OwnerFilterOption } from "@/lib/owner-users";
import {
  collectOwnerLocations,
  DEFAULT_OWNER_LOCATION_FILTER,
  OWNER_LOCATION_ALL,
  OWNER_USER_ALL,
  type OwnerLocationFilter,
} from "@/lib/owner-location-filter";
import type { DataOwnerGroup, Ownable } from "@/lib/types";
import type { CampaignContentSort, CampaignDatePreset } from "@/lib/owner-location-filter";

export interface CampaignOwnerLocations {
  provinces: string[];
  citiesByProvince: Record<string, string[]>;
}

interface OwnerLocationFilterContextValue {
  filter: OwnerLocationFilter;
  setProvince: (province: string) => void;
  setCity: (city: string) => void;
  setUserKey: (userKey: string) => void;
  setDatePreset: (preset: CampaignDatePreset) => void;
  setDateFrom: (dateFrom: string) => void;
  setDateTo: (dateTo: string) => void;
  setSortOrder: (sortOrder: CampaignContentSort) => void;
  setPlanLabel: (planLabel: string) => void;
  resetFilters: () => void;
  provinces: string[];
  cities: string[];
  plans: string[];
  users: OwnerFilterOption[];
}

const OwnerLocationFilterContext = createContext<OwnerLocationFilterContextValue | null>(null);

interface OwnerLocationFilterProviderProps {
  children: React.ReactNode;
  users?: OwnerFilterOption[];
  locations?: CampaignOwnerLocations;
  plans?: string[];
}

function userMatchesLocation(user: OwnerFilterOption, province: string, city: string): boolean {
  if (province !== OWNER_LOCATION_ALL && user.province !== province) return false;
  if (city !== OWNER_LOCATION_ALL && user.city !== city) return false;
  return true;
}

export function OwnerLocationFilterProvider({
  children,
  users = [],
  locations = { provinces: [], citiesByProvince: {} },
  plans = [],
}: OwnerLocationFilterProviderProps) {
  const [filter, setFilter] = useState<OwnerLocationFilter>(DEFAULT_OWNER_LOCATION_FILTER);

  const provinces = useMemo(() => locations.provinces, [locations.provinces]);

  const cities = useMemo(() => {
    if (filter.province === OWNER_LOCATION_ALL) return [];
    return locations.citiesByProvince[filter.province] ?? [];
  }, [filter.province, locations.citiesByProvince]);

  const visibleUsers = useMemo(
    () => users.filter((user) => userMatchesLocation(user, filter.province, filter.city)),
    [users, filter.province, filter.city]
  );

  const value = useMemo<OwnerLocationFilterContextValue>(
    () => ({
      filter,
      setProvince: (province) =>
        setFilter((current) => {
          const nextUserKey =
            current.userKey !== OWNER_USER_ALL &&
            !users.some(
              (user) => user.key === current.userKey && userMatchesLocation(user, province, OWNER_LOCATION_ALL)
            )
              ? OWNER_USER_ALL
              : current.userKey;

          return {
            ...current,
            province,
            city: OWNER_LOCATION_ALL,
            userKey: nextUserKey,
          };
        }),
      setCity: (city) =>
        setFilter((current) => {
          const nextUserKey =
            current.userKey !== OWNER_USER_ALL &&
            !users.some(
              (user) =>
                user.key === current.userKey && userMatchesLocation(user, current.province, city)
            )
              ? OWNER_USER_ALL
              : current.userKey;

          return { ...current, city, userKey: nextUserKey };
        }),
      setUserKey: (userKey) => {
        if (userKey === OWNER_USER_ALL) {
          setFilter((current) => ({ ...current, userKey }));
          return;
        }

        const user = users.find((item) => item.key === userKey);
        setFilter((current) => ({
          ...current,
          userKey,
          province: user?.province?.trim() || current.province,
          city: user?.city?.trim() || current.city,
        }));
      },
      setDatePreset: (datePreset) => setFilter((current) => ({ ...current, datePreset })),
      setDateFrom: (dateFrom) => setFilter((current) => ({ ...current, dateFrom })),
      setDateTo: (dateTo) => setFilter((current) => ({ ...current, dateTo })),
      setSortOrder: (sortOrder) => setFilter((current) => ({ ...current, sortOrder })),
      setPlanLabel: (planLabel) => setFilter((current) => ({ ...current, planLabel })),
      resetFilters: () => setFilter(DEFAULT_OWNER_LOCATION_FILTER),
      provinces,
      cities,
      plans,
      users: visibleUsers,
    }),
    [filter, provinces, cities, plans, visibleUsers, users]
  );

  return (
    <OwnerLocationFilterContext.Provider value={value}>
      {children}
    </OwnerLocationFilterContext.Provider>
  );
}

export function useOwnerLocationFilter(): OwnerLocationFilterContextValue {
  const context = useContext(OwnerLocationFilterContext);
  if (!context) {
    return {
      filter: DEFAULT_OWNER_LOCATION_FILTER,
      setProvince: () => undefined,
      setCity: () => undefined,
      setUserKey: () => undefined,
      setDatePreset: () => undefined,
      setDateFrom: () => undefined,
      setDateTo: () => undefined,
      setSortOrder: () => undefined,
      setPlanLabel: () => undefined,
      resetFilters: () => undefined,
      provinces: [],
      cities: [],
      plans: [],
      users: [],
    };
  }
  return context;
}

export function collectCampaignOwnerLocations(
  groups: DataOwnerGroup<Ownable>[]
): CampaignOwnerLocations {
  return collectOwnerLocations(groups);
}
