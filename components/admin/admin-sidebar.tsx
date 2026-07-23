"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Archive,
  BarChart3,
  Bell,
  ClipboardCheck,
  ClipboardList,
  FileStack,
  FileText,
  GraduationCap,
  HardDrive,
  ImageIcon,
  Images,
  Globe,
  LayoutDashboard,
  LayoutGrid,
  ListChecks,
  LogOut,
  Menu,
  MessageSquare,
  Radio,
  Rocket,
  ScrollText,
  Send,
  Settings,
  Share2,
  Sparkles,
  TriangleAlert,
  Unplug,
  Users,
  UserCircle,
  Video,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn, adminHref, formatPersianNumber, isSupabaseConfigured } from "@/lib/utils";
import { logoutAdminAction } from "@/lib/actions/auth-actions";
import { getSessionContextAction } from "@/lib/actions/extended-actions";
import { createClient } from "@/lib/supabase/client";
import { useAdminCampaign } from "@/components/admin/admin-campaign-provider";
import {
  hasContributorPermission,
  type ContributorPermissionKey,
  type ContributorPermissions,
} from "@/lib/contributor-permissions";
import { getMyUnreadProblemReplyCountAction } from "@/lib/actions/problem-report-actions";
import { getMyUnreadContentMessageCountAction } from "@/lib/actions/content-message-actions";
import { getMyUnreadDirectivesCountAction } from "@/lib/actions/directive-actions";
import {
  PROBLEM_REPORTS_UNREAD_EVENT,
  readUnreadCountFromEvent,
} from "@/lib/problem-reports-unread";
import {
  CONTENT_MESSAGES_UNREAD_EVENT,
  readContentMessagesUnreadFromEvent,
} from "@/lib/content-messages-unread";
import {
  DIRECTIVES_UNREAD_EVENT,
  readDirectivesUnreadFromEvent,
} from "@/lib/directives-unread";
import type { CampaignSettings } from "@/lib/types";

const allNavItems: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
  adminOrClientOnly?: boolean;
  /** Always visible for every panel user (not gated by section permissions). */
  alwaysVisible?: boolean;
  permissionKey?: ContributorPermissionKey;
}[] = [
  { href: "/admin", label: "داشبورد", icon: LayoutDashboard },
  { href: "/admin/profile", label: "پروفایل من", icon: UserCircle },
  { href: "/admin/integrations", label: "اتصال Map-Bilboard", icon: Unplug, adminOnly: true },
  { href: "/admin/settings", label: "تنظیمات کمپین", icon: Settings, adminOrClientOnly: true },
  {
    href: "/admin/scoring",
    label: "قوانین امتیازدهی خودکار",
    icon: ListChecks,
    adminOrClientOnly: true,
  },
  { href: "/admin/tutorials", label: "آموزش بخش‌ها", icon: GraduationCap, adminOnly: true },
  { href: "/admin/billboards", label: "تبلیغات محیطی", icon: LayoutGrid, permissionKey: "billboards" },
  { href: "/admin/posters", label: "پوسترها", icon: ImageIcon, permissionKey: "posters" },
  { href: "/admin/videos", label: "ویدیوها", icon: Video, permissionKey: "videos" },
  { href: "/admin/files", label: "فایل‌ها", icon: FileStack, permissionKey: "files" },
  { href: "/admin/raw-media", label: "راش تصویر", icon: HardDrive, permissionKey: "rawMedia" },
  { href: "/admin/analytics", label: "آمار سایت", icon: BarChart3, permissionKey: "analytics" },
  { href: "/admin/site-publications", label: "انتشار در سایت", icon: Globe, permissionKey: "sitePublications" },
  { href: "/admin/social-analytics", label: "شبکه‌های اجتماعی", icon: Share2, permissionKey: "socialPosts" },
  { href: "/admin/social-posts", label: "پست‌های شبکه اجتماعی", icon: Images, permissionKey: "socialPosts" },
  { href: "/admin/press-publications", label: "مجله و روزنامه", icon: FileText, permissionKey: "activities" },
  { href: "/admin/activities", label: "اقدامات", icon: Sparkles, permissionKey: "activities" },
  { href: "/admin/elanha", label: "اعلان‌ها", icon: Bell, adminOrClientOnly: true },
  { href: "/admin/messages", label: "پیام‌های من", icon: MessageSquare, alwaysVisible: true },
  { href: "/admin/directives", label: "دستورکارها", icon: ClipboardCheck, alwaysVisible: true },
  {
    href: "/admin/problem-reports",
    label: "گزارش مشکل",
    icon: TriangleAlert,
    alwaysVisible: true,
  },
  { href: "/admin/broadcast", label: "پخش صدا و سیما", icon: Radio, permissionKey: "broadcast" },
  { href: "/admin/sms-reports", label: "ارسال پیام", icon: Send, permissionKey: "smsReports" },
  { href: "/admin/meetings", label: "جلسات و مصوبات", icon: ClipboardList, permissionKey: "meetings" },
  { href: "/admin/submissions", label: "مشارکت‌ها", icon: FileText, permissionKey: "submissions" },
  { href: "/admin/users", label: "کاربران", icon: Users, adminOrClientOnly: true },
  { href: "/admin/updates", label: "آپدیت‌های سایت", icon: Rocket, adminOrClientOnly: true },
  { href: "/admin/backups", label: "پشتیبان‌گیری", icon: Archive, adminOnly: true },
  {
    href: "/admin/reported-problems",
    label: "مشکلات ثبت‌شده",
    icon: TriangleAlert,
    adminOnly: true,
  },
  { href: "/admin/audit", label: "رصد کاربران", icon: ScrollText, adminOnly: true },
];

const managementNavHrefs = new Set([
  "/admin/integrations",
  "/admin/users",
  "/admin/reported-problems",
  "/admin/audit",
  "/admin/settings",
  "/admin/scoring",
  "/admin/tutorials",
  "/admin/elanha",
  "/admin/updates",
  "/admin/backups",
]);

/** Personal inbox — kept outside uploaded-content sections. */
const myMessagesNavHrefs = new Set(["/admin/messages"]);

const DIRECTIVES_HREF = "/admin/directives";
const MESSAGES_HREF = "/admin/messages";

const SIDEBAR_NAV_SCROLL_KEY = "admin-sidebar-nav-scroll";

type SidebarNavBodyProps = {
  campaignId: string;
  campaigns: CampaignSettings[];
  pathname: string;
  directivesUnread: number;
  directivesNavItem: (typeof allNavItems)[number] | undefined;
  myMessagesNavItems: typeof allNavItems;
  contentNavItems: typeof allNavItems;
  managementNavItems: typeof allNavItems;
  problemReportsUnread: number;
  contentMessagesUnread: number;
  isFullAdminUser: boolean;
  currentCampaign: CampaignSettings | undefined;
  setCampaignId: (id: string) => void;
  setMobileOpen: (open: boolean) => void;
  onLogout: () => void;
  navRef?: RefObject<HTMLElement | null>;
};

function renderNavLink({
  item,
  campaignId,
  pathname,
  setMobileOpen,
  problemReportsUnread,
  contentMessagesUnread,
}: {
  item: (typeof allNavItems)[number];
  campaignId: string;
  pathname: string;
  setMobileOpen: (open: boolean) => void;
  problemReportsUnread: number;
  contentMessagesUnread: number;
}) {
  const Icon = item.icon;
  const href = adminHref(item.href, campaignId);
  const isActive =
    pathname === item.href ||
    (item.href === "/admin/elanha" && pathname === "/admin/notifications");
  return (
    <Link
      key={item.href}
      href={href}
      prefetch={false}
      onClick={() => setMobileOpen(false)}
      className={cn(
        "apple-nav-item flex items-center gap-3 rounded-lg px-3 py-2 text-sm",
        isActive
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate flex-1">{item.label}</span>
      {item.href === "/admin/problem-reports" && problemReportsUnread > 0 && (
        <span
          className="ms-auto h-2.5 w-2.5 shrink-0 rounded-full bg-red-500"
          title="پاسخ خوانده‌نشده"
          aria-label="پاسخ خوانده‌نشده"
        />
      )}
      {item.href === MESSAGES_HREF && contentMessagesUnread > 0 && (
        <span
          className="ms-auto h-2.5 w-2.5 shrink-0 rounded-full bg-red-500"
          title="پیام خوانده‌نشده"
          aria-label="پیام خوانده‌نشده"
        />
      )}
    </Link>
  );
}

function SidebarNavBody({
  campaignId,
  campaigns,
  pathname,
  directivesUnread,
  directivesNavItem,
  myMessagesNavItems,
  contentNavItems,
  managementNavItems,
  problemReportsUnread,
  contentMessagesUnread,
  isFullAdminUser,
  currentCampaign,
  setCampaignId,
  setMobileOpen,
  onLogout,
  navRef,
}: SidebarNavBodyProps) {
  return (
    <>
      <div className="p-4 border-b space-y-3">
        <Link href="/admin" className="font-bold text-lg block">
          پنل مدیریت
        </Link>
        {campaigns.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">کمپین فعال</p>
            <Select value={campaignId} onValueChange={setCampaignId}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="انتخاب کمپین" />
              </SelectTrigger>
              <SelectContent>
                {campaigns.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <nav
        ref={navRef}
        className="flex-1 overflow-y-auto p-3"
        onScroll={(event) => {
          if (!navRef) return;
          try {
            sessionStorage.setItem(
              SIDEBAR_NAV_SCROLL_KEY,
              String(event.currentTarget.scrollTop)
            );
          } catch {
            // Ignore storage failures (private mode / quota).
          }
        }}
      >
        {directivesNavItem && (
          <div className="mb-3">
            <Link
              href={adminHref(DIRECTIVES_HREF, campaignId)}
              prefetch={false}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-extrabold tracking-wide",
                "bg-red-600 text-white shadow-lg shadow-red-600/40",
                "ring-2 ring-red-400/70 hover:bg-red-700 hover:shadow-red-700/50",
                "transition-colors",
                pathname === DIRECTIVES_HREF && "ring-4 ring-white/70"
              )}
            >
              <ClipboardCheck className="h-5 w-5 shrink-0" />
              <span>دستورکارها</span>
              {directivesUnread > 0 && (
                <span className="rounded-md bg-white/20 px-2 py-0.5 text-xs font-bold tabular-nums">
                  {formatPersianNumber(directivesUnread)} جدید
                </span>
              )}
            </Link>
          </div>
        )}

        {myMessagesNavItems.length > 0 && (
          <div className="mb-3 rounded-xl border border-border/80 bg-muted/30 p-2">
            <div className="space-y-1">
              {myMessagesNavItems.map((item) =>
                renderNavLink({
                  item,
                  campaignId,
                  pathname,
                  setMobileOpen,
                  problemReportsUnread,
                  contentMessagesUnread,
                })
              )}
            </div>
          </div>
        )}

        <div className="space-y-1">
          {contentNavItems.map((item) =>
            renderNavLink({
              item,
              campaignId,
              pathname,
              setMobileOpen,
              problemReportsUnread,
              contentMessagesUnread,
            })
          )}
        </div>

        {managementNavItems.length > 0 && (
          <div className="mt-4 border-t pt-3">
            <p className="px-3 pb-2 text-xs font-medium text-muted-foreground">
              تنظیمات و مدیریت
            </p>
            <div className="space-y-1">
              {managementNavItems.map((item) =>
                renderNavLink({
                  item,
                  campaignId,
                  pathname,
                  setMobileOpen,
                  problemReportsUnread,
                  contentMessagesUnread,
                })
              )}
            </div>
          </div>
        )}
      </nav>
      <div className="p-3 border-t space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">تم</span>
          <ThemeToggle />
        </div>
        {isFullAdminUser && currentCampaign && (
          <Link href={`/campaign/${currentCampaign.slug}`} target="_blank">
            <Button variant="outline" size="sm" className="w-full">
              مشاهده صفحه عمومی
            </Button>
          </Link>
        )}
        <Button variant="ghost" size="sm" className="w-full" onClick={onLogout}>
          <LogOut className="h-4 w-4" />
          خروج
        </Button>
      </div>
    </>
  );
}

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isFullAdminUser, setIsFullAdminUser] = useState(true);
  const [isClientRole, setIsClientRole] = useState(false);
  const [permissions, setPermissions] = useState<ContributorPermissions | null>(null);
  const [problemReportsUnread, setProblemReportsUnread] = useState(0);
  const [contentMessagesUnread, setContentMessagesUnread] = useState(0);
  const [directivesUnread, setDirectivesUnread] = useState(0);
  const { campaignId, campaigns, currentCampaign, setCampaignId } = useAdminCampaign();
  const desktopNavRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    getSessionContextAction(campaignId).then((session) => {
      if (!session) return;
      setIsFullAdminUser(session.type === "env_admin" || session.role === "admin");
      setIsClientRole(session.role === "client");
      setPermissions(session.permissions ?? null);
    });
  }, [campaignId]);

  useEffect(() => {
    let cancelled = false;

    const refreshUnread = async () => {
      try {
        const [problemResult, messageResult, directivesResult] = await Promise.all([
          getMyUnreadProblemReplyCountAction(),
          getMyUnreadContentMessageCountAction(),
          campaignId
            ? getMyUnreadDirectivesCountAction(campaignId)
            : Promise.resolve({ success: true as const, count: 0 }),
        ]);
        if (cancelled) return;
        if (problemResult.success) {
          setProblemReportsUnread(problemResult.count ?? 0);
        }
        if (messageResult.success) {
          setContentMessagesUnread(messageResult.count ?? 0);
        }
        if (directivesResult.success) {
          setDirectivesUnread(directivesResult.count ?? 0);
        }
      } catch {
        if (!cancelled) {
          setProblemReportsUnread(0);
          setContentMessagesUnread(0);
          setDirectivesUnread(0);
        }
      }
    };

    void refreshUnread();
    const timer = window.setInterval(() => {
      void refreshUnread();
    }, 60_000);

    const onProblemUnreadEvent = (event: Event) => {
      const count = readUnreadCountFromEvent(event);
      if (count !== null) setProblemReportsUnread(count);
    };
    const onMessagesUnreadEvent = (event: Event) => {
      const count = readContentMessagesUnreadFromEvent(event);
      if (count !== null) setContentMessagesUnread(count);
    };
    const onDirectivesUnreadEvent = (event: Event) => {
      const count = readDirectivesUnreadFromEvent(event);
      if (count !== null) setDirectivesUnread(count);
    };
    window.addEventListener(PROBLEM_REPORTS_UNREAD_EVENT, onProblemUnreadEvent);
    window.addEventListener(CONTENT_MESSAGES_UNREAD_EVENT, onMessagesUnreadEvent);
    window.addEventListener(DIRECTIVES_UNREAD_EVENT, onDirectivesUnreadEvent);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener(PROBLEM_REPORTS_UNREAD_EVENT, onProblemUnreadEvent);
      window.removeEventListener(CONTENT_MESSAGES_UNREAD_EVENT, onMessagesUnreadEvent);
      window.removeEventListener(DIRECTIVES_UNREAD_EVENT, onDirectivesUnreadEvent);
    };
  }, [campaignId]);

  // Restore sidebar scroll after navigation remounts / soft refreshes.
  useEffect(() => {
    const nav = desktopNavRef.current;
    if (!nav) return;
    try {
      const raw = sessionStorage.getItem(SIDEBAR_NAV_SCROLL_KEY);
      if (!raw) return;
      const top = Number(raw);
      if (!Number.isFinite(top) || top <= 0) return;
      nav.scrollTop = top;
    } catch {
      // Ignore storage failures.
    }
  }, [pathname]);

  const navItems = allNavItems.filter((item) => {
    if (item.alwaysVisible) return true;
    if (item.adminOrClientOnly) {
      return isFullAdminUser || isClientRole;
    }
    if (isFullAdminUser) return true;
    if (item.adminOnly) return false;
    if (!item.permissionKey) return true;
    return hasContributorPermission(permissions, item.permissionKey);
  });

  /** Always pin directives as a red CTA above every other panel menu. */
  const directivesNavItem = navItems.find((item) => item.href === DIRECTIVES_HREF);
  const myMessagesNavItems = navItems.filter((item) => myMessagesNavHrefs.has(item.href));
  const contentNavItems = navItems.filter((item) => {
    if (managementNavHrefs.has(item.href)) return false;
    if (myMessagesNavHrefs.has(item.href)) return false;
    if (item.href === DIRECTIVES_HREF) return false;
    return true;
  });
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

  const sharedNavProps = {
    campaignId,
    campaigns,
    pathname,
    directivesUnread,
    directivesNavItem,
    myMessagesNavItems,
    contentNavItems,
    managementNavItems,
    problemReportsUnread,
    contentMessagesUnread,
    isFullAdminUser,
    currentCampaign,
    setCampaignId,
    setMobileOpen,
    onLogout: handleLogout,
  };

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        className="fixed right-4 top-4 z-[80] lg:hidden"
        onClick={() => setMobileOpen(true)}
      >
        <Menu className="h-4 w-4" />
      </Button>

      {mobileOpen && (
        <div className="fixed inset-0 z-[80] lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute right-0 top-0 flex h-full w-64 flex-col border-l bg-card">
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-2 top-2"
              onClick={() => setMobileOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
            <SidebarNavBody {...sharedNavProps} />
          </aside>
        </div>
      )}

      <aside className="hidden lg:fixed lg:inset-y-0 lg:right-0 lg:z-[80] lg:flex lg:w-64 lg:flex-col border-l bg-card">
        <SidebarNavBody {...sharedNavProps} navRef={desktopNavRef} />
      </aside>
    </>
  );
}

