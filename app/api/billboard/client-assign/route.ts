import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAuthSession, isFullAdmin } from "@/lib/auth/get-session";
import { pgGetCampaignById } from "@/lib/db/repository";
import { pgGetUserById } from "@/lib/db/repository-extended";
import {
  addCampaignBillboardDesign,
  attachBillboardToCampaign,
  computeDisplayRangeFromPeriods,
  createSystemBillboard,
  type BillboardDisplayPeriodInput,
} from "@/lib/services/billboard-assignment-api";

function parsePeriods(formData: FormData): BillboardDisplayPeriodInput[] {
  const raw = formData.get("periods");
  if (typeof raw !== "string" || !raw.trim()) {
    throw new Error("حداقل یک دوره نمایش الزامی است");
  }

  const parsed = JSON.parse(raw) as Array<{
    title?: string;
    startDate: string;
    endDate: string;
    sortOrder: number;
    imageKey: string;
    billboardImageKey: string;
  }>;

  if (parsed.length === 0) {
    throw new Error("حداقل یک دوره نمایش الزامی است");
  }

  return parsed.map((period, index) => {
    const image = formData.get(period.imageKey);
    const billboardImage = formData.get(period.billboardImageKey);

    if (!(image instanceof File) || image.size === 0) {
      throw new Error(`تصویر تأییدیه دوره ${index + 1} الزامی است`);
    }
    if (!(billboardImage instanceof File) || billboardImage.size === 0) {
      throw new Error(`عکس بیلبورد دوره ${index + 1} الزامی است`);
    }

    return {
      title: period.title,
      startDate: period.startDate,
      endDate: period.endDate,
      sortOrder: period.sortOrder ?? index,
      image,
      billboardImage,
    };
  });
}

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (isFullAdmin(session)) {
    return NextResponse.json(
      { error: "ادمین باید از فرم اتصال بیلبورد موجود استفاده کند" },
      { status: 400 }
    );
  }

  const formData = await request.formData();
  const campaignId = String(formData.get("campaignId") ?? "").trim();
  const externalCampaignId = String(formData.get("externalCampaignId") ?? "").trim();
  const axis = String(formData.get("axis") ?? "").trim();
  const latitude = Number(formData.get("latitude"));
  const longitude = Number(formData.get("longitude"));

  if (!campaignId || !externalCampaignId) {
    return NextResponse.json({ error: "اطلاعات کمپین ناقص است" }, { status: 400 });
  }
  if (axis.length < 2) {
    return NextResponse.json({ error: "محور باید حداقل ۲ کاراکتر باشد" }, { status: 400 });
  }
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return NextResponse.json({ error: "موقعیت روی نقشه الزامی است" }, { status: 400 });
  }

  const settings = await pgGetCampaignById(campaignId);
  if (!settings) {
    return NextResponse.json({ error: "کمپین یافت نشد" }, { status: 404 });
  }

  const user = await pgGetUserById(session.userId);
  if (!user) {
    return NextResponse.json({ error: "کاربر یافت نشد" }, { status: 404 });
  }

  const actingUser = { id: user.id, email: user.email, name: user.name };
  const address = String(formData.get("address") ?? "").trim() || undefined;
  const areaSqmRaw = String(formData.get("area_sqm") ?? "").trim();
  const areaSqm = areaSqmRaw ? Number(areaSqmRaw) : undefined;

  try {
    const periods = parsePeriods(formData);
    const { displayStart, displayEnd } = computeDisplayRangeFromPeriods(periods);

    const billboardId = await createSystemBillboard({
      axis,
      address,
      latitude,
      longitude,
      areaSqm: Number.isFinite(areaSqm) ? areaSqm : null,
      province: user.province,
      city: user.city,
      actingUser,
    });

    const assignmentId = await attachBillboardToCampaign({
      externalCampaignId,
      billboardId,
      displayStart,
      displayEnd,
      actingUser,
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

    return NextResponse.json({ success: true, billboardId, assignmentId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ثبت بیلبورد ناموفق بود" },
      { status: 400 }
    );
  }
}
