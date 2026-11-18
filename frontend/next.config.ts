import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Origens confiáveis. Em produção são obrigatórias (sem fallback para localhost
// nem wildcard): se faltarem, o build falha em vez de gerar um CSP frouxo.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
if (process.env.NODE_ENV === "production" && (!supabaseUrl || !apiUrl)) {
  throw new Error(
    "Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_API_URL para o build de produção (connect-src do CSP)."
  );
}

// Next.js App Router injects dynamic inline scripts (RSC flight data) whose
// content changes per request and cannot be pre-hashed. 'unsafe-inline' is
// required. The other directives (connect-src, frame-ancestors, etc.) still
// provide meaningful protection.
const csp = isDev
  ? [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data: https://fonts.gstatic.com",
      `connect-src 'self' ${supabaseUrl || "https://*.supabase.co"} ${apiUrl || "http://localhost:8000"} ws://localhost:* http://localhost:*`,
      "img-src 'self' data: blob:",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ")
  : [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data: https://fonts.gstatic.com",
      `connect-src 'self' ${supabaseUrl} ${apiUrl}`,
      "img-src 'self' data: blob:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");

const nextConfig: NextConfig = {
  // Rotas antigas da reorganização do menu. permanent: false para não ficarem gravadas no navegador.
  async redirects() {
    return [
      { source: "/app/cenarios", destination: "/app/breakeven-safra", permanent: false },
      { source: "/app/market", destination: "/app/mercado?aba=precos", permanent: false },
      { source: "/app/fixacoes", destination: "/app/mercado?aba=sinais", permanent: false },
    ];
  },
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
