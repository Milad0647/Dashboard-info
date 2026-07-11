"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Bell,
  ClipboardList,
  FileStack,
  FileText,
  HardDrive,
  ImageIcon,
  Globe,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Menu,
  Radio,
  Settings,
  Share2,
  Sparkles,
  Unplug,
  Users,
  UserCircle,
  Video,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, adminHref, isSupabaseConfigured } from "@/lib/utils";
import { logoutAdminAction } from "@/lib/actions/auth-actions";
import { getSessionContextAction } from "@/lib/actions/extended-actions";
import { createClient } from "@/lib/supabase/client";
import { useAdminCampaign } from "@/components/admin/admin-campaign-provider";
import {
  hasContributorPermission,
  type ContributorPermissionKey,
  type ContributorPermissions,
} from "@/lib/contributor-permissions";

const allNavItems: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
  adminOrClientOnly?: boolean;
  permissionKey?: ContributorPermissionKey;
}[] = [
  { href: "/admin", label: "داشبورد", icon: LayoutDashboard },
  { href: "/admin/profile", label: "پروفایل من", icon: UserCircle },
  { href: "/admin/integrations", label: "اتصال Map-Bilboard", icon: Unplug, adminOnly: true },
  { href: "/admin/settings", label: "تنظیمات کمپین", icon: Settings, adminOnly: true },
  { href: "/admin/billboards", label: "تبلیغات محیطی", icon: LayoutGrid, permissionKey: "billboards" },
  { href: "/admin/posters", label: "پوسترها", icon: ImageIcon, permissionKey: "posters" },
  { href: "/admin/videos", label: "ویدیوها", icon: Video, permissionKey: "videos" },
  { href: "/admin/files", label: "فایل‌ها", icon: FileStack, permissionKey: "files" },
  { href: "/admin/raw-media", label: "رسانه خام", icon: HardDrive, permissionKey: "rawMedia" },
  { href: "/admin/analytics", label: "آمار سایت", icon: BarChart3, permissionKey: "analytics" },
  { href: "/admin/site-publications", label: "انتشار در سایت", icon: Globe, permissionKey: "sitePublications" },
  { href: "/admin/social-posts", label: "شبکه‌های اجتماعی", icon: Share2, permissionKey: "socialPosts" },
  { href: "/admin/press-publications", label: "مجله و روزنامه", icon: FileText, permissionKey: "activities" },
  { href: "/admin/activities", label: "اقدامات", icon: Sparkles, permissionKey: "activities" },
  { href: "/admin/elanha", label: "اعلان‌ها", icon: Bell, adminOrClientOnly: true },
  { href: "/admin/broadcast", label: "پخش صدا و سیما", icon: Radio, permissionKey: "broadcast" },
  { href: "/admin/meetings", label: "جلسات و مصوبات", icon: ClipboardList, permissionKey: "meetings" },
  { href: "/admin/submissions", label: "مشارکت‌ها", icon: FileText, permissionKey: "submissions" },
  { href: "/admin/users", label: "کاربران", icon: Users, adminOrClientOnly: true },
];

const managementNavHrefs = new Set([
  "/admin/integrations",
  "/admin/users",
  "/admin/settings",
  "/admin/elanha",
]);

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isFullAdminUser, setIsFullAdminUser] = useState(true);
  const [isClientRole, setIsClientRole] = useState(false);
  const [permissions, setPermissions] = useState<ContributorPermissions | null>(null);
  const { campaignId, campaigns, currentCampaign, setCampaignId } = useAdminCampaign();

  useEffect(() => {
    getSessionContextAction(campaignId).then((session) => {
      if (!session) return;
      setIsFullAdminUser(session.type === "env_admin" || session.role === "admin");
      setIsClientRole(session.role === "client");
      setPermissions(session.permissions ?? null);
    });
  }, [campaignId]);

  const navItems = allNavItems.filter((item) => {
    if (item.adminOrClientOnly) {
      return isFullAdminUser || isClientRole;
    }
    if (isFullAdminUser) return true;
    if (item.adminOnly) return false;
    if (!item.permissionKey) return true;
    return hasContributorPermission(permissions, item.permissionKey);
  });

  const contentNavItems = navItems.filter((item) => !managementNavHrefs.has(item.href));
  const managementNavItems = navItems.filter((item) => managementNavHrefs.has(item.href));

  const handleLogout = async () => {
    if (isSupabaseConfigured()) {
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
      <nav className="flex-1 overflow-y-auto p-3">
        <div className="space-y-1">
          {contentNavItems.map((item) => {
            const Icon = item.icon;
            const href = adminHref(item.href, campaignId);
            const isActive =
              pathname === item.href || (item.href === "/admin/elanha" && pathname === "/admin/notifications");
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
        </div>

        {managementNavItems.length > 0 && (
          <div className="mt-4 border-t pt-3">
            <p className="px-3 pb-2 text-xs font-medium text-muted-foreground">تنظیمات و مدیریت</p>
            <div className="space-y-1">
              {managementNavItems.map((item) => {
                const Icon = item.icon;
                const href = adminHref(item.href, campaignId);
                const isActive =
                  pathname === item.href || (item.href === "/admin/elanha" && pathname === "/admin/notifications");
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
            </div>
          </div>
        )}
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
