import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAdminSessionCookieName } from "@/lib/auth/admin-session";
import { isFullAdmin } from "@/lib/auth/get-session";
import { parseSessionTokenSync } from "@/lib/auth/session-node";
import {
  createStoredCampaignBackup,
  listStoredBackups,
} from "@/lib/services/stored-backup";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function requireFullAdmin() {
  const cookieStore = await cookies();
  const session = parseSessionTokenSync(
    cookieStore.get(getAdminSessionCookieName())?.value
  );
  if (!session || !isFullAdmin(session)) return null;
  return session;
}

/** List stored backup ZIP files on the server. */
export async function GET(request: Request) {
  if (!(await requireFullAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const campaignSlug = searchParams.get("campaignSlug")?.trim() || undefined;
  const backups = await listStoredBackups(campaignSlug);

  return NextResponse.json({ backups });
}

/** Create a campaign backup ZIP and store it on the server for later download. */
export async function POST(request: Request) {
  if (!(await requireFullAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let campaignId = "";
  try {
    const body = (await request.json()) as { campaignId?: string };
    campaignId = body.campaignId?.trim() ?? "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!campaignId) {
    return NextResponse.json({ error: "campaignId is required" }, { status: 400 });
  }

  try {
    const result = await createStoredCampaignBackup(campaignId);
    return NextResponse.json({ success: true, backup: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Backup failed";
    const status = message === "Campaign not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
