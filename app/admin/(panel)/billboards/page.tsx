import { redirect } from "next/navigation";
import { getAdminData, getAllUsers } from "@/lib/data-access/admin";
import { resolveAdminCampaignId } from "@/lib/admin-campaign";
import { getAuthSession, getOwnerFilter, isFullAdmin } from "@/lib/auth/get-session";
import { requireContributorAccess } from "@/lib/auth/require-contributor-access";
import { pgGetUserById } from "@/lib/db/repository-extended";
import {
  hasExternalBillboardConnection,
  resolveAdminBillboards,
  getExternalCampaignSlug,
} from "@/lib/billboards";
import { BillboardsAdmin } from "@/components/admin/billboards-admin";
import type { Billboard, CampaignSettings } from "@/lib/types";

interface PageProps {
  searchParams: Promise<{ campaign?: string }>;
}

export default async function BillboardsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { campaignId } = await resolveAdminCampaignId(params.campaign);
  if (!campaignId) redirect("/admin/campaigns");
  await requireContributorAccess(campaignId, "billboards");

  const session = await getAuthSession();
  const fullAdmin = session ? isFullAdmin(session) : true;
  const ownerUserId = session ? getOwnerFilter(session) : undefined;
  let contributorProfile = null;

  if (session?.userId) {
    const user = await pgGetUserById(session.userId);
    if (user) {
      contributorProfile = {
        province: user.province,
        city: user.city,
        email: user.email,
        name: user.name,
      };
    }
  }

  const data = await getAdminData(campaignId);
  const users = await getAllUsers();
  const dbBillboards = (data.billboards ?? []) as Billboard[];
  const settings = data.settings as CampaignSettings | null;
  const billboards = settings
    ? await resolveAdminBillboards(settings, dbBillboards, users, ownerUserId)
    : ownerUserId
      ? dbBillboards.filter((billboard) => billboard.ownerUserId === ownerUserId)
      : dbBillboards;

  return (
    <BillboardsAdmin
      campaignId={campaignId}
      initialBillboards={billboards}
      contentPlans={settings?.contentPlans ?? []}
      liveApiEnabled={Boolean(settings && hasExternalBillboardConnection(settings))}
      externalCampaignSlug={settings ? getExternalCampaignSlug(settings) : null}
      externalCampaignId={settings?.billboardConfig?.externalCampaignId ?? null}
      isFullAdmin={fullAdmin}
      contributorProfile={contributorProfile}
    />
  );
}
