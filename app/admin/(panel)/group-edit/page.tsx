import { redirect } from "next/navigation";
import { GroupEditAdmin } from "@/components/admin/group-edit-admin";
import { resolveAdminCampaignId } from "@/lib/admin-campaign";
import { getAdminData } from "@/lib/data-access/admin";
import { getAuthSession, isFullAdmin } from "@/lib/auth/get-session";
import { defaultContributorPermissions } from "@/lib/contributor-permissions";
import { pgGetUserById } from "@/lib/db/repository-extended";
import { isPostgresConfigured } from "@/lib/utils";
import type {
  Billboard,
  CampaignActivity,
  CampaignFile,
  Poster,
  RawMediaUpload,
  SocialMediaPost,
  Video,
} from "@/lib/types";

interface PageProps {
  searchParams: Promise<{ campaign?: string }>;
}

export default async function GroupEditPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { campaignId } = await resolveAdminCampaignId(params.campaign);
  if (!campaignId) redirect("/admin/campaigns");

  const session = await getAuthSession();
  if (!session) redirect("/admin/login");

  const fullAdmin = isFullAdmin(session);
  let permissions = fullAdmin ? null : defaultContributorPermissions();

  if (!fullAdmin && isPostgresConfigured() && session.userId) {
    const user = await pgGetUserById(session.userId);
    permissions = user?.campaignPermissions[campaignId] ?? defaultContributorPermissions();
  }

  const data = await getAdminData(campaignId);
  if (!data.settings) redirect("/admin/campaigns");

  return (
    <GroupEditAdmin
      campaignId={campaignId}
      isFullAdmin={fullAdmin}
      permissions={permissions}
      contentPlans={data.settings.contentPlans ?? []}
      contentTopics={data.settings.contentTopics ?? []}
      billboards={(data.billboards ?? []) as Billboard[]}
      posters={(data.posters ?? []) as Poster[]}
      posterCategories={data.posterCategories ?? []}
      videos={(data.videos ?? []) as Video[]}
      videoCategories={data.videoCategories ?? []}
      files={(data.files ?? []) as CampaignFile[]}
      rawMedia={(data.rawMedia ?? []) as RawMediaUpload[]}
      socialPosts={(data.socialPosts ?? []) as SocialMediaPost[]}
      activities={(data.activities ?? []) as CampaignActivity[]}
    />
  );
}
