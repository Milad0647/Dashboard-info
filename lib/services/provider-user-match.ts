import { getLoginUsernameFromEmail } from "@/lib/auth/user-login";
import type { AdminUser } from "@/lib/types";

function normalizeOrganizationName(value: string): string {
  return value
    .replace(/\u200c/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/^(شرکت|کانون|گروه|آژانس|تبلیغاتی|تبلغاتی)\s+/u, "")
    .trim();
}

export function matchProviderToUser(
  providerName: string,
  users: AdminUser[]
): AdminUser | null {
  const normalizedProvider = normalizeOrganizationName(providerName);
  if (!normalizedProvider) return null;

  for (const user of users) {
    const normalizedUserName = normalizeOrganizationName(user.name);
    if (!normalizedUserName) continue;

    if (
      normalizedUserName === normalizedProvider ||
      normalizedProvider.includes(normalizedUserName) ||
      normalizedUserName.includes(normalizedProvider)
    ) {
      return user;
    }

    const username = normalizeOrganizationName(getLoginUsernameFromEmail(user.email));
    if (username && (normalizedProvider.includes(username) || username.includes(normalizedProvider))) {
      return user;
    }
  }

  return null;
}
