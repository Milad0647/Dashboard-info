"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LayoutDashboard, LogIn, LogOut, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logoutAdminAction } from "@/lib/actions/auth-actions";
import type { CampaignHeaderUser } from "@/lib/campaign-header-user";
import { createClient } from "@/lib/supabase/client";
import { cn, isSupabaseConfigured } from "@/lib/utils";

export type { CampaignHeaderUser };

interface CampaignHeaderAuthProps {
  user: CampaignHeaderUser | null;
  /** Current campaign path for return-to-login (e.g. /campaign/my-slug). */
  returnPath?: string;
  className?: string;
}

export function CampaignHeaderAuth({ user, returnPath, className }: CampaignHeaderAuthProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      if (isSupabaseConfigured()) {
        const supabase = createClient();
        if (supabase) await supabase.auth.signOut();
      }
      await logoutAdminAction();
      setMenuOpen(false);
      router.refresh();
    } finally {
      setIsLoggingOut(false);
    }
  };

  if (!user) {
    const loginHref = returnPath
      ? `/admin/login?next=${encodeURIComponent(returnPath)}`
      : "/admin/login";

    return (
      <div className={cn(className)} data-export-hide>
        <Button variant="outline" size="sm" asChild>
          <Link href={loginHref}>
            <LogIn className="h-4 w-4" />
            ورود
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div ref={rootRef} className={cn("relative", className)} data-export-hide>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="max-w-[11rem] gap-1.5 sm:max-w-[14rem]"
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        onClick={() => setMenuOpen((open) => !open)}
      >
        <UserCircle className="h-4 w-4 shrink-0" />
        <span className="truncate">{user.name}</span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-[var(--duration-apple-fast)]",
            menuOpen && "rotate-180"
          )}
        />
      </Button>

      {menuOpen && (
        <div
          role="menu"
          className="absolute left-0 top-full z-50 mt-1.5 min-w-[11rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md"
        >
          {user.email && (
            <p className="border-b px-3 py-2 text-[11px] text-muted-foreground truncate" dir="ltr">
              {user.email}
            </p>
          )}
          <Link
            href="/admin/profile"
            role="menuitem"
            className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
            onClick={() => setMenuOpen(false)}
          >
            <UserCircle className="h-4 w-4" />
            پروفایل
          </Link>
          <Link
            href="/admin"
            role="menuitem"
            className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
            onClick={() => setMenuOpen(false)}
          >
            <LayoutDashboard className="h-4 w-4" />
            پنل مدیریت
          </Link>
          <button
            type="button"
            role="menuitem"
            disabled={isLoggingOut}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-accent disabled:opacity-60"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            {isLoggingOut ? "در حال خروج…" : "خروج"}
          </button>
        </div>
      )}
    </div>
  );
}
