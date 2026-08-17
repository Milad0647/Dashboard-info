"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { OwnerFilterOption } from "@/lib/owner-users";
import {
  collectOwnerLocations,
  DEFAULT_OWNER_LOCATION_FILTER,
  OWNER_COMPANY_TYPE_ALL,
  OWNER_LOCATION_ALL,
  OWNER_USER_ALL,
  type OwnerCompanyTypeFilter,
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
  setCompanyType: (companyType: OwnerCompanyTypeFilter) => void;
  setDatePreset: (preset: CampaignDatePreset) => void;
  setDateFrom: (dateFrom: string) => void;
  setDateTo: (dateTo: string) => void;
  setSortOrder: (sortOrder: CampaignContentSort) => void;
  setPlanLabels: (planLabels: string[]) => void;
  togglePlanLabel: (planLabel: string) => void;
  setSearchQuery: (searchQuery: string) => void;
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
  initialFilter?: Partial<OwnerLocationFilter>;
}

export function OwnerLocationFilterProvider({
  children,
  users = [],
  locations = { provinces: [], citiesByProvince: {} },
  plans = [],
  initialFilter,
}: OwnerLocationFilterProviderProps) {
  const [filter, setFilter] = useState<OwnerLocationFilter>({
    ...DEFAULT_OWNER_LOCATION_FILTER,
    ...initialFilter,
  });

  const provinces = useMemo(() => locations.provinces, [locations.provinces]);

  const cities = useMemo(() => {
    if (filter.province === OWNER_LOCATION_ALL) return [];
    return locations.citiesByProvince[filter.province] ?? [];
  }, [filter.province, locations.citiesByProvince]);

  const value = useMemo<OwnerLocationFilterContextValue>(
    () => ({
      filter,
      setProvince: (province) =>
        setFilter((current) => ({
          ...current,
          province,
          city: OWNER_LOCATION_ALL,
        })),
      setCity: (city) => setFilter((current) => ({ ...current, city })),
      setUserKey: (userKey) => {
        if (userKey === OWNER_USER_ALL) {
          setFilter((current) => ({
            ...current,
            userKey: OWNER_USER_ALL,
          }));
          return;
        }

        const user = users.find((item) => item.key === userKey);
        setFilter((current) => ({
          ...current,
          userKey,
          province:
            current.province !== OWNER_LOCATION_ALL
              ? current.province
              : user?.province?.trim() || current.province,
          city:
            current.city !== OWNER_LOCATION_ALL
              ? current.city
              : user?.city?.trim() || current.city,
          companyType:
            current.companyType !== OWNER_COMPANY_TYPE_ALL
              ? current.companyType
              : (user?.companyType ?? current.companyType),
        }));
      },
      setCompanyType: (companyType) => setFilter((current) => ({ ...current, companyType })),
      setDatePreset: (datePreset) => setFilter((current) => ({ ...current, datePreset })),
      setDateFrom: (dateFrom) => setFilter((current) => ({ ...current, dateFrom })),
      setDateTo: (dateTo) => setFilter((current) => ({ ...current, dateTo })),
      setSortOrder: (sortOrder) => setFilter((current) => ({ ...current, sortOrder })),
      setPlanLabels: (planLabels) => setFilter((current) => ({ ...current, planLabels })),
      togglePlanLabel: (planLabel) =>
        setFilter((current) => {
          const exists = current.planLabels.includes(planLabel);
          return {
            ...current,
            planLabels: exists
              ? current.planLabels.filter((label) => label !== planLabel)
              : [...current.planLabels, planLabel],
          };
        }),
      setSearchQuery: (searchQuery) => setFilter((current) => ({ ...current, searchQuery })),
      resetFilters: () => setFilter(DEFAULT_OWNER_LOCATION_FILTER),
      provinces,
      cities,
      plans,
      users,
    }),
    [filter, provinces, cities, plans, users]
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
      setCompanyType: () => undefined,
      setDatePreset: () => undefined,
      setDateFrom: () => undefined,
      setDateTo: () => undefined,
      setSortOrder: () => undefined,
      setPlanLabels: () => undefined,
      togglePlanLabel: () => undefined,
      setSearchQuery: () => undefined,
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
