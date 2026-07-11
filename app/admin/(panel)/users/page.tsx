import { redirect } from "next/navigation";
import { getAllCampaigns, getAllUsers } from "@/lib/data-access/admin";
import { isClientUser } from "@/lib/auth/access";
import { getAuthSession, isFullAdmin } from "@/lib/auth/get-session";
import { UsersAdmin } from "@/components/admin/users-admin";

export default async function UsersPage() {
  const session = await getAuthSession();
  if (!session) redirect("/admin/login");

  const isAdmin = isFullAdmin(session);
  const isClient = isClientUser(session);
  if (!isAdmin && !isClient) redirect("/admin");

  const [users, campaigns] = await Promise.all([getAllUsers(), getAllCampaigns()]);
  return (
    <UsersAdmin
      initialUsers={users}
      campaigns={campaigns}
      mode={isAdmin ? "full" : "region"}
    />
  );
}
