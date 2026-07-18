import { redirect } from "next/navigation";
import { BackupsAdmin } from "@/components/admin/backups-admin";
import { getAuthSession, isFullAdmin } from "@/lib/auth/get-session";

export default async function BackupsPage() {
  const session = await getAuthSession();
  if (!session) redirect("/admin/login");
  if (!isFullAdmin(session)) redirect("/admin");

  return <BackupsAdmin />;
}
