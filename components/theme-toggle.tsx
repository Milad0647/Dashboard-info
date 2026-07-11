"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const THEME_STORAGE_KEY = "theme";

function applyTheme(theme: "light" | "dark") {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
    root.style.colorScheme = "dark";
  } else {
    root.classList.remove("dark");
    root.style.colorScheme = "light";
  }
  // Notify listeners (charts/toasts) that theme tokens changed.
  window.dispatchEvent(new CustomEvent("themechange", { detail: theme }));
}

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    const next = stored === "dark" ? "dark" : "light";
    setTheme(next);
    applyTheme(next);
    setMounted(true);
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem(THEME_STORAGE_KEY, next);
    applyTheme(next);
  };

  if (!mounted) {
    return (
      <Button type="button" variant="ghost" size="sm" className={className} disabled>
        <Sun className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={className}
      onClick={toggle}
      title={theme === "dark" ? "حالت روشن" : "حالت تیره"}
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      <span className="sr-only">{theme === "dark" ? "حالت روشن" : "حالت تیره"}</span>
    </Button>
  );
}
