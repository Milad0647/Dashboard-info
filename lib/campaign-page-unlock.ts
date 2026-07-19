import { cookies } from "next/headers";
import { getAuthSecret } from "@/lib/auth/secret";

const UNLOCK_TTL_SECONDS = 7 * 24 * 60 * 60;

export type CampaignPageUnlockSource =
  | { kind: "shared"; passwordHash: string }
  | { kind: "code"; codeId: string; passwordHash: string };

async function signPayload(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getAuthSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function getCampaignPageUnlockCookieName(slug: string): string {
  const safe = slug.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 48);
  return `campaign_page_unlock_${safe}`;
}

function buildUnlockPayload(slug: string, expiresAt: number, source: CampaignPageUnlockSource): string {
  if (source.kind === "shared") {
    return `${slug}|${expiresAt}|shared|${source.passwordHash}`;
  }
  return `${slug}|${expiresAt}|code|${source.codeId}|${source.passwordHash}`;
}

function parseUnlockPayload(payload: string): {
  slug: string;
  expiresAt: number;
  source: CampaignPageUnlockSource;
} | null {
  const firstSep = payload.indexOf("|");
  if (firstSep <= 0) return null;
  const secondSep = payload.indexOf("|", firstSep + 1);
  if (secondSep <= firstSep) return null;

  const slug = payload.slice(0, firstSep);
  const expiresAtRaw = payload.slice(firstSep + 1, secondSep);
  const rest = payload.slice(secondSep + 1);
  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt)) return null;

  // Legacy: slug|expiresAt|passwordHash (shared only)
  if (!rest.startsWith("shared|") && !rest.startsWith("code|")) {
    return {
      slug,
      expiresAt,
      source: { kind: "shared", passwordHash: rest },
    };
  }

  if (rest.startsWith("shared|")) {
    const passwordHash = rest.slice("shared|".length);
    if (!passwordHash) return null;
    return { slug, expiresAt, source: { kind: "shared", passwordHash } };
  }

  // code|{codeId}|{passwordHash} — bcrypt hashes contain ":" so use first "|" only after "code|"
  const afterCode = rest.slice("code|".length);
  const codeIdSep = afterCode.indexOf("|");
  if (codeIdSep <= 0) return null;
  const codeId = afterCode.slice(0, codeIdSep);
  const passwordHash = afterCode.slice(codeIdSep + 1);
  if (!codeId || !passwordHash) return null;
  return { slug, expiresAt, source: { kind: "code", codeId, passwordHash } };
}

export async function createCampaignPageUnlockToken(
  slug: string,
  source: CampaignPageUnlockSource
): Promise<string> {
  const expiresAt = Date.now() + UNLOCK_TTL_SECONDS * 1000;
  const payload = buildUnlockPayload(slug, expiresAt, source);
  const signature = await signPayload(payload);
  return `${payload}.${signature}`;
}

/** @deprecated Prefer createCampaignPageUnlockToken with CampaignPageUnlockSource */
export async function createCampaignPageUnlockTokenFromHash(
  slug: string,
  passwordHash: string
): Promise<string> {
  return createCampaignPageUnlockToken(slug, { kind: "shared", passwordHash });
}

export async function verifyCampaignPageUnlockTokenSignature(
  token: string | undefined | null
): Promise<{ slug: string; expiresAt: number; source: CampaignPageUnlockSource } | null> {
  if (!token) return null;

  const separatorIndex = token.lastIndexOf(".");
  if (separatorIndex <= 0) return null;
  const payload = token.slice(0, separatorIndex);
  const signature = token.slice(separatorIndex + 1);
  if (!payload || !signature) return null;

  const expected = await signPayload(payload);
  if (signature.length !== expected.length) return null;

  let mismatch = 0;
  for (let i = 0; i < signature.length; i += 1) {
    mismatch |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  if (mismatch !== 0) return null;

  const parsed = parseUnlockPayload(payload);
  if (!parsed) return null;
  if (parsed.expiresAt <= Date.now()) return null;
  return parsed;
}

/**
 * Legacy helper: verify unlock cookie against a single shared password hash.
 * Prefer isCampaignPageUnlockedWithGate for shared + access codes.
 */
export async function verifyCampaignPageUnlockToken(
  token: string | undefined | null,
  slug: string,
  passwordHash: string
): Promise<boolean> {
  const parsed = await verifyCampaignPageUnlockTokenSignature(token);
  if (!parsed) return false;
  if (parsed.slug !== slug) return false;
  if (parsed.source.kind !== "shared") return false;
  return parsed.source.passwordHash === passwordHash;
}

export function getCampaignPageUnlockCookieOptions() {
  return {
    httpOnly: true as const,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: UNLOCK_TTL_SECONDS,
  };
}

export async function isCampaignPageUnlocked(
  slug: string,
  passwordHash: string | null | undefined
): Promise<boolean> {
  if (!passwordHash) return true;
  const cookieStore = await cookies();
  const token = cookieStore.get(getCampaignPageUnlockCookieName(slug))?.value;
  return verifyCampaignPageUnlockToken(token, slug, passwordHash);
}

export type CampaignPageLockGate = {
  requiresLock: boolean;
  sharedHash: string | null;
  /** Valid code entries that can still unlock (id + hash). */
  activeCodes: Array<{ id: string; passwordHash: string; expiresAt: string | null }>;
};

/**
 * Returns true when the visitor cookie unlocks the page under the current gate
 * (shared password and/or access codes).
 */
export async function isCampaignPageUnlockedWithGate(
  slug: string,
  gate: CampaignPageLockGate
): Promise<boolean> {
  if (!gate.requiresLock) return true;

  const cookieStore = await cookies();
  const token = cookieStore.get(getCampaignPageUnlockCookieName(slug))?.value;
  const parsed = await verifyCampaignPageUnlockTokenSignature(token);
  if (!parsed || parsed.slug !== slug) return false;

  if (parsed.source.kind === "shared") {
    return Boolean(gate.sharedHash && parsed.source.passwordHash === gate.sharedHash);
  }

  const { codeId, passwordHash } = parsed.source;
  const code = gate.activeCodes.find((item) => item.id === codeId);
  if (!code) return false;
  if (code.passwordHash !== passwordHash) return false;
  if (code.expiresAt && new Date(code.expiresAt).getTime() <= Date.now()) return false;
  return true;
}

/** Strip password hashes before sending settings to the browser. */
export function sanitizePublicCampaignSettings<T extends { meetingsViewPasswordHash?: string | null; pageViewPasswordHash?: string | null }>(
  settings: T
): T {
  return {
    ...settings,
    meetingsViewPasswordHash: null,
    pageViewPasswordHash: null,
  };
}
