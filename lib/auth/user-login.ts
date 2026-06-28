export const DEFAULT_USER_EMAIL_DOMAIN = "example.com";

export function normalizeStoredUserEmail(usernameOrEmail: string): string {
  const value = usernameOrEmail.trim().toLowerCase();
  if (!value) return value;
  if (value.includes("@")) return value;
  return `${value}@${DEFAULT_USER_EMAIL_DOMAIN}`;
}

export function buildLoginEmailCandidates(identifier: string): string[] {
  const trimmed = identifier.trim().toLowerCase();
  if (!trimmed) return [];

  if (trimmed.includes("@")) {
    return [trimmed];
  }

  return [trimmed, `${trimmed}@${DEFAULT_USER_EMAIL_DOMAIN}`];
}

export function getLoginUsernameFromEmail(email: string): string {
  const atIndex = email.indexOf("@");
  if (atIndex <= 0) return email;
  return email.slice(0, atIndex);
}
