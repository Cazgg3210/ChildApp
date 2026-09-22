import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/shared/i18n/request.ts");

const isDev = process.env.NODE_ENV !== "production";
// Next.js needs inline scripts/styles; 'unsafe-eval' only in development (Turbopack HMR).
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const noIndex = { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" };

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ["pino", "pino-pretty", "@prisma/client", "@prisma/adapter-pg", "pg"],
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      { source: "/s/:path*", headers: [noIndex] },
      { source: "/app/:path*", headers: [noIndex] },
      { source: "/institution/:path*", headers: [noIndex] },
      { source: "/api/:path*", headers: [noIndex] },
      { source: "/files/:path*", headers: [noIndex] },
    ];
  },
};

export default withNextIntl(nextConfig);
