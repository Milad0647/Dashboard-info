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
  type BillboardActingUser,
  type BillboardDisplayPeriodInput,
} from "@/lib/services/billboard-assignment-api";

function parseRequiredPeriods(formData: FormData): BillboardDisplayPeriodInput[] {
  const raw = formData.get("periods");
  if (typeof raw !== "string" || !raw.trim()) {
    throw new Error("دوره نمایش الزامی است");
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
    throw new Error("دوره نمایش الزامی است");
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

  const fullAdmin = session ? isFullAdmin(session) : true;
  let actingUser: BillboardActingUser | null = null;
  let province = String(formData.get("province") ?? "").trim() || null;
  let city = String(formData.get("city") ?? "").trim() || null;

  if (!fullAdmin && session?.userId) {
    const user = await pgGetUserById(session.userId);
    if (!user) {
      return NextResponse.json({ error: "کاربر یافت نشد" }, { status: 404 });
    }
    actingUser = { id: user.id, email: user.email, name: user.name };
    province = user.province ?? province;
    city = user.city ?? city;
  }

  const address = String(formData.get("address") ?? "").trim() || undefined;
  const areaSqmRaw = String(formData.get("area_sqm") ?? "").trim();
  const areaSqm = areaSqmRaw ? Number(areaSqmRaw) : undefined;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const executionImage = formData.get("execution_image");
  const executionBlob =
    executionImage instanceof File && executionImage.size > 0 ? executionImage : null;

  try {
    const periods = parseRequiredPeriods(formData);
    const { displayStart, displayEnd } = computeDisplayRangeFromPeriods(periods);

    const billboardId = await createSystemBillboard({
      axis,
      address,
      latitude,
      longitude,
      areaSqm: Number.isFinite(areaSqm) ? areaSqm : null,
      province,
      city,
      actingUser,
    });

    const assignmentId = await attachBillboardToCampaign({
      externalCampaignId,
      billboardId,
      displayStart,
      displayEnd,
      notes,
      executionImage: executionBlob,
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
