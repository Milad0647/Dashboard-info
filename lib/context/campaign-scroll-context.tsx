"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

interface CampaignScrollContextValue {
  forceSectionsMounted: boolean;
  scrollToSection: (sectionId: string) => void;
}

const CampaignScrollContext = createContext<CampaignScrollContextValue>({
  forceSectionsMounted: false,
  scrollToSection: () => undefined,
});

export function CampaignScrollProvider({ children }: { children: React.ReactNode }) {
  const [forceSectionsMounted, setForceSectionsMounted] = useState(false);

  const scrollToSection = useCallback((sectionId: string) => {
    if (!sectionId) return;
    setForceSectionsMounted(true);

    const run = () => {
      const target = document.getElementById(sectionId);
      if (!target) return;
      const collapsedToggle = target.querySelector<HTMLButtonElement>(
        'button[aria-expanded="false"]'
      );
      collapsedToggle?.click();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    // Allow deferred sections to mount before scrolling.
    requestAnimationFrame(() => {
      requestAnimationFrame(run);
      window.setTimeout(run, 120);
      window.setTimeout(run, 400);
    });
  }, []);

  useEffect(() => {
    const applyHash = () => {
      const sectionId = window.location.hash.replace(/^#/, "").trim();
      if (sectionId) scrollToSection(sectionId);
    };

    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, [scrollToSection]);

  return (
    <CampaignScrollContext.Provider value={{ forceSectionsMounted, scrollToSection }}>
      {children}
    </CampaignScrollContext.Provider>
  );
}

export function useCampaignScroll() {
  return useContext(CampaignScrollContext);
}
