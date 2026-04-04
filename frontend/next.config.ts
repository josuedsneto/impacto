import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Trusted backend origins — fall back to localhost for local dev.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://*.supabase.co";
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// SHA-256 hash of the inline theme-detection script in app/layout.tsx.
// Recompute if the script changes: printf '<script>' | openssl dgst -sha256 -binary | openssl base64
const THEME_SCRIPT_HASH = "sha256-mJZHY/i9NucSrP9dUPMldBM/ANm6aguQIO345P3dGR4=";

// In development Turbopack injects many dynamic inline scripts that cannot be
// pre-hashed, so we allow 'unsafe-inline' + 'unsafe-eval' there.
// In production only the known theme-script hash is allowed.
const csp = isDev
  ? [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data: https://fonts.gstatic.com",
      `connect-src 'self' ${supabaseUrl} ${apiUrl} ws://localhost:* http://localhost:*`,
      "img-src 'self' data: blob:",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ")
  : [
      "default-src 'self'",
      `script-src 'self' '${THEME_SCRIPT_HASH}'`,
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data: https://fonts.gstatic.com",
      `connect-src 'self' ${supabaseUrl} ${apiUrl}`,
      "img-src 'self' data: blob:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
