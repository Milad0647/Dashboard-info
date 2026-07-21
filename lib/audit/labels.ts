import type { AuditCategory } from "@/lib/audit/types";

export const AUDIT_CATEGORY_LABELS: Record<AuditCategory, string> = {
  auth: "احراز هویت",
  navigation: "پیمایش",
  content: "محتوا",
  ui: "کلیک",
  admin: "مدیریت",
  system: "سیستم",
};

const ACTION_LABELS: Record<string, string> = {
  "auth.login": "ورود",
  "auth.logout": "خروج",
  "auth.login_failed": "ورود ناموفق",
  "navigation.page_view": "بازدید صفحه",
  "ui.click": "کلیک روی دکمه",
  "ui.error": "خطای کاربر",
  "presence.heartbeat": "حضور آنلاین",
  "content.create": "ایجاد محتوا",
  "content.update": "ویرایش محتوا",
  "content.delete": "حذف محتوا",
  "content.score": "امتیازدهی",
  "admin.settings_update": "به‌روزرسانی تنظیمات",
  "user.create": "ایجاد کاربر",
  "user.update": "ویرایش کاربر",
  "user.delete": "حذف کاربر",
  "profile.update": "ویرایش پروفایل",
  "problem.report": "گزارش مشکل",
  "problem.triage": "رسیدگی به گزارش مشکل",
};

const ENTITY_LABELS: Record<string, string> = {
  campaign: "کمپین",
  billboard: "بیلبورد",
  poster: "پوستر",
  poster_version: "نسخه پوستر",
  video: "ویدیو",
  video_version: "نسخه ویدیو",
  media_category: "دسته رسانه",
  analytics_metric: "آمار سایت",
  submission: "مشارکت",
  file: "فایل",
  raw_media: "راش تصویر",
  social_post: "پست شبکه اجتماعی",
  social_platform_stat: "آمار شبکه اجتماعی",
  broadcast_report: "گزارش پخش",
  sms_send_report: "ارسال پیام",
  activity: "اقدام",
  meeting: "جلسه",
  user: "کاربر",
};

export function getAuditActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

export function getAuditEntityLabel(entityType: string | null): string {
  if (!entityType) return "—";
  return ENTITY_LABELS[entityType] ?? entityType;
}

export function getAuditRoleLabel(role: string | null): string {
  switch (role) {
    case "admin":
      return "مدیر";
    case "contributor":
      return "همکار";
    case "client":
      return "کارفرما";
    default:
      return role ?? "—";
  }
}
