import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAuthSession } from "@/lib/auth/get-session";
import { getExternalCampaignSlug } from "@/lib/billboards";
import { pgGetCampaignById } from "@/lib/db/repository";
import { pgGetUserById } from "@/lib/db/repository-extended";
import {
  addCampaignBillboardDesign,
  resolveAssignmentIdForBillboard,
  type BillboardActingUser,
  type BillboardDisplayPeriodInput,
} from "@/lib/services/billboard-assignment-api";

function parseRequiredPeriods(formData: FormData): BillboardDisplayPeriodInput[] {
  const raw = formData.get("periods");
  if (typeof raw !== "string" || !raw.trim()) {
    throw new Error("حداقل یک دوره نمایش الزامی است");
  }

  const parsed = JSON.parse(raw) as Array<{
    title?: string;
    startDate: string;
    endDate: string;
    sortOrder: number;
    imageKey?: string;
    billboardImageKey?: string;
  }>;

  if (parsed.length === 0) {
    throw new Error("حداقل یک دوره نمایش الزامی است");
  }

  return parsed.map((period, index) => {
    const billboardImage = period.billboardImageKey
      ? formData.get(period.billboardImageKey)
      : null;
    const image = period.imageKey ? formData.get(period.imageKey) : null;

    return {
      title: period.title,
      startDate: period.startDate,
      endDate: period.endDate,
      sortOrder: period.sortOrder ?? index,
      image: image instanceof File && image.size > 0 ? image : null,
      billboardImage:
        billboardImage instanceof File && billboardImage.size > 0 ? billboardImage : null,
    };
  });
}

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session?.userId && session?.type !== "env_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const campaignId = String(formData.get("campaignId") ?? "").trim();
  const externalCampaignId = String(formData.get("externalCampaignId") ?? "").trim();
  const assignmentIdInput = String(formData.get("assignmentId") ?? "").trim() || null;
  const billboardExternalId = String(formData.get("billboardExternalId") ?? "").trim() || null;

  if (!campaignId || !externalCampaignId) {
    return NextResponse.json({ error: "اطلاعات کمپین ناقص است" }, { status: 400 });
  }

  const settings = await pgGetCampaignById(campaignId);
  if (!settings) {
    return NextResponse.json({ error: "کمپین یافت نشد" }, { status: 404 });
  }

  const externalCampaignSlug = getExternalCampaignSlug(settings);
  if (!externalCampaignSlug) {
    return NextResponse.json({ error: "اسلاگ کمپین map-bilboard تنظیم نشده است" }, { status: 400 });
  }

  let actingUser: BillboardActingUser | null = null;
  if (session?.userId) {
    const user = await pgGetUserById(session.userId);
    if (user) {
      actingUser = { id: user.id, email: user.email, name: user.name };
    }
  }

  try {
    const periods = parseRequiredPeriods(formData);
    const assignmentId = await resolveAssignmentIdForBillboard({
      externalCampaignSlug,
      assignmentId: assignmentIdInput,
      billboardExternalId,
    });

    for (const period of periods) {
      await addCampaignBillboardDesign({
        externalCampaignId,
        assignmentId,
        period,
        actingUser,
      });
    }

    revalidatePath("/admin/billboards");
    revalidatePath("/");

    return NextResponse.json({ success: true, assignmentId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "افزودن دوره ناموفق بود" },
      { status: 400 }
    );
  }
}
