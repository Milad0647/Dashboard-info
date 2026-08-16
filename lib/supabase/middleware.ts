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

function buildLoginRedirectUrl(request: NextRequest): URL {
  const url = request.nextUrl.clone();
  url.pathname = "/admin/login";
  const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  if (nextPath.startsWith("/admin") && nextPath !== "/admin/login") {
    url.searchParams.set("next", nextPath);
  } else {
    url.search = "";
  }
  return url;
}

/**
 * Auth failure for Server Actions must use the action-redirect protocol.
 * A normal 307/302 HTML redirect makes the client throw
 * "An unexpected response was received from the server."
 */
function redirectUnauthorized(request: NextRequest): NextResponse {
  const loginUrl = buildLoginRedirectUrl(request);

  if (request.headers.has("next-action")) {
    return new NextResponse(null, {
      status: 303,
      headers: {
        "X-Action-Redirect": `${loginUrl.pathname}${loginUrl.search}`,
      },
    });
  }

  return NextResponse.redirect(loginUrl);
}

async function handleEnvAdminAuth(request: NextRequest) {
  const isAuthenticated = await verifyAdminSessionToken(
    request.cookies.get(getAdminSessionCookieName())?.value
  );
  const isLoginRoute = request.nextUrl.pathname.startsWith("/admin/login");
  const isAdminRoute = request.nextUrl.pathname.startsWith("/admin") && !isLoginRoute;

  if (isAdminRoute && !isAuthenticated) {
    return redirectUnauthorized(request);
  }

  // Intentionally do not redirect authenticated cookies away from /admin/login.
  // Middleware only verifies signature/expiry; getAuthSession() also checks
  // sessionVersion. Redirecting revoked sessions back to the panel caused an
  // infinite loop that looked like admin pages never loading.
  // The login page performs the full session check and redirects when valid.
  return NextResponse.next({ request });
}

async function handleSupabaseAuth(request: NextRequest) {
  // Keep @supabase/ssr out of the default Edge graph used by Postgres deploys.
  const { createServerClient } = await import("@supabase/ssr");

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
    return redirectUnauthorized(request);
  }

  if (request.nextUrl.pathname === "/admin/login" && user) {
    return redirectAuthenticatedFromLogin(request);
  }

  return supabaseResponse;
}

export async function updateSession(request: NextRequest) {
  if (isPostgresConfigured() || !isSupabaseConfigured()) {
    return handleEnvAdminAuth(request);
  }

  return handleSupabaseAuth(request);
}
