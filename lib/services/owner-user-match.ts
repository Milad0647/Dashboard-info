import {
  buildLoginEmailCandidates,
  getLoginUsernameFromEmail,
  normalizeStoredUserEmail,
} from "@/lib/auth/user-login";
import type { IntegrationBillboardOwner } from "@/lib/models/billboard-api";
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

function emailCandidates(value: string): string[] {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return [];
  return buildLoginEmailCandidates(trimmed);
}

export function matchOwnerToUser(
  owner: IntegrationBillboardOwner,
  users: AdminUser[]
): AdminUser | null {
  const ownerEmails = new Set<string>();
  for (const candidate of [owner.username, owner.email]) {
    for (const email of emailCandidates(candidate ?? "")) {
      ownerEmails.add(email);
    }
    if (candidate?.includes("@")) {
      ownerEmails.add(candidate.trim().toLowerCase());
    }
  }

  for (const user of users) {
    const userEmail = user.email.trim().toLowerCase();
    if (ownerEmails.has(userEmail)) return user;

    const normalizedUserEmail = normalizeStoredUserEmail(user.email);
    if (ownerEmails.has(normalizedUserEmail)) return user;
  }

  const normalizedOwnerName = normalizeOrganizationName(owner.name ?? "");
  if (normalizedOwnerName) {
    for (const user of users) {
      const normalizedUserName = normalizeOrganizationName(user.name);
      if (!normalizedUserName) continue;

      if (
        normalizedUserName === normalizedOwnerName ||
        normalizedOwnerName.includes(normalizedUserName) ||
        normalizedUserName.includes(normalizedOwnerName)
      ) {
        return user;
      }

      const username = normalizeOrganizationName(getLoginUsernameFromEmail(user.email));
      if (
        username &&
        (normalizedOwnerName.includes(username) || username.includes(normalizedOwnerName))
      ) {
        return user;
      }
    }
  }

  return null;
}

export function getOwnerFilterKey(
  owner: IntegrationBillboardOwner,
  matchedUser: AdminUser | null
): string {
  if (matchedUser) return matchedUser.id;
  const email = owner.email?.trim() || owner.username?.trim();
  return email ? normalizeStoredUserEmail(email) : owner.id;
}
