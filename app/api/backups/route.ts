import { NextResponse } from "next/server";
import { getAuthSession, isFullAdmin } from "@/lib/auth/get-session";
import { getLastDailyBackupDay } from "@/lib/services/daily-backup-state";
import { getTehranCalendarDateIso } from "@/lib/safe-dates";
import {
  createStoredCampaignBackup,
  listStoredBackups,
} from "@/lib/services/stored-backup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function requireFullAdmin() {
  const session = await getAuthSession();
  if (!session || !isFullAdmin(session)) return null;
  return session;
}

/** List stored backup ZIP files on the server. */
export async function GET(request: Request) {
  if (!(await requireFullAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const campaignSlug = searchParams.get("campaignSlug")?.trim() || undefined;
    const [backups, lastDailyBackupDay] = await Promise.all([
      listStoredBackups(campaignSlug),
      getLastDailyBackupDay(),
    ]);
    return NextResponse.json({
      backups,
      lastDailyBackupDay,
      tehranDay: getTehranCalendarDateIso(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list backups";
    console.error("[backups] list failed", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Create a campaign backup ZIP and store it on the server for later download. */
export async function POST(request: Request) {
  if (!(await requireFullAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let campaignId = "";
  let userId: string | undefined;
  try {
    const body = (await request.json()) as { campaignId?: string; userId?: string };
    campaignId = body.campaignId?.trim() ?? "";
    userId = body.userId?.trim() || undefined;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!campaignId) {
    return NextResponse.json({ error: "campaignId is required" }, { status: 400 });
  }

  try {
    const result = await createStoredCampaignBackup(campaignId, { userId });
    return NextResponse.json({
      success: true,
      backup: result,
      warning:
        result.skippedFiles > 0
          ? `${result.skippedFiles} فایل رسانه‌ای روی دیسک پیدا نشد یا خوانده نشد (در skipped.json ثبت شد).`
          : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Backup failed";
    console.error("[backups] create failed", error);
    const status = message === "Campaign not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
