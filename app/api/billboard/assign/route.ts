import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAuthSession, isFullAdmin } from "@/lib/auth/get-session";
import { pgGetCampaignById } from "@/lib/db/repository";
import {
  addCampaignBillboardDesign,
  attachBillboardToCampaign,
  type BillboardDisplayPeriodInput,
} from "@/lib/services/billboard-assignment-api";

function parsePeriods(formData: FormData): BillboardDisplayPeriodInput[] {
  const raw = formData.get("periods");
  if (typeof raw !== "string" || !raw.trim()) return [];

  const parsed = JSON.parse(raw) as Array<{
    title?: string;
    startDate: string;
    endDate: string;
    sortOrder: number;
    imageKey?: string;
    billboardImageKey?: string;
  }>;

  return parsed.map((period, index) => ({
    title: period.title,
    startDate: period.startDate,
    endDate: period.endDate,
    sortOrder: period.sortOrder ?? index,
    image: period.imageKey ? (formData.get(period.imageKey) as File | null) : null,
    billboardImage: period.billboardImageKey
      ? (formData.get(period.billboardImageKey) as File | null)
      : null,
  }));
}

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session || !isFullAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const campaignId = String(formData.get("campaignId") ?? "").trim();
  const externalCampaignId = String(formData.get("externalCampaignId") ?? "").trim();
  const billboardId = String(formData.get("billboard_id") ?? "").trim();

  if (!campaignId || !externalCampaignId || !billboardId) {
    return NextResponse.json({ error: "اطلاعات ورودی ناقص است" }, { status: 400 });
  }

  const settings = await pgGetCampaignById(campaignId);
  if (!settings) {
    return NextResponse.json({ error: "کمپین یافت نشد" }, { status: 404 });
  }

  const displayStart = String(formData.get("display_start") ?? "").trim() || null;
  const displayEnd = String(formData.get("display_end") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const executionImage = formData.get("execution_image");
  const executionBlob =
    executionImage instanceof File && executionImage.size > 0 ? executionImage : null;

  try {
    const periods = parsePeriods(formData);
    const assignmentId = await attachBillboardToCampaign({
      externalCampaignId,
      billboardId,
      displayStart,
      displayEnd,
      notes,
      executionImage: executionBlob,
    });

    for (const period of periods) {
      await addCampaignBillboardDesign({
        externalCampaignId,
        assignmentId,
        period,
      });
    }

    revalidatePath("/admin/billboards");
    revalidatePath("/");

    return NextResponse.json({ success: true, assignmentId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "اتصال بیلبورد ناموفق بود" },
      { status: 400 }
    );
  }
}
