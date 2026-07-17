import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { normalizeStoredUserEmail } from "@/lib/auth/user-login";
import { getSql } from "@/lib/db/client";
import { isPostgresConfigured } from "@/lib/utils";

const ADMIN_CREDENTIALS_KEY = "admin_credentials";

const WEAK_ENV_ADMIN_PASSWORDS = new Set([
  "",
  "password",
  "admin",
  "1234",
  "123456",
  "admin123",
]);

export type StoredAdminCredentials = {
  email: string;
  passwordHash: string;
};

export type EffectiveAdminCredentials = {
  email: string;
  source: "database" | "env";
};

function getEnvAdminEmail() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (email) return email;
  if (process.env.NODE_ENV === "production") return "";
  return "admin@example.com";
}

function getEnvAdminPassword() {
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (process.env.NODE_ENV === "production") {
    return password;
  }
  return password || "password";
}

function isWeakEnvAdminPassword(password: string): boolean {
  return WEAK_ENV_ADMIN_PASSWORDS.has(password.trim().toLowerCase()) || password.trim().length < 8;
}

function normalizeStoredCredentials(value: unknown): StoredAdminCredentials | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<StoredAdminCredentials>;
  const email = typeof record.email === "string" ? record.email.trim().toLowerCase() : "";
  const passwordHash = typeof record.passwordHash === "string" ? record.passwordHash.trim() : "";
  if (!email || !passwordHash) return null;
  return { email, passwordHash };
}

export async function pgGetStoredAdminCredentials(): Promise<StoredAdminCredentials | null> {
  if (!isPostgresConfigured()) return null;

  try {
    const sql = getSql();
    const rows = await sql`
      SELECT value FROM system_settings WHERE key = ${ADMIN_CREDENTIALS_KEY} LIMIT 1
    `;
    return normalizeStoredCredentials(rows[0]?.value);
  } catch {
    return null;
  }
}

export async function getEffectiveAdminCredentials(): Promise<EffectiveAdminCredentials> {
  const stored = await pgGetStoredAdminCredentials();
  if (stored) {
    return { email: stored.email, source: "database" };
  }

  return { email: getEnvAdminEmail(), source: "env" };
}

export async function verifyEffectiveAdminCredentials(
  email: string,
  password: string
): Promise<boolean> {
  const loginEmail = email.trim().toLowerCase();
  if (!loginEmail || !password) return false;

  const stored = await pgGetStoredAdminCredentials();
  if (stored) {
    if (loginEmail !== stored.email && normalizeStoredUserEmail(loginEmail) !== stored.email) {
      return false;
    }
    return verifyPassword(password, stored.passwordHash);
  }

  const envEmail = getEnvAdminEmail();
  const envPassword = getEnvAdminPassword();
  if (!envEmail || !envPassword) return false;

  if (process.env.NODE_ENV === "production" && isWeakEnvAdminPassword(envPassword)) {
    console.error(
      "[auth] ADMIN_PASSWORD is missing or too weak for production. Env admin login is disabled."
    );
    return false;
  }

  return (
    (loginEmail === envEmail || normalizeStoredUserEmail(loginEmail) === envEmail) &&
    password === envPassword
  );
}

export async function pgSaveAdminCredentials(data: {
  email: string;
  password?: string;
}): Promise<{ success: true; email: string } | { success: false; error: string }> {
  if (!isPostgresConfigured()) {
    return { success: false, error: "Database required" };
  }

  const email = normalizeStoredUserEmail(data.email);
  if (!email) {
    return { success: false, error: "نام کاربری الزامی است" };
  }

  const existing = await pgGetStoredAdminCredentials();
  let passwordHash = existing?.passwordHash ?? "";

  if (data.password?.trim()) {
    // System admin credential only — does not change regular user password policy.
    if (data.password.trim().length < 8) {
      return { success: false, error: "رمز مدیر باید حداقل ۸ کاراکتر باشد" };
    }
    passwordHash = await hashPassword(data.password.trim());
  }

  if (!passwordHash) {
    const envPassword = getEnvAdminPassword();
    if (!envPassword || isWeakEnvAdminPassword(envPassword)) {
      return { success: false, error: "رمز عبور مدیر الزامی است" };
    }
    passwordHash = await hashPassword(envPassword);
  }

  const sql = getSql();
  const now = new Date().toISOString();
  const payload: StoredAdminCredentials = { email, passwordHash };

  await sql`
    INSERT INTO system_settings (key, value, updated_at)
    VALUES (${ADMIN_CREDENTIALS_KEY}, ${sql.json(JSON.parse(JSON.stringify(payload)))}, ${now})
    ON CONFLICT (key) DO UPDATE SET
      value = EXCLUDED.value,
      updated_at = EXCLUDED.updated_at
  `;

  return { success: true, email };
}
