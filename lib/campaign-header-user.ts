import type { AuthSession } from "@/lib/types";

export interface CampaignHeaderUser {
  name: string;
  email?: string;
}

/** Map auth session to the minimal user shape shown in the public campaign header. */
export function resolveCampaignHeaderUser(
  session: AuthSession | null
): CampaignHeaderUser | null {
  if (!session) return null;

  const name =
    session.name?.trim() ||
    session.email?.trim() ||
    (session.type === "env_admin" ? "مدیر سیستم" : "کاربر");

  return {
    name,
    email: session.email?.trim() || undefined,
  };
}
