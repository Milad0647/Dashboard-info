import * as XLSX from "xlsx";
import type { UserLeaderboardEntry } from "@/lib/city-leaderboard";
import { getUserCompanyTypeLabel } from "@/lib/user-company-types";
import { getUserRegionLabel } from "@/lib/user-regions";
import { getMediaRepublishScopeLabel } from "@/lib/scoring/scoring-policy";
import type {
  CompanyExcelSource,
  CompanySupervisionItem,
} from "@/lib/company-supervision";
import { reviewStatusLabel } from "@/lib/company-supervision";
import type {
  Billboard,
  CampaignActivity,
  CampaignFile,
  Poster,
  SocialMediaPost,
  Video,
} from "@/lib/types";

export type PerformanceExcelSortMode = "activity" | "rating" | "count";

function sortModeLabel(sortMode: PerformanceExcelSortMode): string {
  if (sortMode === "rating") return "امتیاز محتوا";
  if (sortMode === "count") return "تعداد محتوا";
  return "امتیاز فعالیت";
}

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
      ["مرتب‌سازی", sortModeLabel(sortMode)],
    ]);
    XLSX.utils.book_append_sheet(workbook, meta, "خلاصه");
  }

  const rows = entries.map((entry) => ({
    رتبه: entry.rank,
    "نام کاربر / شرکت": entry.userName,
    استان: entry.province,
    شهر: entry.city,
    "نوع شرکت": getUserCompanyTypeLabel(entry.companyType),
    منطقه: getUserRegionLabel(entry.region),
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
    { wch: 16 },
    { wch: 10 },
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

  const sheetName = sortModeLabel(sortMode);
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

function reviewLookup(items: CompanySupervisionItem[]) {
  return new Map(items.map((item) => [`${item.contentType}:${item.contentId}`, item]));
}

function reviewColumns(item: CompanySupervisionItem | undefined) {
  return {
    امتیاز: item?.score ?? "",
    "امتیاز پیشنهادی": item?.autoScore ?? "",
    "امتیاز دستی": item?.manualScore ?? "",
    "وضعیت بازبینی": reviewStatusLabel(item?.reviewStatus ?? null) ?? "—",
    "دلیل رد": item?.rejectionReason ?? "",
    "تاریخ رد": item?.rejectedAt?.slice(0, 19) ?? "",
    "تاریخ ارسال مجدد": item?.resubmittedAt?.slice(0, 19) ?? "",
    "تاریخ تایید": item?.resolvedAt?.slice(0, 19) ?? "",
    "قبلاً رد شده": item?.everRejected ? "بله" : "خیر",
    امروز: item?.isToday ? "بله" : "خیر",
  };
}

function appendSheet(
  workbook: XLSX.WorkBook,
  name: string,
  rows: Record<string, string | number | boolean | null | undefined>[]
) {
  if (rows.length === 0) return;
  const sheet = XLSX.utils.json_to_sheet(rows);
  const keys = Object.keys(rows[0] ?? {});
  sheet["!cols"] = keys.map((key) => ({ wch: Math.min(36, Math.max(12, key.length + 4)) }));
  XLSX.utils.book_append_sheet(workbook, sheet, name);
}

function billboardRows(list: Billboard[], items: CompanySupervisionItem[]) {
  const reviews = reviewLookup(items);
  return list.map((item) => ({
    عنوان: item.title,
    توضیحات: item.description ?? "",
    استان: item.province ?? item.ownerProvince ?? "",
    شهر: item.city ?? item.ownerCity ?? "",
    موقعیت: item.location ?? "",
    "تاریخ اکران": item.date ?? "",
    "بازه نمایش": item.displayDateRange ?? "",
    کد: item.code ?? "",
    دسته‌بندی: item.category ?? "",
    "نوع بیلبورد": item.billboardTypeLabel ?? "",
    "سطح کیفیت": item.qualityTierLabel ?? "",
    "نوع مکان": item.locationType ?? "",
    متراژ: item.areaSqm ?? "",
    "عرض‌دهنده": item.providerName ?? "",
    "طراحی تاییدشده": item.usesApprovedDesign ? "بله" : "خیر",
    وضعیت: item.status ?? "",
    برچسب‌ها: (item.tags ?? []).join("، "),
    یادداشت: item.notes ?? "",
    "لینک خارجی": item.externalUrl ?? "",
    "تصویر بندانگشتی": item.thumbnailUrl ?? "",
    تصویر: item.imageUrl ?? "",
    عرض: item.latitude ?? "",
    طول: item.longitude ?? "",
    منبع: item.source ?? "",
    "شناسه خارجی": item.externalId ?? "",
    "مالک / شرکت": item.ownerName ?? "",
    "ایمیل مالک": item.ownerEmail ?? "",
    منتشرشده: item.published ? "بله" : "خیر",
    "تاریخ ثبت": item.createdAt?.slice(0, 19) ?? "",
    "آخرین بروزرسانی": item.updatedAt?.slice(0, 19) ?? "",
    "تعداد دوره نمایش": item.displayPeriods?.length ?? 0,
    ...reviewColumns(reviews.get(`billboard:${item.id}`)),
  }));
}

function posterRows(list: Poster[], items: CompanySupervisionItem[]) {
  const reviews = reviewLookup(items);
  return list.map((item) => ({
    عنوان: item.title,
    توضیحات: item.description ?? "",
    طرح: item.planLabel ?? "",
    "شناسه دسته": item.categoryId ?? "",
    "مالک / شرکت": item.ownerName ?? "",
    "ایمیل مالک": item.ownerEmail ?? "",
    استان: item.ownerProvince ?? "",
    شهر: item.ownerCity ?? "",
    منتشرشده: item.published ? "بله" : "خیر",
    "تاریخ ثبت": item.createdAt?.slice(0, 19) ?? "",
    "آخرین بروزرسانی": item.updatedAt?.slice(0, 19) ?? "",
    ...reviewColumns(reviews.get(`poster:${item.id}`)),
  }));
}

function videoRows(list: Video[], items: CompanySupervisionItem[]) {
  const reviews = reviewLookup(items);
  return list.map((item) => ({
    عنوان: item.title,
    توضیحات: item.description ?? "",
    طرح: item.planLabel ?? "",
    "ژانر ویدیو": item.videoContentType ?? "",
    "شناسه دسته": item.categoryId ?? "",
    "مالک / شرکت": item.ownerName ?? "",
    "ایمیل مالک": item.ownerEmail ?? "",
    استان: item.ownerProvince ?? "",
    شهر: item.ownerCity ?? "",
    منتشرشده: item.published ? "بله" : "خیر",
    "تاریخ ثبت": item.createdAt?.slice(0, 19) ?? "",
    "آخرین بروزرسانی": item.updatedAt?.slice(0, 19) ?? "",
    ...reviewColumns(reviews.get(`video:${item.id}`)),
  }));
}

function socialRows(
  list: SocialMediaPost[],
  items: CompanySupervisionItem[],
  contentType: "social_post" | "site_publication"
) {
  const reviews = reviewLookup(items);
  return list.map((item) => ({
    عنوان: item.title,
    توضیحات: item.description ?? "",
    پلتفرم: item.platform ?? "",
    "نوع محتوا": item.contentType ?? "",
    لینک: item.link ?? "",
    "تاریخ انتشار": item.publishedDate ?? "",
    "سطح پوشش": item.mediaScope?.trim() ? getMediaRepublishScopeLabel(item.mediaScope) : "",
    بازدید: item.views ?? 0,
    لایک: item.likes ?? 0,
    کامنت: item.comments ?? 0,
    اشتراک: item.shares ?? 0,
    "تصویر کاور": item.coverImageUrl ?? "",
    رسانه: item.mediaUrl ?? "",
    "مالک / شرکت": item.ownerName ?? "",
    "ایمیل مالک": item.ownerEmail ?? "",
    استان: item.ownerProvince ?? "",
    شهر: item.ownerCity ?? "",
    منتشرشده: item.published ? "بله" : "خیر",
    "تاریخ ثبت": item.createdAt?.slice(0, 19) ?? "",
    "آخرین بروزرسانی": item.updatedAt?.slice(0, 19) ?? "",
    ...reviewColumns(reviews.get(`${contentType}:${item.id}`)),
  }));
}

function activityRows(list: CampaignActivity[], items: CompanySupervisionItem[]) {
  const reviews = reviewLookup(items);
  return list.map((item) => ({
    عنوان: item.title,
    توضیحات: item.description ?? "",
    "نوع اقدام": item.activityType ?? "",
    "تاریخ اقدام": item.activityDate ?? "",
    مکان: item.location ?? "",
    لینک: item.link ?? "",
    خلاقانه: item.isCreative ? "بله" : "خیر",
    "دامنه رسانه": item.mediaScope?.trim() ? getMediaRepublishScopeLabel(item.mediaScope) : "",
    "ژانر نشریه": item.pressContentType ?? "",
    تصویر: item.imageUrl ?? "",
    ویدیو: item.videoUrl ?? "",
    "تعداد رسانه": item.mediaItems?.length ?? 0,
    "تعداد پیوست": item.attachments?.length ?? 0,
    "مالک / شرکت": item.ownerName ?? "",
    "ایمیل مالک": item.ownerEmail ?? "",
    استان: item.ownerProvince ?? "",
    شهر: item.ownerCity ?? "",
    منتشرشده: item.published ? "بله" : "خیر",
    "تاریخ ثبت": item.createdAt?.slice(0, 19) ?? "",
    "آخرین بروزرسانی": item.updatedAt?.slice(0, 19) ?? "",
    ...reviewColumns(reviews.get(`activity:${item.id}`)),
  }));
}

function fileRows(list: CampaignFile[], items: CompanySupervisionItem[]) {
  const reviews = reviewLookup(items);
  return list.map((item) => ({
    عنوان: item.title,
    توضیحات: item.description ?? "",
    طرح: item.planLabel ?? "",
    "نام فایل": item.fileName ?? "",
    "نوع فایل": item.mimeType ?? "",
    "حجم (بایت)": item.fileSize ?? "",
    "لینک فایل": item.fileUrl ?? "",
    "مالک / شرکت": item.ownerName ?? "",
    "ایمیل مالک": item.ownerEmail ?? "",
    استان: item.ownerProvince ?? "",
    شهر: item.ownerCity ?? "",
    منتشرشده: item.published ? "بله" : "خیر",
    "تاریخ ثبت": item.createdAt?.slice(0, 19) ?? "",
    "آخرین بروزرسانی": item.updatedAt?.slice(0, 19) ?? "",
    ...reviewColumns(reviews.get(`file:${item.id}`)),
  }));
}

export function buildCompanyPerformanceExcelBuffer(input: {
  entry: UserLeaderboardEntry;
  items: CompanySupervisionItem[];
  excelSource?: CompanyExcelSource;
  campaignTitle?: string;
}): Uint8Array {
  const { entry, items, excelSource } = input;
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

  if (excelSource) {
    appendSheet(workbook, "تبلیغات محیطی", billboardRows(excelSource.billboards, items));
    appendSheet(workbook, "پوستر", posterRows(excelSource.posters, items));
    appendSheet(workbook, "ویدیو", videoRows(excelSource.videos, items));
    appendSheet(
      workbook,
      "شبکه اجتماعی",
      socialRows(excelSource.socialPosts, items, "social_post")
    );
    appendSheet(
      workbook,
      "انتشار سایت",
      socialRows(excelSource.sitePublications, items, "site_publication")
    );
    appendSheet(
      workbook,
      "اقدام",
      activityRows([...excelSource.activities, ...excelSource.pressPublications], items)
    );
    appendSheet(workbook, "فایل", fileRows(excelSource.files, items));
  }

  const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as number[];
  return new Uint8Array(bytes);
}

export function downloadCompanyPerformanceExcel(input: {
  entry: UserLeaderboardEntry;
  items: CompanySupervisionItem[];
  excelSource?: CompanyExcelSource;
  campaignTitle?: string;
  campaignSlug?: string;
}) {
  const bytes = buildCompanyPerformanceExcelBuffer(input);
  const slug = input.campaignSlug?.trim() || "campaign";
  const safeName = input.entry.userName.replace(/[\\/:*?"<>|]+/g, "-").slice(0, 40) || "company";
  const date = new Date().toISOString().slice(0, 10);
  downloadWorkbookBytes(bytes, `company-${safeName}-${slug}-${date}.xlsx`);
}
