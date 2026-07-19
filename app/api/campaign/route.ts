import { NextResponse } from "next/server";
import { getPublicCampaignData } from "@/lib/data-access/campaign";
import { canScoreContent } from "@/lib/auth/access";
import { getAuthSession } from "@/lib/auth/get-session";
import { isCampaignPageUnlockedWithGate } from "@/lib/campaign-page-unlock";
import { pgGetCampaignPageLockGate } from "@/lib/db/repository-extended";
import { isPostgresConfigured } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");

  if (!slug) {
    return NextResponse.json({ error: "slug is required" }, { status: 400 });
  }

  try {
    if (isPostgresConfigured()) {
      const lockGate = await pgGetCampaignPageLockGate(slug);
      if (!lockGate) {
        return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
      }

      if (lockGate.requiresLock) {
        const session = await getAuthSession();
        const canBypass = Boolean(session && canScoreContent(session));
        const unlocked =
          canBypass ||
          (await isCampaignPageUnlockedWithGate(slug, {
            requiresLock: lockGate.requiresLock,
            sharedHash: lockGate.sharedHash,
            activeCodes: lockGate.activeCodes,
          }));
        if (!unlocked) {
          return NextResponse.json(
            { error: "Password required", locked: true },
            { status: 401 }
          );
        }
      }
    }

    const data = await getPublicCampaignData(slug);
    if (!data) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed to fetch campaign data" }, { status: 500 });
  }
}
