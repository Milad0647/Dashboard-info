import * as XLSX from "xlsx";
import type { UserLeaderboardEntry } from "@/lib/city-leaderboard";
import type { CompanySupervisionItem } from "@/lib/company-supervision";
import { reviewStatusLabel } from "@/lib/company-supervision";

export type PerformanceExcelSortMode = "activity" | "rating";

function roundArea(value: number): number {
  return Math.round(value * 100) / 100;
}

function downloadWorkbookBytes(bytes: Uint8Array, filename: string) {
  const blob = new Blob([Uint8Array.from(bytes)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** Build an .xlsx file as bytes for the performance overview report. */
export function buildPerformanceExcelBuffer(
  entries: UserLeaderboardEntry[],
  options?: {
    campaignTitle?: string;
    sortMode?: PerformanceExcelSortMode;
  }
): Uint8Array {
  const sortMode = options?.sortMode ?? "activity";
  const workbook = XLSX.utils.book_new();

  if (options?.campaignTitle) {
    const meta = XLSX.utils.aoa_to_sheet([
      ["کمپین", options.campaignTitle],
      ["تاریخ گزارش", new Date().toISOString().slice(0, 10)],
      ["تعداد کاربران", entries.length],
      ["مرتب‌سازی", sortMode === "rating" ? "امتیاز محتوا" : "امتیاز فعالیت"],
    ]);
    XLSX.utils.book_append_sheet(workbook, meta, "خلاصه");
  }

  const rows = entries.map((entry) => ({
    رتبه: entry.rank,
    "نام کاربر / شرکت": entry.userName,
    استان: entry.province,
    "تبلیغات محیطی": entry.billboards,
    متراژ: roundArea(entry.totalAreaSqm),
    پوستر: entry.posters,
    ویدیو: entry.videos,
    "شبکه اجتماعی": entry.socialPosts,
    "انتشار سایت": entry.sitePublications,
    اقدام: entry.activities,
    فایل: entry.files,
    "محتوای امروز": entry.todayUploads,
    "جمع محتوا": entry.totalUploads,
    "امتیاز فعالیت": entry.score,
    "امتیاز محتوا": entry.ratingScore,
    "امتیاز در انتظار": entry.pendingScore ?? 0,
  }));

  const sheet = XLSX.utils.json_to_sheet(rows);
  sheet["!cols"] = [
    { wch: 8 },
    { wch: 28 },
    { wch: 14 },
    { wch: 14 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 14 },
    { wch: 12 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
  ];

  const sheetName = sortMode === "rating" ? "امتیاز محتوا" : "امتیاز فعالیت";
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName);

  const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as number[];
  return new Uint8Array(bytes);
}

export function downloadPerformanceExcel(
  entries: UserLeaderboardEntry[],
  options?: {
    campaignTitle?: string;
    campaignSlug?: string;
    sortMode?: PerformanceExcelSortMode;
  }
) {
  const bytes = buildPerformanceExcelBuffer(entries, options);
  const slug = options?.campaignSlug?.trim() || "campaign";
  const date = new Date().toISOString().slice(0, 10);
  downloadWorkbookBytes(bytes, `performance-${slug}-${date}.xlsx`);
}

const COMPANY_SHEET_GROUPS: {
  sheetName: string;
  match: (item: CompanySupervisionItem) => boolean;
}[] = [
  { sheetName: "تبلیغات محیطی", match: (item) => item.contentType === "billboard" },
  { sheetName: "پوستر", match: (item) => item.contentType === "poster" },
  { sheetName: "ویدیو", match: (item) => item.contentType === "video" },
  { sheetName: "شبکه اجتماعی", match: (item) => item.contentType === "social_post" },
  { sheetName: "انتشار سایت", match: (item) => item.contentType === "site_publication" },
  { sheetName: "اقدام", match: (item) => item.contentType === "activity" },
  { sheetName: "فایل", match: (item) => item.contentType === "file" },
];

function companyItemRows(items: CompanySupervisionItem[]) {
  return items.map((item) => ({
    عنوان: item.title,
    نوع: item.typeLabel,
    تاریخ: item.createdAt?.slice(0, 10) ?? "",
    امتیاز: item.score ?? "",
    "امتیاز پیشنهادی": item.autoScore ?? "",
    "وضعیت بازبینی": reviewStatusLabel(item.reviewStatus) ?? "—",
    "دلیل رد": item.rejectionReason ?? "",
    منتشرشده: item.published ? "بله" : "خیر",
    امروز: item.isToday ? "بله" : "خیر",
  }));
}

export function buildCompanyPerformanceExcelBuffer(input: {
  entry: UserLeaderboardEntry;
  items: CompanySupervisionItem[];
  campaignTitle?: string;
}): Uint8Array {
  const { entry, items } = input;
  const workbook = XLSX.utils.book_new();

  const summary = XLSX.utils.aoa_to_sheet([
    ["کمپین", input.campaignTitle ?? ""],
    ["تاریخ گزارش", new Date().toISOString().slice(0, 10)],
    ["نام کاربر / شرکت", entry.userName],
    ["استان", entry.province],
    ["رتبه", entry.rank],
    ["جمع محتوا", entry.totalUploads],
    ["محتوای امروز", entry.todayUploads],
    ["امتیاز فعالیت", entry.score],
    ["امتیاز محتوا", entry.ratingScore],
    ["امتیاز در انتظار", entry.pendingScore ?? 0],
    ["امتیاز اکران محیطی", entry.billboardScore],
    ["امتیاز تولید پوستر", entry.posterScore],
    ["امتیاز تولید ویدئو", entry.videoScore],
    ["امتیاز نشر و بازنشر", entry.socialScore],
    [],
    ["بخش", "تعداد"],
    ["تبلیغات محیطی", entry.billboards],
    ["متراژ", roundArea(entry.totalAreaSqm)],
    ["پوستر", entry.posters],
    ["ویدیو", entry.videos],
    ["شبکه اجتماعی", entry.socialPosts],
    ["انتشار سایت", entry.sitePublications],
    ["اقدام", entry.activities],
    ["فایل", entry.files],
  ]);
  summary["!cols"] = [{ wch: 22 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(workbook, summary, "خلاصه");

  for (const group of COMPANY_SHEET_GROUPS) {
    const groupItems = items.filter(group.match);
    if (groupItems.length === 0) continue;
    const sheet = XLSX.utils.json_to_sheet(companyItemRows(groupItems));
    sheet["!cols"] = [
      { wch: 32 },
      { wch: 14 },
      { wch: 12 },
      { wch: 10 },
      { wch: 14 },
      { wch: 18 },
      { wch: 28 },
      { wch: 10 },
      { wch: 8 },
    ];
    XLSX.utils.book_append_sheet(workbook, sheet, group.sheetName);
  }

  const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as number[];
  return new Uint8Array(bytes);
}

export function downloadCompanyPerformanceExcel(input: {
  entry: UserLeaderboardEntry;
  items: CompanySupervisionItem[];
  campaignTitle?: string;
  campaignSlug?: string;
}) {
  const bytes = buildCompanyPerformanceExcelBuffer(input);
  const slug = input.campaignSlug?.trim() || "campaign";
  const safeName = input.entry.userName.replace(/[\\/:*?"<>|]+/g, "-").slice(0, 40) || "company";
  const date = new Date().toISOString().slice(0, 10);
  downloadWorkbookBytes(bytes, `company-${safeName}-${slug}-${date}.xlsx`);
}
