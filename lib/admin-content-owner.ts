import { canTransferContentOwnership } from "@/lib/auth/access";
import { pgFindUserIdByName, pgGetUserByEmail } from "@/lib/db/repository-extended";
import type { AuthSession } from "@/lib/types";
import { isPostgresConfigured } from "@/lib/utils";

/** Display / lookup name for the company account that owns admin uploads. */
export const DEFAULT_ADMIN_CONTENT_OWNER_NAME = "توانیر";

/** Fallback email for the company account that owns admin uploads. */
export const DEFAULT_ADMIN_CONTENT_OWNER_EMAIL = "tavanir@example.com";

let cachedOwnerUserId: string | null | undefined;
let cachedAt = 0;
const CACHE_TTL_MS = 60_000;

/**
 * Resolves the DB user that should own content created by full admins.
 * Priority: DEFAULT_ADMIN_OWNER_USER_ID → email (DEFAULT_ADMIN_OWNER_EMAIL / tavanir@example.com)
 * → user named توانیر.
 */
export async function resolveDefaultAdminOwnerUserId(): Promise<string | null> {
  const fromEnv = process.env.DEFAULT_ADMIN_OWNER_USER_ID?.trim();
  if (fromEnv) return fromEnv;

  const now = Date.now();
  if (cachedOwnerUserId !== undefined && now - cachedAt < CACHE_TTL_MS) {
    return cachedOwnerUserId;
  }

  if (!isPostgresConfigured()) {
    cachedOwnerUserId = null;
    cachedAt = now;
    return null;
  }

  try {
    const emailHint =
      process.env.DEFAULT_ADMIN_OWNER_EMAIL?.trim() || DEFAULT_ADMIN_CONTENT_OWNER_EMAIL;
    const byEmail = await pgGetUserByEmail(emailHint);
    if (byEmail?.id) {
      cachedOwnerUserId = byEmail.id;
      cachedAt = now;
      return cachedOwnerUserId;
    }

    const nameHint =
      process.env.DEFAULT_ADMIN_OWNER_NAME?.trim() || DEFAULT_ADMIN_CONTENT_OWNER_NAME;
    cachedOwnerUserId = await pgFindUserIdByName(nameHint);
  } catch {
    cachedOwnerUserId = null;
  }
  cachedAt = now;
  return cachedOwnerUserId;
}

/**
 * Owner to persist on save:
 * - Contributor → their own user id
 * - Admin / کارفرما with explicit owner → that owner
 * - Admin creating new content → Tavanir (or env) account
 * - Admin / کارفرما updating existing content without explicit owner → null
 *   (DB COALESCE keeps the previous owner)
 */
export async function resolveSaveOwnerUserId(options: {
  session: AuthSession;
  explicitOwnerUserId?: string | null;
  contentId?: string | null;
}): Promise<string | null> {
  const { session, explicitOwnerUserId, contentId } = options;

  if (!canTransferContentOwnership(session)) {
    return session.userId ?? null;
  }

  if (explicitOwnerUserId) {
    return explicitOwnerUserId;
  }

  if (contentId) {
    return null;
  }

  return resolveDefaultAdminOwnerUserId();
}
