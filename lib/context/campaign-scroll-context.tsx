"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  dispatchCampaignRevealContent,
  scrollCampaignContentIntoView,
} from "@/lib/campaign-content-scroll";

interface CampaignScrollContextValue {
  forceSectionsMounted: boolean;
  scrollToSection: (sectionId: string, contentId?: string) => void;
}

const CampaignScrollContext = createContext<CampaignScrollContextValue>({
  forceSectionsMounted: false,
  scrollToSection: () => undefined,
});

export function CampaignScrollProvider({ children }: { children: React.ReactNode }) {
  const [forceSectionsMounted, setForceSectionsMounted] = useState(false);

  const scrollToSection = useCallback((sectionId: string, contentId?: string) => {
    if (!sectionId) return;
    setForceSectionsMounted(true);

    const expandSection = () => {
      const target = document.getElementById(sectionId);
      if (!target) return false;
      const collapsedToggle = target.querySelector<HTMLButtonElement>(
        'button[aria-expanded="false"]'
      );
      collapsedToggle?.click();
      return true;
    };

    const run = () => {
      expandSection();

      if (contentId && scrollCampaignContentIntoView(contentId)) {
        return;
      }

      const target = document.getElementById(sectionId);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }

      if (contentId) {
        dispatchCampaignRevealContent(sectionId, contentId);
      }
    };

    // Allow deferred sections to mount before scrolling.
    requestAnimationFrame(() => {
      requestAnimationFrame(run);
      window.setTimeout(run, 120);
      window.setTimeout(run, 400);
      window.setTimeout(run, 900);
      if (contentId) {
        window.setTimeout(run, 1600);
      }
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
