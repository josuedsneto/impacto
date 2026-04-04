import type { NextConfig } from "next";

// Trusted backend origins — fall back to localhost for local dev.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://*.supabase.co";
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// SHA-256 hash of the inline theme-detection script in app/layout.tsx.
// Recompute if the script changes: printf '<script>' | openssl dgst -sha256 -binary | openssl base64
const THEME_SCRIPT_HASH = "sha256-mJZHY/i9NucSrP9dUPMldBM/ANm6aguQIO345P3dGR4=";

const csp = [
  "default-src 'self'",
  // Inline theme script allowed via hash only — no 'unsafe-inline'
  `script-src 'self' '${THEME_SCRIPT_HASH}'`,
  // Tailwind and shadcn inject styles at runtime
  "style-src 'self' 'unsafe-inline'",
  // next/font downloads font files from Google; data: for base64 fonts
  "font-src 'self' data: https://fonts.gstatic.com",
  // API calls, Supabase realtime/auth, and image optimisation
  `connect-src 'self' ${supabaseUrl} ${apiUrl}`,
  // Self-hosted images plus data URIs and blob for canvas/charts
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
