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
  "img-src 'self' data: blob: https://www.aparat.com https://aparat.com https://*.supabase.co https://billboard.pixlink.ir https://*.pixlink.ir https://*.darkube.ir",
  "media-src 'self' blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co https://billboard.pixlink.ir https://*.pixlink.ir https://*.darkube.ir",
  "frame-src 'self' https://www.aparat.com https://aparat.com https://*.darkube.ir",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname),
  // Keep archiver (ESM streaming ZIP) outside the bundler so ZipArchive works at runtime.
  serverExternalPackages: ["archiver"],
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
