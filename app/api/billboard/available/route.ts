import { NextResponse } from "next/server";
import { getAuthSession, isFullAdmin } from "@/lib/auth/get-session";
import { pgGetCampaignById } from "@/lib/db/repository";
import { fetchAvailableSystemBillboards } from "@/lib/services/billboard-assignment-api";

export async function GET(request: Request) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const externalCampaignId = searchParams.get("externalCampaignId")?.trim();
  if (!externalCampaignId) {
    return NextResponse.json({ error: "شناسه کمپین خارجی الزامی است" }, { status: 400 });
  }

  if (!isFullAdmin(session)) {
    return NextResponse.json({ error: "فقط ادمین به لیست بیلبوردها دسترسی دارد" }, { status: 403 });
  }

  const campaignId = searchParams.get("campaignId")?.trim();
  if (campaignId) {
    const settings = await pgGetCampaignById(campaignId);
    if (!settings) {
      return NextResponse.json({ error: "کمپین یافت نشد" }, { status: 404 });
    }
  }

  try {
    const billboards = await fetchAvailableSystemBillboards(externalCampaignId);
    return NextResponse.json({ success: true, billboards });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "دریافت بیلبوردها ناموفق بود" },
      { status: 400 }
    );
  }
}
