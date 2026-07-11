"use client";

import { useEffect, useState } from "react";

export interface ChartTheme {
  isDark: boolean;
  grid: string;
  tick: string;
  axis: string;
  tooltipContentStyle: React.CSSProperties;
  tooltipLabelStyle: React.CSSProperties;
  legendStyle: React.CSSProperties;
}

function readIsDark(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
}

function buildChartTheme(isDark: boolean): ChartTheme {
  return {
    isDark,
    grid: isDark ? "#243b5c" : "#e2e8f0",
    tick: isDark ? "#94a3b8" : "#64748b",
    axis: isDark ? "#94a3b8" : "#64748b",
    tooltipContentStyle: {
      backgroundColor: isDark ? "#12203a" : "#ffffff",
      border: `1px solid ${isDark ? "#243b5c" : "#e2e8f0"}`,
      borderRadius: 8,
      color: isDark ? "#e8eef9" : "#0f172a",
      boxShadow: isDark ? "0 8px 24px rgba(0,0,0,0.45)" : "0 8px 24px rgba(15,23,42,0.08)",
    },
    tooltipLabelStyle: {
      color: isDark ? "#e8eef9" : "#0f172a",
    },
    legendStyle: {
      color: isDark ? "#94a3b8" : "#64748b",
    },
  };
}

export function useChartTheme(): ChartTheme {
  const [theme, setTheme] = useState<ChartTheme>(() => buildChartTheme(false));

  useEffect(() => {
    const sync = () => setTheme(buildChartTheme(readIsDark()));
    sync();

    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  return theme;
}
