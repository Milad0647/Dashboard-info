import { createHmac, timingSafeEqual } from "crypto";
import { getAuthSecret } from "@/lib/auth/secret";
import type { AuthSession, SessionRole } from "@/lib/types";
import { buildEnvAdminPayload, buildUserSessionPayload, getSessionTtlMs } from "@/lib/auth/session";

function signPayloadSync(payload: string): string {
  return createHmac("sha256", getAuthSecret()).update(payload).digest("hex");
}

function verifySignature(payload: string, signature: string): boolean {
  const expected = signPayloadSync(payload);
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (sigBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(sigBuffer, expectedBuffer);
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

export function createAdminSessionTokenSync(sessionVersion: number): string {
  const payload = buildEnvAdminPayload(sessionVersion, Date.now() + getSessionTtlMs());
  return `${payload}.${signPayloadSync(payload)}`;
}

export function createUserSessionTokenSync(
  userId: string,
  role: SessionRole,
  sessionVersion: number
): string {
  const payload = buildUserSessionPayload(userId, role, sessionVersion, Date.now() + getSessionTtlMs());
  return `${payload}.${signPayloadSync(payload)}`;
}

export function parseSessionTokenSync(token: string | undefined | null): AuthSession | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !verifySignature(payload, signature)) return null;
  return parsePayload(payload);
}

export function verifyAdminSessionTokenSync(token: string | undefined | null): boolean {
  return parseSessionTokenSync(token) !== null;
}
