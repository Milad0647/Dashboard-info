/**
 * Maps user-facing error messages to a clear problem description and suggested fix.
 * Used by the error modal (user) and rasad problems panel (admin).
 */

export type ErrorSolutionCategory =
  | "validation"
  | "upload"
  | "save"
  | "network"
  | "permission"
  | "auth"
  | "quota"
  | "daily_limit"
  | "runtime"
  | "other";

export interface DailyLimitErrorDetails {
  dailyMax: number;
  /** e.g. پوسترها — null when the cap is the user category, not a content type */
  scopeLabel: string | null;
}

export interface ResolvedErrorInfo {
  /** Short headline shown in the modal */
  title: string;
  /** What went wrong (user-friendly) */
  problem: string;
  /** What the user / admin should do */
  solution: string;
  category: ErrorSolutionCategory;
  /** Original raw message */
  message: string;
  dailyLimit?: DailyLimitErrorDetails;
}

interface ErrorRule {
  match: RegExp | string;
  title: string;
  problem: string;
  solution: string;
  category: ErrorSolutionCategory;
}

const RULES: ErrorRule[] = [
  {
    match: /سقف مجاز بارگذاری روزانه/,
    title: "محدودیت روزانه",
    problem: "سهمیه ثبت امروز برای این دسته تمام شده است.",
    solution:
      "تا باز شدن سهمیه فردا صبر کنید. شمارش معکوس تا نیمه‌شب (به وقت ایران) در همین پنجره نمایش داده می‌شود.",
    category: "daily_limit",
  },
  {
    match: /الزامی|لازم است|وارد کنید|انتخاب .+ الزامی|پر کنید/i,
    title: "اطلاعات ناقص",
    problem: "یکی از فیلدهای ضروری خالی مانده یا مقدار معتبر ندارد.",
    solution:
      "فرم را دوباره بررسی کنید؛ فیلدهای ستاره‌دار یا مشخص‌شده را کامل کنید و دوباره ذخیره کنید.",
    category: "validation",
  },
  {
    match: /حداکثر .+ مجاز|بیشتر از حد|حداقل .+ کاراکتر|فقط .+ مجاز|فرمت/i,
    title: "محدودیت ورودی",
    problem: "مقدار واردشده خارج از محدوده مجاز سیستم است (تعداد، حجم یا فرمت).",
    solution:
      "پیام خطا را بخوانید و فایل/متن را مطابق محدودیت (حجم، تعداد، فرمت) اصلاح کنید.",
    category: "validation",
  },
  {
    match: /آپلود|upload|فایل را آپلود|ابتدا فایل/i,
    title: "مشکل آپلود",
    problem: "آپلود فایل انجام نشده یا با خطا متوقف شده است.",
    solution:
      "اتصال اینترنت را بررسی کنید، حجم و فرمت فایل را چک کنید، صفحه را رفرش کنید و دوباره آپلود کنید. اگر تکرار شد از «گزارش مشکل» استفاده کنید.",
    category: "upload",
  },
  {
    match: /ذخیره نشد|ذخیره ناموفق|ثبت .+ ناموفق|به‌روزرسانی ناموفق|حذف نشد|ساخت .+ ناموفق/i,
    title: "ذخیره‌سازی ناموفق",
    problem: "عملیات ذخیره/ثبت روی سرور کامل نشده است.",
    solution:
      "چند لحظه صبر کنید و دوباره تلاش کنید. اگر صفحه باز مانده، قبل از بستن مطمئن شوید داده از دست نرود. در صورت تکرار، از «گزارش مشکل» اطلاع دهید.",
    category: "save",
  },
  {
    match: /شبکه|network|Failed to fetch|timeout|زمان‌بندی|اتصال/i,
    title: "مشکل ارتباط",
    problem: "ارتباط با سرور برقرار نشده یا قطع شده است.",
    solution:
      "اتصال اینترنت را بررسی کنید، VPN را موقتاً خاموش کنید و صفحه را دوباره بارگذاری کنید.",
    category: "network",
  },
  {
    match: /دسترسی|مجاز نیست|permission|forbidden|401|403|وارد پنل/i,
    title: "محدودیت دسترسی",
    problem: "حساب شما برای این عملیات مجوز کافی ندارد، یا نشست شما منقضی شده است.",
    solution:
      "از سیستم خارج و دوباره وارد شوید. اگر همچنان محدودیت دارید، از مدیر سیستم دسترسی بخواهید.",
    category: "permission",
  },
  {
    match: /رمز اشتباه|ورود ناموفق|لاگین|login|احراز/i,
    title: "خطای احراز هویت",
    problem: "اطلاعات ورود درست نیست یا نشست کاربر معتبر نیست.",
    solution: "رمز عبور را با دقت وارد کنید. در صورت فراموشی رمز، با مدیر سیستم تماس بگیرید.",
    category: "auth",
  },
  {
    match: /سهمیه|quota|فضا|حجم/i,
    title: "محدودیت سهمیه",
    problem: "فضا یا سهمیه مجاز برای این عملیات پر شده است.",
    solution:
      "فایل‌های غیرضروری را حذف کنید یا حجم فایل را کم کنید. در صورت نیاز با مدیر سیستم برای افزایش سهمیه هماهنگ کنید.",
    category: "quota",
  },
  {
    match: /ZIP|دانلود/i,
    title: "مشکل دانلود",
    problem: "ساخت یا دریافت فایل دانلودی با خطا روبه‌رو شده است.",
    solution:
      "اتصال را بررسی کنید و دوباره تلاش کنید. اگر فایل‌ها زیادند، تعداد کمتری انتخاب کنید یا بعداً دوباره امتحان کنید.",
    category: "other",
  },
  {
    match: /ویدیو|کاور|پوستر|بیلبورد|تصویر/i,
    title: "مشکل رسانه",
    problem: "فایل رسانه ناقص است، لینک خارجی خراب است، یا فرمت پشتیبانی نمی‌شود.",
    solution:
      "فایل را دوباره آپلود کنید یا لینک معتبر بگذارید. برای ویدیو، کاور و خود فایل را جداگانه بررسی کنید.",
    category: "upload",
  },
  {
    match: /کمپین|campaign/i,
    title: "کمپین انتخاب نشده",
    problem: "برای این عملیات باید یک کمپین فعال انتخاب شده باشد.",
    solution: "از بالای پنل کمپین موردنظر را انتخاب کنید و دوباره اقدام کنید.",
    category: "validation",
  },
  {
    match:
      /Server Action|failed-to-find-server-action|was not found on the server|Failed to find Server Action|unexpected response was received from the server|Minified React error #418|Hydration failed/i,
    title: "نسخهٔ صفحه قدیمی است",
    problem:
      "نسخهٔ بازشده در مرورگر با نسخهٔ فعلی سرور هم‌خوان نیست (معمولاً بعد از به‌روزرسانی سایت یا قطع کوتاه ارتباط).",
    solution:
      "صفحه را با Ctrl+Shift+R (یا Cmd+Shift+R در مک) کامل رفرش کنید، یا از دکمه «بارگذاری مجدد» استفاده کنید تا نسخهٔ جدید بارگذاری شود.",
    category: "runtime",
  },
  {
    match: /Cannot read|undefined|null is not|TypeError|ReferenceError|SyntaxError|خطای زمان اجرا|Promise/i,
    title: "خطای سیستمی",
    problem: "یک خطای غیرمنتظره در اجرای صفحه رخ داده است.",
    solution:
      "صفحه را یک‌بار رفرش کنید. اگر خطا تکرار شد، از دکمه «گزارش مشکل» جزئیات را برای ادمین بفرستید.",
    category: "runtime",
  },
];

const DEFAULT_INFO: Omit<ResolvedErrorInfo, "message"> = {
  title: "خطا رخ داد",
  problem: "عملیات موردنظر کامل نشد.",
  solution:
    "پیام خطا را بخوانید، ورودی‌ها را بررسی کنید و دوباره تلاش کنید. اگر مشکل ادامه داشت، از «گزارش مشکل» به ادمین اطلاع دهید.",
  category: "other",
};

function matchesRule(message: string, rule: ErrorRule): boolean {
  if (typeof rule.match === "string") {
    return message.includes(rule.match);
  }
  return rule.match.test(message);
}

function parseDailyLimitDetails(message: string): DailyLimitErrorDetails | undefined {
  if (!/سقف مجاز بارگذاری روزانه/.test(message)) return undefined;
  const maxMatch = message.match(/حداکثر\s+(\d+)\s+(?:مورد|محتوا)/);
  const dailyMax = maxMatch ? Number(maxMatch[1]) : NaN;
  if (!Number.isFinite(dailyMax) || dailyMax <= 0) return undefined;
  const scopeMatch = message.match(/برای «([^»]+)» تکمیل شده/);
  return {
    dailyMax,
    scopeLabel: scopeMatch?.[1]?.trim() || null,
  };
}

/** Resolve a user-facing error message into title / problem / solution. */
export function resolveErrorInfo(rawMessage: unknown): ResolvedErrorInfo {
  const message =
    typeof rawMessage === "string"
      ? rawMessage.replace(/\s+/g, " ").trim()
      : rawMessage instanceof Error
        ? rawMessage.message.replace(/\s+/g, " ").trim()
        : "خطای ناشناخته";

  const safeMessage = message || "خطای ناشناخته";
  const dailyLimit = parseDailyLimitDetails(safeMessage);

  for (const rule of RULES) {
    if (matchesRule(safeMessage, rule)) {
      return {
        title: rule.title,
        problem: rule.problem,
        solution: rule.solution,
        category: rule.category,
        message: safeMessage,
        ...(dailyLimit ? { dailyLimit } : {}),
      };
    }
  }

  return {
    ...DEFAULT_INFO,
    problem: safeMessage.length <= 120 ? safeMessage : DEFAULT_INFO.problem,
    message: safeMessage,
    ...(dailyLimit ? { dailyLimit } : {}),
  };
}

export const ERROR_SOLUTION_CATEGORY_LABELS: Record<ErrorSolutionCategory, string> = {
  validation: "اعتبارسنجی",
  upload: "آپلود",
  save: "ذخیره",
  network: "شبکه",
  permission: "دسترسی",
  auth: "ورود",
  quota: "سهمیه",
  daily_limit: "محدودیت روزانه",
  runtime: "سیستمی",
  other: "سایر",
};
