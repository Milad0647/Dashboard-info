"use client";

import { createContext, useContext, useMemo } from "react";
import { normalizeScoringRules } from "@/lib/scoring/normalize-scoring-rules";
import type { CampaignScoringConfig } from "@/lib/types";

const ScoringRulesContext = createContext<CampaignScoringConfig | null>(null);

export function ScoringRulesProvider({
  scoringRules,
  children,
}: {
  scoringRules?: CampaignScoringConfig | null;
  children: React.ReactNode;
}) {
  const value = useMemo(
    () => normalizeScoringRules(scoringRules ?? {}),
    [scoringRules]
  );
  return (
    <ScoringRulesContext.Provider value={value}>{children}</ScoringRulesContext.Provider>
  );
}

export function useScoringRules(): CampaignScoringConfig {
  const ctx = useContext(ScoringRulesContext);
  return ctx ?? normalizeScoringRules({});
}
