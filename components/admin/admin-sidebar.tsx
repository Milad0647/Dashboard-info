"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  FileText,
  FolderKanban,
  ImageIcon,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Menu,
  Settings,
  Video,
  X,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, adminHref, getDatabaseMode } from "@/lib/utils";
import { logoutAdminAction } from "@/lib/actions/auth-actions";
import { createClient } from "@/lib/supabase/client";
import { useAdminCampaign } from "@/components/admin/admin-campaign-provider";

const navItems = [
  { href: "/admin", label: "داشبورد", icon: LayoutDashboard },
  { href: "/admin/campaigns", label: "مدیریت کمپین‌ها", icon: FolderKanban, noCampaignParam: true },
  { href: "/admin/settings", label: "تنظیمات کمپین", icon: Settings },
  { href: "/admin/billboards", label: "بیلبوردها", icon: LayoutGrid },
  { href: "/admin/posters", label: "پوسترها", icon: ImageIcon },
  { href: "/admin/videos", label: "ویدیوها", icon: Video },
  { href: "/admin/analytics", label: "آمار", icon: BarChart3 },
  { href: "/admin/submissions", label: "مشارکت‌ها", icon: FileText },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { campaignId, campaigns, currentCampaign, setCampaignId } = useAdminCampaign();

  const handleLogout = async () => {
    if (getDatabaseMode() === "supabase") {
      const supabase = createClient();
      if (supabase) await supabase.auth.signOut();
    } else {
      await logoutAdminAction();
    }
    router.push("/admin/login");
    router.refresh();
  };

  const NavContent = () => (
    <>
      <div className="p-4 border-b space-y-3">
        <Link href="/admin" className="font-bold text-lg block">پنل مدیریت</Link>
        {campaigns.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">کمپین فعال</p>
            <Select value={campaignId} onValueChange={setCampaignId}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="انتخاب کمپین" />
              </SelectTrigger>
              <SelectContent>
                {campaigns.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const href = item.noCampaignParam ? item.href : adminHref(item.href, campaignId);
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t space-y-2">
        {currentCampaign && (
          <Link href={`/campaign/${currentCampaign.slug}`} target="_blank">
            <Button variant="outline" size="sm" className="w-full">
              مشاهده صفحه عمومی
            </Button>
          </Link>
        )}
        <Button variant="ghost" size="sm" className="w-full" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
          خروج
        </Button>
      </div>
    </>
  );

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        className="fixed top-4 right-4 z-50 lg:hidden"
        onClick={() => setMobileOpen(true)}
      >
        <Menu className="h-4 w-4" />
      </Button>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute right-0 top-0 h-full w-64 bg-card border-l flex flex-col">
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-2 top-2"
              onClick={() => setMobileOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
            <NavContent />
          </aside>
        </div>
      )}

      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:right-0 bg-card border-l">
        <NavContent />
      </aside>
    </>
  );
}
