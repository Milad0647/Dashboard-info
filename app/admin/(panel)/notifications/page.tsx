import { redirect } from "next/navigation";

interface PageProps {
  searchParams: Promise<{ campaign?: string }>;
}

export default async function NotificationsRedirectPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = params.campaign ? `?campaign=${params.campaign}` : "";
  redirect(`/admin/elanha${query}`);
}
