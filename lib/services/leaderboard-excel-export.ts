import * as XLSX from "xlsx";
import type {
  ProvinceLeaderboardEntry,
  UserLeaderboardEntry,
} from "@/lib/city-leaderboard";

const METRIC_HEADERS = [
  "رتبه",
  "امتیاز فعالیت",
  "امتیاز محتوا",
  "تعداد محتوا",
  "آپلود امروز",
  "تبلیغات محیطی",
  "متراژ",
  "پوستر",
  "ویدیو",
  "شبکه اجتماعی",
  "انتشار سایت",
  "اقدام",
  "فایل",
] as const;

function metricsRow(entry: ProvinceLeaderboardEntry | UserLeaderboardEntry): (string | number)[] {
  return [
    entry.rank,
    entry.score,
    entry.ratingScore,
    entry.totalUploads,
    entry.todayUploads,
    entry.billboards,
    entry.totalAreaSqm,
    entry.posters,
    entry.videos,
    entry.socialPosts,
    entry.sitePublications,
    entry.activities,
    entry.files,
  ];
}

function buildProvinceSheet(entries: ProvinceLeaderboardEntry[]): XLSX.WorkSheet {
  const rows: (string | number)[][] = [["رتبه", "استان", ...METRIC_HEADERS.slice(1)]];

  for (const entry of entries) {
    rows.push([entry.rank, entry.province, ...metricsRow(entry).slice(1)]);
  }

  return XLSX.utils.aoa_to_sheet(rows);
}

function buildUserSheet(entries: UserLeaderboardEntry[]): XLSX.WorkSheet {
  const rows: (string | number)[][] = [["رتبه", "شرکت / کاربر", "استان", ...METRIC_HEADERS.slice(1)]];

  for (const entry of entries) {
    rows.push([entry.rank, entry.userName, entry.province, ...metricsRow(entry).slice(1)]);
  }

  return XLSX.utils.aoa_to_sheet(rows);
}

function sanitizeFilenamePart(value: string): string {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

export function buildLeaderboardExcelFilename(campaignTitle: string): string {
  const title = sanitizeFilenamePart(campaignTitle) || "campaign";
  const date = new Date().toISOString().slice(0, 10);
  return `leaderboard-${title}-${date}.xlsx`;
}

export function downloadLeaderboardExcel(input: {
  campaignTitle: string;
  provinces: ProvinceLeaderboardEntry[];
  users: UserLeaderboardEntry[];
  ratingUsers: UserLeaderboardEntry[];
}): void {
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, buildProvinceSheet(input.provinces), "بر اساس استان");
  XLSX.utils.book_append_sheet(workbook, buildUserSheet(input.users), "بر اساس کاربر");
  XLSX.utils.book_append_sheet(workbook, buildUserSheet(input.ratingUsers), "بر اساس امتیاز");

  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = buildLeaderboardExcelFilename(input.campaignTitle);
  link.click();
  URL.revokeObjectURL(blobUrl);
}
