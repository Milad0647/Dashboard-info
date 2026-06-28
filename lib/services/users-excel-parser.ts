import * as XLSX from "xlsx";
import { parseCompanyLocation } from "@/lib/services/company-location-parser";

export interface ParsedUserImportRow {
  companyName: string;
  username: string;
  password: string;
  province: string | null;
  city: string | null;
}

function normalizeKey(key: string): string {
  return key.trim().toLowerCase().replace(/\s+/g, "_");
}

function asString(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function pickValue(row: Record<string, unknown>, keys: string[]): unknown {
  const normalized = Object.fromEntries(
    Object.entries(row).map(([key, value]) => [normalizeKey(key), value])
  );

  for (const key of keys) {
    const value = normalized[normalizeKey(key)];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }

  return undefined;
}

function mapObjectRow(row: Record<string, unknown>): ParsedUserImportRow | null {
  const companyName = asString(
    pickValue(row, ["نام شرکت", "company", "company_name", "name"])
  );
  const username = asString(
    pickValue(row, ["نام کاربری", "username", "user", "login"])
  );
  const password = asString(
    pickValue(row, ["رمز ورود", "رمز عبور", "password", "pass"])
  );

  if (!companyName || !username || !password) return null;

  const location = parseCompanyLocation(companyName);
  return {
    companyName,
    username,
    password,
    province: location.province,
    city: location.city,
  };
}

function mapArrayRow(cells: unknown[]): ParsedUserImportRow | null {
  const companyName = asString(cells[0]);
  const username = asString(cells[1]);
  const password = asString(cells[2]);

  if (!companyName || !username || !password) return null;

  const location = parseCompanyLocation(companyName);
  return {
    companyName,
    username,
    password,
    province: location.province,
    city: location.city,
  };
}

function isHeaderRow(cells: unknown[]): boolean {
  const joined = cells.map((cell) => asString(cell)).join(" ");
  return joined.includes("نام شرکت") || joined.includes("نام کاربری");
}

export function parseUsersExcel(buffer: Buffer): ParsedUserImportRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });

  const rows: ParsedUserImportRow[] = [];

  for (const line of matrix) {
    if (!Array.isArray(line)) continue;
    if (isHeaderRow(line)) continue;
    const parsed = mapArrayRow(line);
    if (parsed) rows.push(parsed);
  }

  if (rows.length > 0) {
    return rows;
  }

  const objectRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  for (const row of objectRows) {
    const parsed = mapObjectRow(row);
    if (parsed) rows.push(parsed);
  }

  return rows;
}
