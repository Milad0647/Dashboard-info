import type { NextConfig } from "next";
import path from "path";

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.aparat.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://www.aparat.com https://aparat.com https://*.supabase.co https://*.darkube.ir",
  "media-src 'self' blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co https://*.darkube.ir",
  "frame-src 'self' https://www.aparat.com https://aparat.com https://*.darkube.ir",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  distDir: ".next-build",
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname),
  // Keep yazl outside the bundler so streaming ZIP works reliably at runtime.
  serverExternalPackages: ["yazl"],
  // Docker/Coolify builds are memory-constrained; lint locally / in CI instead.
  eslint: {
    ignoreDuringBuilds: process.env.DOCKER_BUILD === "1",
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "2gb",
    },
  },
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 7,
    // Allow signed /api/files/?exp=&sig= URLs (omit search = any query string).
    localPatterns: [{ pathname: "/api/files/**" }, { pathname: "/images/**" }],
    remotePatterns: [
      { protocol: "http", hostname: "localhost" },
      { protocol: "http", hostname: "127.0.0.1" },
      { protocol: "https", hostname: "aparat.com" },
      { protocol: "https", hostname: "www.aparat.com" },
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "billboard.pixlink.ir" },
      { protocol: "https", hostname: "*.pixlink.ir" },
      { protocol: "https", hostname: "*.darkube.ir" },
    ],
  },
  async headers() {
    return [
      {
        // Avoid CDN/proxy serving stale HTML that points at old Server Action IDs.
        source: "/((?!_next/static|_next/image|images|favicon.ico|.*\\.(?:ico|png|jpg|jpeg|gif|webp|svg|woff2?)$).*)",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-cache, no-store, max-age=0, must-revalidate",
          },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
