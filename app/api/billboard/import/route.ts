import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAuthSession, isFullAdmin } from "@/lib/auth/get-session";
import { getExternalCampaignSlug } from "@/lib/billboards";
import { pgGetCampaignById } from "@/lib/db/repository";
import { pgGetAllUsers } from "@/lib/db/repository-extended";
import { importIntegrationBillboards } from "@/lib/services/billboard-integration-import";
import { isPostgresConfigured } from "@/lib/utils";
import type { Billboard } from "@/lib/types";

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session || !isFullAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isPostgresConfigured()) {
    return NextResponse.json({ error: "Database required" }, { status: 503 });
  }

  let body: { campaignId?: string; existingBillboards?: Billboard[] };
  try {
    body = (await request.json()) as { campaignId?: string; existingBillboards?: Billboard[] };
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const campaignId = body.campaignId?.trim();
  if (!campaignId) {
    return NextResponse.json({ error: "شناسه کمپین الزامی است" }, { status: 400 });
  }

  const settings = await pgGetCampaignById(campaignId);
  if (!settings) {
    return NextResponse.json({ error: "کمپین یافت نشد" }, { status: 404 });
  }

  const externalCampaignSlug = getExternalCampaignSlug(settings);
  if (!externalCampaignSlug) {
    return NextResponse.json(
      { error: "اسلاگ کمپین map-bilboard در تنظیمات کمپین تنظیم نشده است" },
      { status: 400 }
    );
  }

  try {
    const users = await pgGetAllUsers();
    const result = await importIntegrationBillboards({
      campaignId,
      externalCampaignSlug,
      users,
      existingBillboards: body.existingBillboards ?? [],
    });

    revalidatePath("/admin/billboards");
    revalidatePath("/");

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "واردات از API ناموفق بود" },
      { status: 400 }
    );
  }
}
