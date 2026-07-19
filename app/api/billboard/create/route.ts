import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAuthSession, isFullAdmin } from "@/lib/auth/get-session";
import { canTransferContentOwnership } from "@/lib/auth/access";
import { assertTutorialForPossibleCreate } from "@/lib/auth/require-tutorial-completion";
import { resolveDefaultAdminOwnerUserId } from "@/lib/admin-content-owner";
import { pgGetCampaignById } from "@/lib/db/repository";
import { pgGetUserById } from "@/lib/db/repository-extended";
import type { BillboardDisplayPeriodInput } from "@/lib/services/billboard-assignment-api";
import { createLocalBillboard } from "@/lib/services/local-billboard-create";
import { matchBillboardCategoryKey, type BillboardCategory } from "@/lib/billboard-categories";

function parseRequiredPeriods(formData: FormData): BillboardDisplayPeriodInput[] {
  const raw = formData.get("periods");
  if (typeof raw !== "string" || !raw.trim()) {
    throw new Error("دوره نمایش الزامی است");
  }

  const parsed = JSON.parse(raw) as Array<{
    id?: string;
    title?: string;
    startDate: string;
    endDate: string;
    sortOrder: number;
    imageKey?: string;
    billboardImageKey?: string;
    billboardImageUrl?: string;
    confirmationImageUrl?: string;
  }>;

  if (parsed.length === 0) {
    throw new Error("دوره نمایش الزامی است");
  }

  return parsed.map((period, index) => {
    const billboardImage = period.billboardImageKey
      ? formData.get(period.billboardImageKey)
      : null;

    const hasNewBillboardImage = billboardImage instanceof File && billboardImage.size > 0;
    const hasExistingBillboardImage = Boolean(period.billboardImageUrl?.trim());

    if (!hasNewBillboardImage && !hasExistingBillboardImage) {
      throw new Error("عکس بیلبورد در دوره نمایش الزامی است");
    }

    const image = period.imageKey ? formData.get(period.imageKey) : null;

    return {
      id: period.id,
      title: period.title,
      startDate: period.startDate,
      endDate: period.endDate,
      sortOrder: period.sortOrder ?? index,
      image: image instanceof File && image.size > 0 ? image : null,
      billboardImage: hasNewBillboardImage ? billboardImage : null,
      billboardImageUrl: period.billboardImageUrl ?? null,
      confirmationImageUrl: period.confirmationImageUrl ?? null,
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
  const billboardId = String(formData.get("billboardId") ?? "").trim() || undefined;
  const categoryRaw = String(formData.get("category") ?? "").trim() || null;
  const category = categoryRaw ? matchBillboardCategoryKey(categoryRaw) : null;
  const axis = String(formData.get("axis") ?? "").trim();
  const latitude = Number(formData.get("latitude"));
  const longitude = Number(formData.get("longitude"));

  if (!campaignId) {
    return NextResponse.json({ error: "شناسه کمپین الزامی است" }, { status: 400 });
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
  const canTransfer = Boolean(session && canTransferContentOwnership(session));
  const requestedOwnerUserId = String(formData.get("ownerUserId") ?? "").trim() || null;
  let ownerUserId: string | null = null;
  let province = String(formData.get("province") ?? "").trim() || null;
  let city = String(formData.get("city") ?? "").trim() || null;

  if (!canTransfer && session?.userId) {
    const user = await pgGetUserById(session.userId);
    if (!user) {
      return NextResponse.json({ error: "کاربر یافت نشد" }, { status: 404 });
    }
    ownerUserId = user.id;
    // Prefer explicit form selection; fall back to profile only when form left empty.
    province = province || user.province || null;
    city = city || user.city || null;
  } else if (canTransfer) {
    if (requestedOwnerUserId) {
      const owner = await pgGetUserById(requestedOwnerUserId);
      if (!owner) {
        return NextResponse.json({ error: "مالک انتخاب‌شده یافت نشد" }, { status: 400 });
      }
      ownerUserId = owner.id;
    } else if (!billboardId) {
      // Create without explicit owner: default company account.
      ownerUserId = await resolveDefaultAdminOwnerUserId();
    }
    // Edit without ownerUserId: leave null so COALESCE keeps previous owner.
  } else if (fullAdmin && !billboardId) {
    ownerUserId = await resolveDefaultAdminOwnerUserId();
  }

  const address = String(formData.get("address") ?? "").trim() || undefined;
  const areaSqmRaw = String(formData.get("area_sqm") ?? "").trim();
  const areaSqm = areaSqmRaw ? Number(areaSqmRaw) : undefined;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const planLabel = String(formData.get("planLabel") ?? "").trim() || null;
  const planLabels = formData
    .getAll("planLabels")
    .map((value) => String(value).trim())
    .filter(Boolean);

  if (planLabels.length === 0 && !planLabel) {
    return NextResponse.json({ error: "انتخاب موضوع الزامی است" }, { status: 400 });
  }

  try {
    const periods = parseRequiredPeriods(formData);

    const tutorialDenied = await assertTutorialForPossibleCreate(
      "billboards",
      "billboards",
      billboardId
    );
    if (tutorialDenied) {
      return NextResponse.json({ error: tutorialDenied.error }, { status: 403 });
    }

    await createLocalBillboard({
      campaignId,
      billboardId,
      axis,
      address,
      latitude,
      longitude,
      areaSqm: Number.isFinite(areaSqm) ? areaSqm : null,
      province,
      city,
      category: category as BillboardCategory | null,
      notes,
      // Always publish so contributor uploads appear on the public campaign page.
      published: true,
      status: "published",
      planLabel: planLabels[0] ?? planLabel,
      planLabels: planLabels.length > 0 ? planLabels : planLabel ? [planLabel] : undefined,
      periods,
      ownerUserId,
    });

    revalidatePath("/admin/billboards");
    revalidatePath("/admin");
    revalidatePath("/");
    if (settings.slug) {
      revalidatePath(`/campaign/${settings.slug}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ثبت بیلبورد ناموفق بود" },
      { status: 400 }
    );
  }
}
