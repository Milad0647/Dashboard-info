import { getAuthSecret } from "@/lib/auth/secret";
import type { AuthSession, SessionRole } from "@/lib/types";

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

async function signPayloadAsync(payload: string): Promise<string> {
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

function parsePayload(payload: string): AuthSession | null {
  const parts = payload.split(":");
  if (parts[0] === "admin" && parts.length === 3) {
    const expiresAt = Number(parts[1]);
    const sessionVersion = Number(parts[2]);
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
    if (!Number.isFinite(sessionVersion) || sessionVersion < 0) return null;
    return {
      type: "env_admin",
      userId: null,
      role: "admin",
      sessionVersion: Math.floor(sessionVersion),
    };
  }

  if (parts[0] === "user" && parts.length === 5) {
    const [, userId, role, expiresAtRaw, versionRaw] = parts;
    const expiresAt = Number(expiresAtRaw);
    const sessionVersion = Number(versionRaw);
    if (!userId || (role !== "admin" && role !== "contributor" && role !== "client")) return null;
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
    if (!Number.isFinite(sessionVersion) || sessionVersion < 0) return null;
    return {
      type: "db_user",
      userId,
      role: role as SessionRole,
      sessionVersion: Math.floor(sessionVersion),
    };
  }

  return null;
}

export function buildEnvAdminPayload(
  sessionVersion: number,
  expiresAt = Date.now() + SESSION_TTL_MS
): string {
  return `admin:${expiresAt}:${sessionVersion}`;
}

export function buildUserSessionPayload(
  userId: string,
  role: SessionRole,
  sessionVersion: number,
  expiresAt = Date.now() + SESSION_TTL_MS
): string {
  return `user:${userId}:${role}:${expiresAt}:${sessionVersion}`;
}

export async function createSignedSessionToken(payload: string): Promise<string> {
  const signature = await signPayloadAsync(payload);
  return `${payload}.${signature}`;
}

export async function parseSessionToken(token: string | undefined | null): Promise<AuthSession | null> {
  if (!token) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = await signPayloadAsync(payload);
  if (signature.length !== expected.length) return null;

  let mismatch = 0;
  for (let i = 0; i < signature.length; i += 1) {
    mismatch |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  if (mismatch !== 0) return null;

  return parsePayload(payload);
}

export async function verifyAdminSessionToken(token: string | undefined | null): Promise<boolean> {
  const session = await parseSessionToken(token);
  if (!session) return false;

  const { isSessionVersionCurrent } = await import("@/lib/auth/session-versions");
  return isSessionVersionCurrent(session.userId, session.sessionVersion);
}

export function getSessionTtlMs() {
  return SESSION_TTL_MS;
}
