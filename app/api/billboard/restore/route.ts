import { NextResponse } from "next/server";
import { getAuthSession, isFullAdmin } from "@/lib/auth/get-session";
import { pgGetAllUsers } from "@/lib/db/repository-extended";
import { pgGetCampaignById } from "@/lib/db/repository";
import { getExternalCampaignSlug } from "@/lib/billboards";
import { importMapBilboardBackupZip } from "@/lib/services/map-bilboard-backup";
import { isPostgresConfigured } from "@/lib/utils";

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session || !isFullAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isPostgresConfigured()) {
    return NextResponse.json({ error: "Database required" }, { status: 503 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const campaignId = String(formData.get("campaignId") ?? "").trim();

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "فایل ZIP ارسال نشده است" }, { status: 400 });
  }

  if (!campaignId) {
    return NextResponse.json({ error: "شناسه کمپین الزامی است" }, { status: 400 });
  }

  const settings = await pgGetCampaignById(campaignId);
  if (!settings) {
    return NextResponse.json({ error: "کمپین یافت نشد" }, { status: 404 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const users = await pgGetAllUsers();
    const result = await importMapBilboardBackupZip({
      buffer,
      campaignId,
      externalCampaignSlug: getExternalCampaignSlug(settings),
      users,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ورود پشتیبان ناموفق بود" },
      { status: 400 }
    );
  }
}
