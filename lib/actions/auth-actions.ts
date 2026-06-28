"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  getAdminSessionCookieName,
  getAdminSessionCookieOptions,
  getLegacyMockCookieName,
  verifyAdminCredentials,
} from "@/lib/auth/admin-session";
import {
  createAdminSessionTokenSync,
  createUserSessionTokenSync,
} from "@/lib/auth/admin-session-node";
import { verifyPassword } from "@/lib/auth/password";
import { pgGetUserAuthByLogin } from "@/lib/db/repository-extended";
import { isPostgresConfigured } from "@/lib/utils";

export async function loginAdminAction(email: string, password: string) {
  if (verifyAdminCredentials(email, password)) {
    const cookieStore = await cookies();
    const token = createAdminSessionTokenSync();
    const cookieOptions = getAdminSessionCookieOptions();

    cookieStore.set(getAdminSessionCookieName(), token, cookieOptions);
    cookieStore.set(getLegacyMockCookieName(), "", { ...cookieOptions, maxAge: 0 });
    redirect("/admin");
  }

  if (isPostgresConfigured()) {
    const user = await pgGetUserAuthByLogin(email);
    if (user && (await verifyPassword(password, user.passwordHash))) {
      const cookieStore = await cookies();
      const token = createUserSessionTokenSync(user.id, user.role);
      const cookieOptions = getAdminSessionCookieOptions();

      cookieStore.set(getAdminSessionCookieName(), token, cookieOptions);
      cookieStore.set(getLegacyMockCookieName(), "", { ...cookieOptions, maxAge: 0 });
      redirect("/admin");
    }
  }

  return { success: false as const, error: "ایمیل یا رمز عبور اشتباه است" };
}

export async function logoutAdminAction() {
  const cookieStore = await cookies();
  const cookieOptions = getAdminSessionCookieOptions(0);

  cookieStore.set(getAdminSessionCookieName(), "", cookieOptions);
  cookieStore.set(getLegacyMockCookieName(), "", cookieOptions);
}
