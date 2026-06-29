"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { DataOwnerGroup, Ownable, PublicCampaignData } from "@/lib/types";
import {
  collectOwnerLocations,
  DEFAULT_OWNER_LOCATION_FILTER,
  type OwnerLocationFilter,
} from "@/lib/owner-location-filter";

interface OwnerLocationFilterContextValue {
  filter: OwnerLocationFilter;
  setProvince: (province: string) => void;
  setCity: (city: string) => void;
  provinces: string[];
  cities: string[];
  hasContributorLocations: boolean;
}

const OwnerLocationFilterContext = createContext<OwnerLocationFilterContextValue | null>(null);

function collectAllOwnerGroups(data: PublicCampaignData): DataOwnerGroup<Ownable>[] {
  return [
    ...data.billboardGroups,
    ...data.posterGroups,
    ...data.videoGroups,
    ...data.submissionGroups,
    ...data.sitePublicationGroups,
    ...data.socialPostGroups,
    ...data.activityGroups,
    ...data.broadcastReportGroups,
    ...data.meetingGroups,
    ...data.fileGroups,
  ];
}

interface OwnerLocationFilterProviderProps {
  data: PublicCampaignData;
  children: React.ReactNode;
}

export function OwnerLocationFilterProvider({ data, children }: OwnerLocationFilterProviderProps) {
  const [filter, setFilter] = useState<OwnerLocationFilter>(DEFAULT_OWNER_LOCATION_FILTER);

  const { provinces, citiesByProvince } = useMemo(
    () => collectOwnerLocations(collectAllOwnerGroups(data)),
    [data]
  );

  const cities = useMemo(
    () => (filter.province === "all" ? [] : (citiesByProvince[filter.province] ?? [])),
    [filter.province, citiesByProvince]
  );

  const value = useMemo<OwnerLocationFilterContextValue>(
    () => ({
      filter,
      setProvince: (province) =>
        setFilter({ province, city: "all" }),
      setCity: (city) =>
        setFilter((current) => ({ ...current, city })),
      provinces,
      cities,
      hasContributorLocations: provinces.length > 0,
    }),
    [filter, provinces, cities]
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
      provinces: [],
      cities: [],
      hasContributorLocations: false,
    };
  }
  return context;
}
