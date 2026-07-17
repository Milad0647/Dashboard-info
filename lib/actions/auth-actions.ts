"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  getAdminSessionCookieName,
  getAdminSessionCookieOptions,
  getLegacyMockCookieName,
  verifyEffectiveAdminCredentials,
} from "@/lib/auth/admin-session";
import {
  createAdminSessionTokenSync,
  createUserSessionTokenSync,
} from "@/lib/auth/admin-session-node";
import { verifyPassword } from "@/lib/auth/password";
import { pgGetUserAuthByLogin } from "@/lib/db/repository-extended";
import { getAuthSession } from "@/lib/auth/get-session";
import { bumpSessionVersion, getSessionVersion } from "@/lib/auth/session-versions";
import { logAuditEvent, logAuditForSession } from "@/lib/audit/log-event";
import { consumeRateLimit, resetRateLimit } from "@/lib/security/rate-limit";
import { isPostgresConfigured } from "@/lib/utils";

async function resolveLoginRateLimitKey(email: string): Promise<string> {
  const headerStore = await headers();
  const forwarded = headerStore.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    headerStore.get("x-real-ip")?.trim() ||
    "unknown";
  return `login:${ip}:${email.trim().toLowerCase() || "empty"}`;
}

export async function loginAdminAction(email: string, password: string) {
  const loginEmail = email.trim();
  const rateKey = await resolveLoginRateLimitKey(loginEmail);
  const rate = consumeRateLimit(rateKey, {
    limit: 5,
    windowMs: 15 * 60 * 1000,
    lockMs: 15 * 60 * 1000,
  });

  if (!rate.ok) {
    return {
      success: false as const,
      error: `تلاش‌های ورود بیش از حد مجاز است. ${rate.retryAfterSec} ثانیه دیگر دوباره تلاش کنید`,
    };
  }

  // Prefer DB user sessions so profile and ownership work.
  if (isPostgresConfigured()) {
    const user = await pgGetUserAuthByLogin(email);
    if (user && (await verifyPassword(password, user.passwordHash))) {
      const cookieStore = await cookies();
      const sessionVersion = await getSessionVersion(user.id);
      const token = createUserSessionTokenSync(user.id, user.role, sessionVersion);
      const cookieOptions = getAdminSessionCookieOptions();

      cookieStore.set(getAdminSessionCookieName(), token, cookieOptions);
      cookieStore.set(getLegacyMockCookieName(), "", { ...cookieOptions, maxAge: 0 });
      resetRateLimit(rateKey);

      await logAuditEvent({
        actorUserId: user.id,
        actorType: "db_user",
        actorEmail: user.email,
        actorName: user.name,
        actorRole: user.role,
        category: "auth",
        action: "auth.login",
        label: "ورود کاربر",
        metadata: { method: "db_user" },
      });

      redirect("/admin");
    }
  }

  if (await verifyEffectiveAdminCredentials(email, password)) {
    const cookieStore = await cookies();
    const cookieOptions = getAdminSessionCookieOptions();

    // If env admin email matches a DB user, attach that profile to the session.
    if (isPostgresConfigured()) {
      const linkedUser = await pgGetUserAuthByLogin(email);
      if (linkedUser) {
        const sessionVersion = await getSessionVersion(linkedUser.id);
        const token = createUserSessionTokenSync(linkedUser.id, linkedUser.role, sessionVersion);
        cookieStore.set(getAdminSessionCookieName(), token, cookieOptions);
        cookieStore.set(getLegacyMockCookieName(), "", { ...cookieOptions, maxAge: 0 });
        resetRateLimit(rateKey);

        await logAuditEvent({
          actorUserId: linkedUser.id,
          actorType: "db_user",
          actorEmail: linkedUser.email,
          actorName: linkedUser.name,
          actorRole: linkedUser.role,
          category: "auth",
          action: "auth.login",
          label: "ورود مدیر سیستم (پروفایل کاربری)",
          metadata: { method: "env_admin_linked_db_user" },
        });

        redirect("/admin");
      }
    }

    const sessionVersion = await getSessionVersion(null);
    const token = createAdminSessionTokenSync(sessionVersion);
    cookieStore.set(getAdminSessionCookieName(), token, cookieOptions);
    cookieStore.set(getLegacyMockCookieName(), "", { ...cookieOptions, maxAge: 0 });
    resetRateLimit(rateKey);

    await logAuditEvent({
      actorType: "env_admin",
      actorEmail: loginEmail || null,
      actorName: "مدیر سیستم",
      actorRole: "admin",
      category: "auth",
      action: "auth.login",
      label: "ورود مدیر سیستم",
      metadata: { method: "env_admin" },
    });

    redirect("/admin");
  }

  await logAuditEvent({
    actorType: "anonymous",
    actorEmail: loginEmail || null,
    category: "auth",
    action: "auth.login_failed",
    label: "ورود ناموفق",
    metadata: { email: loginEmail },
  });

  return { success: false as const, error: "ایمیل یا رمز عبور اشتباه است" };
}

export async function logoutAdminAction() {
  const session = await getAuthSession();
  await logAuditForSession(session, {
    category: "auth",
    action: "auth.logout",
    label: "خروج از پنل",
  });

  if (session) {
    await bumpSessionVersion(session.userId);
  }

  const cookieStore = await cookies();
  const cookieOptions = getAdminSessionCookieOptions(0);

  cookieStore.set(getAdminSessionCookieName(), "", cookieOptions);
  cookieStore.set(getLegacyMockCookieName(), "", cookieOptions);
}
