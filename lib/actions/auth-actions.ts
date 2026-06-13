"use server";

import { cookies } from "next/headers";
import {
  createAdminSessionToken,
  getAdminSessionCookieName,
  verifyAdminCredentials,
} from "@/lib/auth/admin-session";

export async function loginAdminAction(email: string, password: string) {
  if (!verifyAdminCredentials(email, password)) {
    return { success: false as const, error: "ایمیل یا رمز عبور اشتباه است" };
  }

  const token = await createAdminSessionToken();
  const cookieStore = await cookies();
  cookieStore.set(getAdminSessionCookieName(), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });

  return { success: true as const };
}

export async function logoutAdminAction() {
  const cookieStore = await cookies();
  cookieStore.set(getAdminSessionCookieName(), "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
