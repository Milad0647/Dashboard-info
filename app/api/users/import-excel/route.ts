import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getAdminSessionCookieName } from "@/lib/auth/admin-session";
import { parseSessionTokenSync } from "@/lib/auth/session-node";
import { isFullAdmin } from "@/lib/auth/get-session";
import {
  defaultContributorPermissions,
  normalizeContributorPermissions,
} from "@/lib/contributor-permissions";
import { pgImportUsersFromExcel } from "@/lib/db/repository-extended";
import { parseUsersExcel } from "@/lib/services/users-excel-parser";
import { isPostgresConfigured } from "@/lib/utils";

const MAX_EXCEL_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  if (!isPostgresConfigured()) {
    return NextResponse.json({ error: "Database required" }, { status: 503 });
  }

  const cookieStore = await cookies();
  const session = parseSessionTokenSync(cookieStore.get(getAdminSessionCookieName())?.value);
  if (!session || !isFullAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const campaignIdsRaw = String(formData.get("campaignIds") ?? "[]");
  const permissionsRaw = String(formData.get("permissions") ?? "{}");
  const updateExisting = String(formData.get("updateExisting") ?? "true") === "true";

  let campaignIds: string[] = [];
  try {
    campaignIds = JSON.parse(campaignIdsRaw) as string[];
  } catch {
    return NextResponse.json({ error: "campaignIds نامعتبر است" }, { status: 400 });
  }

  if (!Array.isArray(campaignIds) || campaignIds.length === 0) {
    return NextResponse.json({ error: "حداقل یک کمپین انتخاب کنید" }, { status: 400 });
  }

  let permissions = defaultContributorPermissions();
  try {
    permissions = normalizeContributorPermissions(JSON.parse(permissionsRaw));
  } catch {
    return NextResponse.json({ error: "permissions نامعتبر است" }, { status: 400 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "فایلی ارسال نشده است" }, { status: 400 });
  }

  const fileName = file.name.toLowerCase();
  if (!fileName.endsWith(".xlsx") && !fileName.endsWith(".xls")) {
    return NextResponse.json({ error: "فقط فایل Excel (.xlsx / .xls) مجاز است" }, { status: 400 });
  }

  if (file.size > MAX_EXCEL_BYTES) {
    return NextResponse.json({ error: "حجم فایل بیش از حد مجاز است" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const rows = parseUsersExcel(buffer);

    if (rows.length === 0) {
      return NextResponse.json({ error: "هیچ ردیف معتبری در فایل Excel پیدا نشد" }, { status: 400 });
    }

    const result = await pgImportUsersFromExcel({
      rows,
      campaignIds,
      campaignPermissions: permissions,
      updateExisting,
    });

    revalidatePath("/admin/users");
    revalidatePath("/admin");

    return NextResponse.json({ success: true, ...result, total: rows.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "خطا در خواندن فایل Excel";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
