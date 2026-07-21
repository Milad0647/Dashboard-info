import { redirect } from "next/navigation";
import { ContentMessagesPanel } from "@/components/admin/content-messages-panel";
import { listMyContentMessagesAction } from "@/lib/actions/content-message-actions";
import { getAuthSession } from "@/lib/auth/get-session";

export default async function ContentMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string }>;
}) {
  const session = await getAuthSession();
  if (!session) redirect("/admin/login");

  const params = await searchParams;
  const campaignId = params.campaign?.trim() || "";

  const result = await listMyContentMessagesAction({
    campaignId: campaignId || null,
  });

  return (
    <ContentMessagesPanel
      campaignId={campaignId}
      initialReceived={result.received ?? []}
      initialSent={result.sent ?? []}
      canSend={Boolean(result.canSend)}
    />
  );
}
