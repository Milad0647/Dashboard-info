import { PDFParse } from "pdf-parse";
import type { BroadcastReportSummary } from "@/lib/types";

const STATUS_LABELS = [
  "قبل سکاب",
  "ابتدا مدیت",
  "پایان مدیت",
  "آماده مدیت",
  "اول هفته پایان مدیت",
  "بین سکاب",
  "۱ کیرب دیرباه",
  "۲ کیرب دیرباه",
] as const;

const QUALITY_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /ﻞﺒﻗ.*ﺲکﺎﺑ|قبل\s*سکاب/i, label: "قبل سکاب" },
  { pattern: /اﺪﺘﺑا.*ﻢﯾﺪﻘت|ابتدا\s*مدیت/i, label: "ابتدا مدیت" },
  { pattern: /ﺎﻬﺘﻧا.*ﻢﯾﺪﻘت|پایان\s*مدیت/i, label: "پایان مدیت" },
  { pattern: /ﻪﻣادا.*ﻢﯾﺪﻘت|آماده\s*مدیت/i, label: "آماده مدیت" },
  {
    pattern: /اول.*ﻪﻤﯿﻧ.*ﻢﯾﺪﻘت|اول\s*هفته\s*پایان\s*مدیت/i,
    label: "اول هفته پایان مدیت",
  },
  { pattern: /ﻦیﺑ.*ﺲکﺎﺑ|بین\s*سکاب/i, label: "بین سکاب" },
  { pattern: /1\s*کﯾﺮﺑ|۱\s*کیرب/i, label: "۱ کیرب دیرباه" },
  { pattern: /2\s*کﯾﺮﺑ|۲\s*کیرب/i, label: "۲ کیرب دیرباه" },
  { pattern: /وﺮیﻧ.*وزارت|وزارت\s*نیرو/i, label: "وزارت نیرو" },
];

const TAB_NUMERIC_ROW = /^(.+)\t([\d۰-۹]+)$/;
const FOOTER_PATTERN =
  /^(?:\d{1,2}\/\d{1,2}\/\d{2,4}|--\s*\d+\s+of\s+\d+\s+--|\d+\.\d+\.\d+\.\d+)/i;

function toWesternDigits(value: string): string {
  return value.replace(/[۰-۹]/g, (char) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(char)));
}

function parseNumber(value: string): number | null {
  const normalized = toWesternDigits(value.trim());
  if (!/^\d+$/.test(normalized)) return null;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function isFooterLine(line: string): boolean {
  if (FOOTER_PATTERN.test(line)) return true;
  if (line.includes("ﻢﺘﯾآ ﻖیﻗان دﻮﻨﻋ")) return true;
  if (line.includes("شﯾﺎپ وردﺑﺷدا") || line.includes("شﯾﺎپ ردﻮﺒﺷدا")) return true;
  return false;
}

function isSectionHeader(line: string): boolean {
  return (
    line.includes("کﯿکﻔﺗ") ||
    line.includes("ادﺪﻌﺗ") ||
    line.includes("تﺎﯿﺋﺰﺟ") ||
    line.includes("داده: ﻊﺒﻨﻣ")
  );
}

function mapQualityLabel(raw: string): string {
  const trimmed = raw.trim();
  for (const { pattern, label } of QUALITY_PATTERNS) {
    if (pattern.test(trimmed)) return label;
  }
  return trimmed;
}

function extractClientName(lines: string[]): string | undefined {
  const clientLine = lines.find((line) => line.includes(":") && line.length < 80);
  if (!clientLine) return undefined;

  const afterColon = clientLine.split(":").pop()?.trim();
  if (!afterColon) return undefined;

  if (afterColon.includes("وزارت") || afterColon.includes("وﺮیﻧ")) {
    return "وزارت نیرو";
  }

  return afterColon;
}

function extractReportDateTime(lines: string[]): string | undefined {
  const dateLine = lines.find((line) => /[۰-۹\d]{4}\/[۰-۹\d]{1,2}\/[۰-۹\d]{1,2}/.test(line));
  if (!dateLine) return undefined;

  const match = dateLine.match(/([۰-۹\d]{4}\/[۰-۹\d]{1,2}\/[۰-۹\d]{1,2})/);
  if (!match) return undefined;

  const timeMatch = dateLine.match(/([۰-۹\d]{1,2}:[۰-۹\d]{2}:[۰-۹\d]{2})/);
  const datePart = toWesternDigits(match[1]);
  return timeMatch ? `${datePart} ${toWesternDigits(timeMatch[1])}` : datePart;
}

function extractKpis(lines: string[]): {
  totalBillboards?: number;
  totalCities?: number;
  temporaryCount?: number;
} {
  const numericLines = lines
    .map((line) => ({ line, value: parseNumber(line) }))
    .filter((entry): entry is { line: string; value: number } => entry.value != null);

  if (numericLines.length < 3) {
    return {};
  }

  return {
    totalBillboards: numericLines[0]?.value,
    totalCities: numericLines[1]?.value,
    temporaryCount: numericLines[2]?.value,
  };
}

function extractStatusBreakdown(lines: string[]) {
  const statusStart = lines.findIndex(
    (line) => line.includes("ﺶﺨپ ﺖﯿﻌﻗﻮﻣ") && line.includes("کﯿکﻔﺗ")
  );
  const cityStart = lines.findIndex((line) => line.includes("زیﺎﺑ سﺎﺳا"));

  if (statusStart === -1) return [];

  const end = cityStart === -1 ? lines.length : cityStart;
  const rows: BroadcastReportSummary["statusBreakdown"] = [];

  for (let index = statusStart + 1; index < end; index += 1) {
    const line = lines[index];
    if (isFooterLine(line) || isSectionHeader(line)) continue;

    const match = TAB_NUMERIC_ROW.exec(line);
    if (!match) continue;

    const count = parseNumber(match[2]);
    if (count == null) continue;

    rows.push({
      label: STATUS_LABELS[rows.length] ?? match[1].trim(),
      count,
      rawLabel: match[1].trim(),
    });
  }

  return rows;
}

function extractCityBreakdown(lines: string[]) {
  const cityStart = lines.findIndex((line) => line.includes("زیﺎﺑ سﺎﺳا"));
  const billboardStart = lines.findIndex((line) => line.includes("ﺎﻫﺶﺨپ ﻞﻣﺎک"));

  if (cityStart === -1) return [];

  const end = billboardStart === -1 ? lines.length : billboardStart;
  const rows: NonNullable<BroadcastReportSummary["cityBreakdown"]> = [];

  for (let index = cityStart + 1; index < end; index += 1) {
    const line = lines[index];
    if (isFooterLine(line) || isSectionHeader(line)) continue;

    const match = TAB_NUMERIC_ROW.exec(line);
    if (!match) continue;

    const count = parseNumber(match[2]);
    if (count == null || count > 20) continue;

    rows.push({
      name: match[1].trim(),
      count,
      rawName: match[1].trim(),
    });
  }

  return rows;
}

function extractBillboards(lines: string[]) {
  const billboardStart = lines.findIndex((line) => line.includes("ﺎﻫﺶﺨپ ﻞﻣﺎک"));
  if (billboardStart === -1) return [];

  const rows: NonNullable<BroadcastReportSummary["billboards"]> = [];
  let pendingLocation: string | null = null;
  let pendingQuality: string | null = null;

  const pushPair = (location: string, quality: string) => {
    rows.push({
      location,
      quality,
      rawLocation: location,
      rawQuality: quality,
    });
  };

  for (let index = billboardStart + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (isFooterLine(line) || isSectionHeader(line)) continue;

    if (line.includes("\t")) {
      const [left, right] = line.split("\t");
      if (!left || !right) continue;
      if (parseNumber(right) != null) continue;

      const quality = mapQualityLabel(left);
      if (pendingLocation) {
        pushPair(pendingLocation, quality);
        pendingLocation = null;
      } else {
        pendingQuality = quality;
      }
      continue;
    }

    const location = line.trim();
    if (pendingQuality) {
      pushPair(location, pendingQuality);
      pendingQuality = null;
    } else {
      pendingLocation = location;
    }
  }

  return rows;
}

function cleanLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !isFooterLine(line));
}

export async function parseBroadcastPdf(buffer: Buffer): Promise<BroadcastReportSummary> {
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  const lines = cleanLines(result.text);

  const kpis = extractKpis(lines);
  const statusBreakdown = extractStatusBreakdown(lines);
  const cityBreakdown = extractCityBreakdown(lines);
  const billboards = extractBillboards(lines);

  return {
    ...kpis,
    clientName: extractClientName(lines),
    reportDateTime: extractReportDateTime(lines),
    statusBreakdown,
    cityBreakdown,
    billboards,
    parsedAt: new Date().toISOString(),
  };
}

export async function parseBroadcastPdfFromUrl(pdfUrl: string): Promise<BroadcastReportSummary> {
  const { readFile } = await import("fs/promises");
  const { resolveUploadFilePath } = await import("@/lib/uploads");

  const match = /\/api\/files\/([^/?#]+)/.exec(pdfUrl);
  if (!match?.[1]) {
    throw new Error("آدرس PDF معتبر نیست");
  }

  const filePath = resolveUploadFilePath(decodeURIComponent(match[1]));
  const buffer = await readFile(filePath);
  return parseBroadcastPdf(buffer);
}
