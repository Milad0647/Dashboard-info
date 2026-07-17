import { NextResponse } from "next/server";
import { getAuthSession, isFullAdmin } from "@/lib/auth/get-session";
import { getPublicCampaignData } from "@/lib/data-access/campaign";
import * as pg from "@/lib/db/repository";
import { pgGetUserById } from "@/lib/db/repository-extended";
import { generateCampaignPdf } from "@/lib/services/campaign-pdf";
import type { CampaignSettings } from "@/lib/types";
import { isPostgresConfigured } from "@/lib/utils";

async function resolveCampaign(
  slug: string | null,
  campaignId: string | null
): Promise<CampaignSettings | null> {
  if (campaignId) {
    return pg.pgGetCampaignById(campaignId);
  }
  if (!slug) return null;

  const published = await pg.pgGetPublishedCampaignBySlug(slug);
  if (published) return published;

  const all = await pg.pgGetAllCampaigns();
  return all.find((campaign) => campaign.slug === slug) ?? null;
}

export async function GET(request: Request) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");
  const campaignId = searchParams.get("campaignId");

  const campaign = await resolveCampaign(slug, campaignId);
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  if (!isFullAdmin(session)) {
    if (!isPostgresConfigured() || !session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const user = await pgGetUserById(session.userId);
    if (!user?.campaignIds.includes(campaign.id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const data = await getPublicCampaignData(campaign.slug);
  if (!data) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const pdfBuffer = generateCampaignPdf(data);
  const filename = `campaign-${campaign.slug}-${new Date().toISOString().split("T")[0]}.pdf`;

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
