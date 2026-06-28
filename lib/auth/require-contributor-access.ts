import { redirect } from "next/navigation";
import { getAuthSession, isFullAdmin } from "@/lib/auth/get-session";
import {
  hasContributorPermission,
  type ContributorPermissionKey,
} from "@/lib/contributor-permissions";
import { pgGetUserPermissionsForCampaign } from "@/lib/db/repository-extended";
import { isPostgresConfigured } from "@/lib/utils";

export async function requireContributorAccess(
  campaignId: string,
  permission: ContributorPermissionKey
) {
  const session = await getAuthSession();
  if (!session) redirect("/admin/login");
  if (isFullAdmin(session)) return;

  if (!isPostgresConfigured() || !session.userId) {
    redirect("/admin");
  }

  const permissions = await pgGetUserPermissionsForCampaign(session.userId, campaignId);
  if (!permissions || !hasContributorPermission(permissions, permission)) {
    redirect("/admin");
  }
}
