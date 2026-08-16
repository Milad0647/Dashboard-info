import * as XLSX from "xlsx";
import type { UserLeaderboardEntry } from "@/lib/city-leaderboard";

export type PerformanceExcelSortMode = "activity" | "rating";

function roundArea(value: number): number {
  return Math.round(value * 100) / 100;
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
  ];

  const workbook = XLSX.utils.book_new();
  const sheetName = sortMode === "rating" ? "امتیاز محتوا" : "امتیاز فعالیت";
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName);

  if (options?.campaignTitle) {
    const meta = XLSX.utils.aoa_to_sheet([
      ["کمپین", options.campaignTitle],
      ["تاریخ گزارش", new Date().toISOString().slice(0, 10)],
      ["تعداد کاربران", entries.length],
      ["مرتب‌سازی", sortMode === "rating" ? "امتیاز محتوا" : "امتیاز فعالیت"],
    ]);
    XLSX.utils.book_append_sheet(workbook, meta, "خلاصه");
  }

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
  const blob = new Blob([Uint8Array.from(bytes)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const slug = options?.campaignSlug?.trim() || "campaign";
  const date = new Date().toISOString().slice(0, 10);
  anchor.href = url;
  anchor.download = `performance-${slug}-${date}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
