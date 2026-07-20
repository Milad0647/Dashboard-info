import { NextResponse } from "next/server";
import { getAuthSession, isFullAdmin } from "@/lib/auth/get-session";
import {
  restoreFullCampaignFromZip,
  restoreUserFromZip,
} from "@/lib/services/campaign-backup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function requireFullAdmin() {
  const session = await getAuthSession();
  if (!session || !isFullAdmin(session)) return null;
  return session;
}

/**
 * Restore from a v2 backup ZIP.
 * mode=full  → wipe all campaign content and replace
 * mode=user  → wipe that user's content and replace
 */
export async function POST(request: Request) {
  if (!(await requireFullAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const campaignId =
    typeof formData.get("campaignId") === "string"
      ? String(formData.get("campaignId")).trim()
      : "";
  const mode =
    typeof formData.get("mode") === "string"
      ? String(formData.get("mode")).trim()
      : "full";
  const userId =
    typeof formData.get("userId") === "string"
      ? String(formData.get("userId")).trim()
      : "";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "فایل ZIP ارسال نشده است" }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".zip")) {
    return NextResponse.json({ error: "فقط فایل ZIP مجاز است" }, { status: 400 });
  }
  if (!campaignId) {
    return NextResponse.json({ error: "campaignId الزامی است" }, { status: 400 });
  }
  if (mode !== "full" && mode !== "user") {
    return NextResponse.json({ error: "mode باید full یا user باشد" }, { status: 400 });
  }
  if (mode === "user" && !userId) {
    return NextResponse.json(
      { error: "برای ایمپورت کاربر، userId الزامی است" },
      { status: 400 }
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    if (mode === "user") {
      const result = await restoreUserFromZip(buffer, campaignId, userId);
      return NextResponse.json(result);
    }
    const result = await restoreFullCampaignFromZip(buffer, campaignId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[backups/restore] failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Restore failed" },
      { status: 500 }
    );
  }
}
