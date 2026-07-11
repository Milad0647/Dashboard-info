"use client";

import { createContext, useCallback, useContext, useState } from "react";

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
    });
  }, []);

  return (
    <CampaignScrollContext.Provider value={{ forceSectionsMounted, scrollToSection }}>
      {children}
    </CampaignScrollContext.Provider>
  );
}

export function useCampaignScroll() {
  return useContext(CampaignScrollContext);
}
