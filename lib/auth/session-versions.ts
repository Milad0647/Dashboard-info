import { getSql } from "@/lib/db/client";
import { isPostgresConfigured } from "@/lib/utils";

const SESSION_VERSIONS_KEY = "auth_session_versions";
const ENV_ADMIN_KEY = "__env_admin__";

type SessionVersions = {
  versions: Record<string, number>;
};

const memoryVersions: SessionVersions = { versions: {} };

function normalizeVersions(value: unknown): SessionVersions {
  if (!value || typeof value !== "object") return { versions: {} };
  const record = value as { versions?: Record<string, unknown> };
  const versions: Record<string, number> = {};
  if (record.versions && typeof record.versions === "object") {
    for (const [key, raw] of Object.entries(record.versions)) {
      const num = Number(raw);
      if (Number.isFinite(num) && num >= 0) versions[key] = Math.floor(num);
    }
  }
  return { versions };
}

async function readVersions(): Promise<SessionVersions> {
  if (!isPostgresConfigured()) {
    return memoryVersions;
  }

  try {
    const sql = getSql();
    const rows = await sql`
      SELECT value FROM system_settings WHERE key = ${SESSION_VERSIONS_KEY} LIMIT 1
    `;
    const parsed = normalizeVersions(rows[0]?.value);
    memoryVersions.versions = { ...parsed.versions };
    return parsed;
  } catch {
    return memoryVersions;
  }
}

async function writeVersions(next: SessionVersions): Promise<void> {
  memoryVersions.versions = { ...next.versions };

  if (!isPostgresConfigured()) return;

  const sql = getSql();
  const now = new Date().toISOString();
  await sql`
    INSERT INTO system_settings (key, value, updated_at)
    VALUES (${SESSION_VERSIONS_KEY}, ${sql.json(JSON.parse(JSON.stringify(next)))}, ${now})
    ON CONFLICT (key) DO UPDATE SET
      value = EXCLUDED.value,
      updated_at = EXCLUDED.updated_at
  `;
}

function versionKey(userId: string | null | undefined): string {
  return userId?.trim() || ENV_ADMIN_KEY;
}

export async function getSessionVersion(userId: string | null | undefined): Promise<number> {
  const versions = await readVersions();
  return versions.versions[versionKey(userId)] ?? 0;
}

export async function bumpSessionVersion(userId: string | null | undefined): Promise<number> {
  const versions = await readVersions();
  const key = versionKey(userId);
  const nextVersion = (versions.versions[key] ?? 0) + 1;
  versions.versions[key] = nextVersion;
  await writeVersions(versions);
  return nextVersion;
}

export async function isSessionVersionCurrent(
  userId: string | null | undefined,
  sessionVersion: number | undefined
): Promise<boolean> {
  if (sessionVersion === undefined || !Number.isFinite(sessionVersion)) return false;
  const current = await getSessionVersion(userId);
  return sessionVersion === current;
}
