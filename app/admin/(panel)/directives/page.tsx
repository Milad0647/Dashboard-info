import { redirect } from "next/navigation";
import { DirectivesAdmin } from "@/components/admin/directives-admin";
import { resolveAdminCampaignId } from "@/lib/admin-campaign";
import { canManageDirectives, canViewDirectives } from "@/lib/auth/access";
import { getAuthSession, isFullAdmin } from "@/lib/auth/get-session";
import { listRejectedSubmissionsForOwner } from "@/lib/data-access/admin";
import { pgGetUserPermissionsForCampaign } from "@/lib/db/repository-extended";
import {
  pgListCampaignUsersForDirectives,
  pgListDirectivesForCampaign,
  pgListDirectivesForUserInbox,
} from "@/lib/db/repository-directives";
import { isPostgresConfigured } from "@/lib/utils";
import { withFileAccessTokensDeep } from "@/lib/uploads";

interface PageProps {
  searchParams: Promise<{ campaign?: string }>;
}

export default async function DirectivesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { campaignId } = await resolveAdminCampaignId(params.campaign);
  if (!campaignId) redirect("/admin/campaigns");

  const session = await getAuthSession();
  if (!session || !canViewDirectives(session)) redirect("/admin/login");

  if (!isFullAdmin(session)) {
    if (!session.userId || !isPostgresConfigured()) redirect("/admin");
    const membership = await pgGetUserPermissionsForCampaign(session.userId, campaignId);
    if (!membership) redirect("/admin");
  }

  const canManage = canManageDirectives(session);

  if (!isPostgresConfigured()) {
    return (
      <DirectivesAdmin
        campaignId={campaignId}
        canManage={canManage}
        initialDirectives={[]}
        archivedDirectives={[]}
        inboxDirectives={[]}
        rejectedSubmissions={[]}
        campaignUsers={[]}
      />
    );
  }

  const [manageDirectives, archivedDirectives, inboxDirectives, rejectedSubmissions, campaignUsers] =
    await Promise.all([
      canManage ? pgListDirectivesForCampaign(campaignId, { scope: "active" }) : Promise.resolve([]),
      canManage ? pgListDirectivesForCampaign(campaignId, { scope: "archived" }) : Promise.resolve([]),
      session.userId
        ? pgListDirectivesForUserInbox(campaignId, session.userId)
        : Promise.resolve([]),
      session.userId
        ? listRejectedSubmissionsForOwner(campaignId, session.userId)
        : Promise.resolve([]),
      canManage ? pgListCampaignUsersForDirectives(campaignId) : Promise.resolve([]),
    ]);

  const initialDirectives = canManage ? manageDirectives : inboxDirectives;

  return (
    <DirectivesAdmin
      campaignId={campaignId}
      canManage={canManage}
      initialDirectives={withFileAccessTokensDeep(initialDirectives)}
      archivedDirectives={withFileAccessTokensDeep(archivedDirectives)}
      inboxDirectives={withFileAccessTokensDeep(inboxDirectives)}
      rejectedSubmissions={rejectedSubmissions}
      campaignUsers={campaignUsers}
    />
  );
}
