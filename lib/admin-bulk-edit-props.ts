import { getAllUsers } from "@/lib/data-access/admin";
import { canTransferContentOwnership } from "@/lib/auth/access";
import { getAuthSession, isFullAdmin } from "@/lib/auth/get-session";
import type { AdminUser } from "@/lib/types";

export async function getAdminBulkEditProps(): Promise<{
  isFullAdmin: boolean;
  canTransferOwnership: boolean;
  users: AdminUser[];
}> {
  const session = await getAuthSession();
  const fullAdmin = Boolean(session && isFullAdmin(session));
  const canTransfer = Boolean(session && canTransferContentOwnership(session));
  return {
    isFullAdmin: fullAdmin,
    canTransferOwnership: canTransfer,
    users: canTransfer ? await getAllUsers() : [],
  };
}
