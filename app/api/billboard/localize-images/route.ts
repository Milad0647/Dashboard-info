import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAuthSession, isFullAdmin } from "@/lib/auth/get-session";
import { isPostgresConfigured } from "@/lib/utils";
import { pgGetAdminData, pgSaveBillboard, pgGetBillboardPeriods, pgReplaceBillboardPeriods } from "@/lib/db/repository";
import { downloadRemoteImageToLocal } from "@/lib/services/save-uploaded-file";
import { stripFileAccessToken } from "@/lib/uploads";

function isRemoteUrl(url?: string | null): boolean {
  if (!url?.trim()) return false;
  const bare = stripFileAccessToken(url);
  return bare.startsWith("http://") || bare.startsWith("https://");
}

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session || !isFullAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isPostgresConfigured()) {
    return NextResponse.json({ error: "Database required" }, { status: 503 });
  }

  let body: { campaignId?: string };
  try {
    body = (await request.json()) as { campaignId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.campaignId) {
    return NextResponse.json({ error: "campaignId is required" }, { status: 400 });
  }

  const data = await pgGetAdminData(body.campaignId, undefined, ["billboards"]);
  const billboards = data.billboards ?? [];

  let downloaded = 0;
  let failed = 0;
  let skipped = 0;
  const failedUrls: string[] = [];

  for (const billboard of billboards) {
    const hasRemoteImage = isRemoteUrl(billboard.imageUrl) || isRemoteUrl(billboard.thumbnailUrl);
    if (!hasRemoteImage) {
      skipped += 1;
      continue;
    }

    const remoteUrl = isRemoteUrl(billboard.imageUrl)
      ? stripFileAccessToken(billboard.imageUrl!)
      : stripFileAccessToken(billboard.thumbnailUrl!);

    const localUrl = await downloadRemoteImageToLocal(remoteUrl);
    if (!localUrl) {
      failed += 1;
      if (failedUrls.length < 10) failedUrls.push(remoteUrl);
      continue;
    }

    await pgSaveBillboard({
      ...billboard,
      imageUrl: localUrl,
      thumbnailUrl: localUrl,
    });

    // Also localize display period images
    try {
      const periods = await pgGetBillboardPeriods(billboard.id);
      let periodsChanged = false;
      const updatedPeriods = await Promise.all(
        periods.map(async (p) => {
          let billboardImageUrl = p.billboardImageUrl ?? "";
          let confirmationImageUrl = p.confirmationImageUrl ?? null;
          if (isRemoteUrl(billboardImageUrl)) {
            const local = await downloadRemoteImageToLocal(stripFileAccessToken(billboardImageUrl));
            if (local) { billboardImageUrl = local; periodsChanged = true; }
          }
          if (isRemoteUrl(confirmationImageUrl)) {
            const local = await downloadRemoteImageToLocal(stripFileAccessToken(confirmationImageUrl!));
            if (local) { confirmationImageUrl = local; periodsChanged = true; }
          }
          return { ...p, billboardImageUrl, confirmationImageUrl };
        })
      );
      if (periodsChanged) {
        await pgReplaceBillboardPeriods(billboard.id, updatedPeriods);
      }
    } catch {
      // period localization is best-effort
    }

    downloaded += 1;
  }

  revalidatePath("/admin/billboards");
  revalidatePath("/admin");

  return NextResponse.json({
    success: true,
    total: billboards.length,
    downloaded,
    failed,
    skipped,
    failedUrls,
  });
}
