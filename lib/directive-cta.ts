import type { DirectiveActionType, DirectiveSystemAction } from "@/lib/types";
import { adminHref } from "@/lib/utils";

export type { DirectiveActionType, DirectiveSystemAction };

export interface DirectiveSystemActionOption {
  value: DirectiveSystemAction;
  label: string;
  path: string;
  /** Suggested default button label in Persian. */
  defaultButtonLabel: string;
}

export const DIRECTIVE_SYSTEM_ACTIONS: DirectiveSystemActionOption[] = [
  {
    value: "profile",
    label: "پروفایل من",
    path: "/admin/profile",
    defaultButtonLabel: "تکمیل پروفایل",
  },
  {
    value: "posters",
    label: "پوسترها",
    path: "/admin/posters",
    defaultButtonLabel: "آپلود پوستر",
  },
  {
    value: "videos",
    label: "ویدیوها",
    path: "/admin/videos",
    defaultButtonLabel: "آپلود ویدیو",
  },
  {
    value: "files",
    label: "فایل‌ها",
    path: "/admin/files",
    defaultButtonLabel: "آپلود فایل",
  },
  {
    value: "raw_media",
    label: "راش تصویر",
    path: "/admin/raw-media",
    defaultButtonLabel: "آپلود راش تصویر",
  },
  {
    value: "billboards",
    label: "تبلیغات محیطی",
    path: "/admin/billboards",
    defaultButtonLabel: "مشاهده تبلیغات محیطی",
  },
  {
    value: "activities",
    label: "اقدامات",
    path: "/admin/activities",
    defaultButtonLabel: "ثبت اقدام",
  },
  {
    value: "submissions",
    label: "مشارکت‌ها",
    path: "/admin/submissions",
    defaultButtonLabel: "ارسال مشارکت",
  },
  {
    value: "social_posts",
    label: "پست‌های شبکه اجتماعی",
    path: "/admin/social-posts",
    defaultButtonLabel: "ثبت پست شبکه اجتماعی",
  },
  {
    value: "meetings",
    label: "جلسات و مصوبات",
    path: "/admin/meetings",
    defaultButtonLabel: "مشاهده جلسات",
  },
  {
    value: "broadcast",
    label: "پخش صدا و سیما",
    path: "/admin/broadcast",
    defaultButtonLabel: "ثبت پخش صدا و سیما",
  },
  {
    value: "problem_reports",
    label: "گزارش مشکل",
    path: "/admin/problem-reports",
    defaultButtonLabel: "ثبت گزارش مشکل",
  },
];

const systemActionByValue = new Map(
  DIRECTIVE_SYSTEM_ACTIONS.map((item) => [item.value, item])
);

export function isDirectiveActionType(value: unknown): value is DirectiveActionType {
  return value === "none" || value === "custom_url" || value === "system";
}

export function isDirectiveSystemAction(value: unknown): value is DirectiveSystemAction {
  return typeof value === "string" && systemActionByValue.has(value as DirectiveSystemAction);
}

export function getDirectiveSystemAction(
  value: DirectiveSystemAction | null | undefined
): DirectiveSystemActionOption | null {
  if (!value) return null;
  return systemActionByValue.get(value) ?? null;
}

/** Normalize and validate an external http(s) URL for custom CTA buttons. */
export function normalizeDirectiveActionUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function resolveDirectiveActionHref(input: {
  actionType: DirectiveActionType;
  actionUrl?: string | null;
  systemAction?: DirectiveSystemAction | null;
  campaignId: string;
}): { href: string; external: boolean } | null {
  if (input.actionType === "custom_url") {
    const href = normalizeDirectiveActionUrl(input.actionUrl ?? "");
    if (!href) return null;
    return { href, external: true };
  }

  if (input.actionType === "system") {
    const option = getDirectiveSystemAction(input.systemAction);
    if (!option) return null;
    return { href: adminHref(option.path, input.campaignId), external: false };
  }

  return null;
}

export function resolveDirectiveActionLabel(input: {
  actionType: DirectiveActionType;
  actionLabel?: string | null;
  systemAction?: DirectiveSystemAction | null;
}): string | null {
  if (input.actionType === "none") return null;

  const custom = input.actionLabel?.trim();
  if (custom) return custom;

  if (input.actionType === "system") {
    return getDirectiveSystemAction(input.systemAction)?.defaultButtonLabel ?? "ادامه";
  }

  return "مشاهده لینک";
}
