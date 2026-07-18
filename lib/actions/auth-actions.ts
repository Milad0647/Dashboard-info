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
import { consumeRateLimit, getRateLimitBlock, resetRateLimit } from "@/lib/security/rate-limit";
import { recordLoginSecurityAlert } from "@/lib/security/login-alerts";
import { resolveSafeAuthRedirect } from "@/lib/auth/safe-redirect";
import { isPostgresConfigured } from "@/lib/utils";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LIMIT = 5;

async function resolveLoginClient(email: string): Promise<{ rateKey: string; ip: string }> {
  const headerStore = await headers();
  const forwarded = headerStore.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    headerStore.get("x-real-ip")?.trim() ||
    "unknown";
  return {
    ip,
    rateKey: `login:${ip}:${email.trim().toLowerCase() || "empty"}`,
  };
}

async function registerFailedLogin(rateKey: string, loginEmail: string, ip: string) {
  const rate = consumeRateLimit(rateKey, {
    limit: LOGIN_LIMIT,
    windowMs: LOGIN_WINDOW_MS,
    lockMs: LOGIN_WINDOW_MS,
  });

  await logAuditEvent({
    actorType: "anonymous",
    actorEmail: loginEmail || null,
    category: "auth",
    action: "auth.login_failed",
    label: "ورود ناموفق",
    metadata: { email: loginEmail, ip },
  });

  if (!rate.ok) {
    await recordLoginSecurityAlert({
      email: loginEmail || null,
      ipAddress: ip,
      reason: "rate_limited",
      failureCount: LOGIN_LIMIT,
    });
    await logAuditEvent({
      actorType: "anonymous",
      actorEmail: loginEmail || null,
      category: "auth",
      action: "auth.login_suspicious",
      label: "قفل موقت ورود به‌خاطر تلاش‌های مشکوک",
      metadata: { ip, retryAfterSec: rate.retryAfterSec },
    });
    return {
      success: false as const,
      error: `تلاش‌های ورود بیش از حد مجاز است. ${rate.retryAfterSec} ثانیه دیگر دوباره تلاش کنید`,
    };
  }

  if (rate.ok) {
    // After 3 failures in the window, raise a soft alert (still allowing more attempts until lock).
    const soft = consumeRateLimit(`login-soft:${rateKey}`, {
      limit: 3,
      windowMs: LOGIN_WINDOW_MS,
    });
    if (!soft.ok) {
      await recordLoginSecurityAlert({
        email: loginEmail || null,
        ipAddress: ip,
        reason: "repeated_failures",
        failureCount: 3,
      });
    }
  }

  return { success: false as const, error: "ایمیل یا رمز عبور اشتباه است" };
}

export async function loginAdminAction(
  email: string,
  password: string,
  nextPath?: string | null
) {
  const loginEmail = email.trim();
  const redirectTo = resolveSafeAuthRedirect(nextPath);
  const { rateKey, ip } = await resolveLoginClient(loginEmail);

  try {
    const blocked = getRateLimitBlock(rateKey);
    if (!blocked.ok) {
      await recordLoginSecurityAlert({
        email: loginEmail || null,
        ipAddress: ip,
        reason: "rate_limited",
        failureCount: LOGIN_LIMIT,
      }).catch(() => {});
      return {
        success: false as const,
        error: `تلاش‌های ورود بیش از حد مجاز است. ${blocked.retryAfterSec} ثانیه دیگر دوباره تلاش کنید`,
      };
    }

    // System admin credentials always win. Checking them before DB users prevents
    // a same-email contributor/client row from downgrading the owner to a limited
    // session (which then bounces protected admin sections back to /admin).
    if (await verifyEffectiveAdminCredentials(email, password)) {
      const cookieStore = await cookies();
      const cookieOptions = getAdminSessionCookieOptions();

      // Prefer a linked DB profile only when that profile is also admin.
      if (isPostgresConfigured()) {
        const linkedUser = await pgGetUserAuthByLogin(email);
        if (linkedUser && linkedUser.role === "admin") {
          const sessionVersion = await getSessionVersion(linkedUser.id);
          const token = createUserSessionTokenSync(linkedUser.id, linkedUser.role, sessionVersion);
          cookieStore.set(getAdminSessionCookieName(), token, cookieOptions);
          cookieStore.set(getLegacyMockCookieName(), "", { ...cookieOptions, maxAge: 0 });
          resetRateLimit(rateKey);
          resetRateLimit(`login-soft:${rateKey}`);

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

          redirect(redirectTo);
        }
      }

      const sessionVersion = await getSessionVersion(null);
      const token = createAdminSessionTokenSync(sessionVersion);
      cookieStore.set(getAdminSessionCookieName(), token, cookieOptions);
      cookieStore.set(getLegacyMockCookieName(), "", { ...cookieOptions, maxAge: 0 });
      resetRateLimit(rateKey);
      resetRateLimit(`login-soft:${rateKey}`);

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

      redirect(redirectTo);
    }

    // Regular panel users (contributor / client / DB admin without system creds).
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
        resetRateLimit(`login-soft:${rateKey}`);

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

        redirect(redirectTo);
      }
    }

    return registerFailedLogin(rateKey, loginEmail, ip);
  } catch (error) {
    // next/navigation redirect() throws; must not be swallowed.
    if (
      typeof error === "object" &&
      error !== null &&
      "digest" in error &&
      typeof (error as { digest?: unknown }).digest === "string" &&
      (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }
    console.error("[auth] loginAdminAction failed:", error);
    const message =
      error instanceof Error && error.message.includes("AUTH_SECRET")
        ? "تنظیم AUTH_SECRET در سرور ناقص است"
        : "ورود با خطا مواجه شد. دوباره تلاش کنید";
    return { success: false as const, error: message };
  }
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
