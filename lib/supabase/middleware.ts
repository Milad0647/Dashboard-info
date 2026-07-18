import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  getAdminSessionCookieName,
  verifyAdminSessionToken,
} from "@/lib/auth/admin-session";
import { resolveSafeAuthRedirect } from "@/lib/auth/safe-redirect";
import { isPostgresConfigured, isSupabaseConfigured } from "@/lib/utils";

function redirectAuthenticatedFromLogin(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = resolveSafeAuthRedirect(request.nextUrl.searchParams.get("next"));
  url.search = "";
  return NextResponse.redirect(url);
}

function handleEnvAdminAuth(request: NextRequest) {
  return verifyAdminSessionToken(request.cookies.get(getAdminSessionCookieName())?.value).then(
    (isAuthenticated) => {
      const isAdminRoute =
        request.nextUrl.pathname.startsWith("/admin") &&
        !request.nextUrl.pathname.startsWith("/admin/login");

      if (isAdminRoute && !isAuthenticated) {
        const url = request.nextUrl.clone();
        url.pathname = "/admin/login";
        return NextResponse.redirect(url);
      }

      if (request.nextUrl.pathname === "/admin/login" && isAuthenticated) {
        return redirectAuthenticatedFromLogin(request);
      }

      return NextResponse.next({ request });
    }
  );
}

export async function updateSession(request: NextRequest) {
  if (isPostgresConfigured() || !isSupabaseConfigured()) {
    return handleEnvAdminAuth(request);
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAdminRoute =
    request.nextUrl.pathname.startsWith("/admin") &&
    !request.nextUrl.pathname.startsWith("/admin/login");

  if (isAdminRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    return NextResponse.redirect(url);
  }

  if (request.nextUrl.pathname === "/admin/login" && user) {
    return redirectAuthenticatedFromLogin(request);
  }

  return supabaseResponse;
}
