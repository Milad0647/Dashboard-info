import { notFound } from "next/navigation";
import { getPublicCampaignData } from "@/lib/data-access/campaign";
import { CampaignDashboard } from "@/components/public/campaign-dashboard";

export const dynamic = "force-dynamic";

interface CampaignPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ export?: string }>;
}

export default async function CampaignPage({ params, searchParams }: CampaignPageProps) {
  const { slug } = await params;
  const { export: exportParam } = await searchParams;
  const data = await getPublicCampaignData(slug);

  if (!data) notFound();

  return (
    <CampaignDashboard
      initialData={data}
      slug={slug}
      exportMode={exportParam === "screenshot"}
    />
  );
}
