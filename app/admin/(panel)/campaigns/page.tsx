import { redirect } from "next/navigation";
import { getAllCampaigns } from "@/lib/data-access/admin";
import { CampaignsAdmin } from "@/components/admin/campaigns-admin";
import { getAuthSession, isFullAdmin } from "@/lib/auth/get-session";

export default async function CampaignsPage() {
  const session = await getAuthSession();
  if (!session) redirect("/admin/login");
  if (!isFullAdmin(session)) redirect("/admin");

  const campaigns = await getAllCampaigns();
  return <CampaignsAdmin initialCampaigns={campaigns} />;
}
