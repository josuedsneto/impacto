import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Sugarcane — Gestão de risco para o mercado sucroenergético",
  description:
    "Simulações Monte Carlo, precificação de opções Black-Scholes, gestão de hedge e análise cambial para usinas e traders de açúcar. Dados em tempo real.",
};

const LOGO = (
  <svg
    width="28"
    height="28"
    viewBox="0 0 26 26"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <rect width="26" height="26" rx="7" fill="#16a34a" />
    <line x1="13" y1="22" x2="13" y2="6" stroke="#bbf7d0" strokeWidth="2.2" strokeLinecap="round" />
    <circle cx="13" cy="18" r="1.5" fill="#4ade80" />
    <circle cx="13" cy="13" r="1.5" fill="#4ade80" />
    <circle cx="13" cy="8" r="1.5" fill="#4ade80" />
    <path d="M13 18 Q18 15 17 10" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    <path d="M13 13 Q8 10 9 5" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    <path d="M13 8 Q17 6 16 3" stroke="#86efac" strokeWidth="1.2" strokeLinecap="round" fill="none" />
  </svg>
);

const FEATURES = [
  {
    icon: "📊",
    title: "Monte Carlo",
    desc: "10.000 simulações de preço com fan chart P5–P95 e exportação CSV por horizonte.",
  },
  {
    icon: "🛡️",
    title: "Gestão de Hedge",
    desc: "Livro de fixações com cobertura acumulada, P&L por tranche e preço médio ponderado.",
  },
  {
    icon: "⚠️",
    title: "VaR & Estresse",
    desc: "Value at Risk histórico e paramétrico com testes de estresse nos cenários extremos.",
  },
  {
    icon: "📈",
    title: "Black-Scholes & Opções",
    desc: "Precificador de opções europeias, curva de prêmio por strike e diagrama de payoff multi-leg.",
  },
  {
    icon: "🔔",
    title: "Alertas de Preço",
    desc: "Configure gatilhos de preço e receba notificações por email quando o mercado atingir seu alvo.",
  },
  {
    icon: "🏭",
    title: "Multi-usina",
    desc: "Equipes por usina com convites por email, histórico compartilhado e controle de acesso.",
  },
];

const STEPS = [
  { n: "01", title: "Conecte sua usina", desc: "Crie sua conta, cadastre a usina e convide sua equipe em minutos." },
  { n: "02", title: "Monitore o mercado", desc: "Painel com açúcar NY, USD/BRL e SELIC em tempo real. Alertas automáticos quando cruzar seu preço-alvo." },
  { n: "03", title: "Simule e decida", desc: "Rode Monte Carlo para qualquer horizonte, veja o fan chart e exporte o relatório PDF para a diretoria." },
];

const PLANS = [
  {
    name: "Básico",
    price: "Grátis",
    cta: "Começar grátis",
    ctaHref: "/login",
    highlight: false,
    items: ["Todas as análises de mercado", "Monte Carlo ilimitado", "1 usina / 2 usuários"],
  },
  {
    name: "Profissional",
    price: "R$ 1.490/mês",
    cta: "Assinar agora",
    ctaHref: "/login",
    highlight: true,
    items: ["Tudo do Básico", "Alertas por email", "Relatórios PDF", "5 usinas / 10 usuários"],
  },
  {
    name: "Enterprise",
    price: "R$ 4.990/mês",
    cta: "Falar com time",
    ctaHref: "mailto:contato@sugarcane.app",
    highlight: false,
    items: ["Tudo do Profissional", "Usinas ilimitadas", "Acesso à API", "Gerente dedicado"],
  },
];

export default async function HomePage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/app/dashboard");

  const S: React.CSSProperties = {
    fontFamily: "var(--font-geist-sans, Inter, sans-serif)",
    background: "#0f172a",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    color: "#f9fafb",
  };

  return (
    <div style={S}>
      {/* ── Nav ── */}
      <nav
        style={{
          background: "rgba(15,23,42,0.95)",
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid #1e293b",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 40px",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {LOGO}
          <span style={{ color: "#f9fafb", fontWeight: 800, fontSize: 17, letterSpacing: "-0.3px" }}>
            Sugarcane
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <a href="#funcionalidades" style={{ color: "#9ca3af", fontSize: 13, textDecoration: "none" }}>
            Funcionalidades
          </a>
          <a href="#como-funciona" style={{ color: "#9ca3af", fontSize: 13, textDecoration: "none" }}>
            Como funciona
          </a>
          <a href="#precos" style={{ color: "#9ca3af", fontSize: 13, textDecoration: "none" }}>
            Preços
          </a>
          <Link
            href="/login"
            style={{ color: "#9ca3af", fontSize: 13, textDecoration: "none" }}
          >
            Entrar
          </Link>
          <Link
            href="/login"
            style={{
              background: "#16a34a",
              color: "#fff",
              padding: "8px 20px",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Começar grátis
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <div style={{ display: "flex", flex: 1, minHeight: 480 }}>
        <div
          style={{
            flex: 1,
            padding: "64px 56px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <p
            style={{
              fontSize: 10,
              color: "#4ade80",
              fontWeight: 700,
              letterSpacing: "3px",
              textTransform: "uppercase",
              marginBottom: 18,
            }}
          >
            Plataforma de risco · mercado sucroenergético
          </p>
          <h1
            style={{
              fontSize: 42,
              color: "#f9fafb",
              fontWeight: 900,
              lineHeight: 1.12,
              margin: "0 0 18px 0",
            }}
          >
            Gestão de risco para<br />o mercado de açúcar
          </h1>
          <p
            style={{
              fontSize: 15,
              color: "#9ca3af",
              lineHeight: 1.7,
              margin: "0 0 36px 0",
              maxWidth: 440,
            }}
          >
            Monte Carlo, Black-Scholes, gestão de hedge e alertas de preço — tudo em
            um só lugar para usinas e traders que precisam decidir com dados.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link
              href="/login"
              style={{
                background: "#16a34a",
                color: "#fff",
                padding: "13px 28px",
                borderRadius: 7,
                fontSize: 15,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Começar gratuitamente →
            </Link>
            <a
              href="mailto:contato@sugarcane.app?subject=Demo Sugarcane"
              style={{
                border: "1px solid #374151",
                color: "#e5e7eb",
                padding: "13px 28px",
                borderRadius: 7,
                fontSize: 15,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Agendar demo
            </a>
          </div>
        </div>

        {/* Right — image */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden", minHeight: 360 }}>
          <Image
            src="/sugarcane-field.jpg"
            alt="Vista aérea de canavial"
            fill
            style={{ objectFit: "cover", opacity: 0.7 }}
            priority
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(to right, #0f172a 0%, transparent 35%)",
            }}
          />
          {/* Sugar price card */}
          <div
            style={{
              position: "absolute",
              bottom: 40,
              right: 28,
              background: "rgba(15,23,42,0.92)",
              border: "1px solid #1e293b",
              borderRadius: 12,
              padding: "14px 20px",
              backdropFilter: "blur(8px)",
              minWidth: 160,
            }}
          >
            <p style={{ fontSize: 9, color: "#6b7280", fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", margin: "0 0 4px 0" }}>
              AÇÚCAR NY #11
            </p>
            <p style={{ fontSize: 26, color: "#f9fafb", fontWeight: 800, margin: 0 }}>
              18.42 <span style={{ fontSize: 13, color: "#9ca3af" }}>¢/lb</span>
            </p>
            <p style={{ fontSize: 11, color: "#4ade80", fontWeight: 600, margin: "2px 0 4px 0" }}>▲ +0.83% hoje</p>
            <p style={{ fontSize: 8, color: "#4b5563", letterSpacing: "0.5px" }}>ILUSTRATIVO</p>
          </div>
          {/* FX card */}
          <div
            style={{
              position: "absolute",
              top: 28,
              right: 28,
              background: "rgba(15,23,42,0.88)",
              border: "1px solid #1e293b",
              borderRadius: 10,
              padding: "12px 18px",
              backdropFilter: "blur(8px)",
            }}
          >
            <p style={{ fontSize: 9, color: "#6b7280", fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", margin: "0 0 4px 0" }}>USD / BRL</p>
            <p style={{ fontSize: 20, color: "#f9fafb", fontWeight: 800, margin: 0 }}>R$ 5,72</p>
            <p style={{ fontSize: 11, color: "#f87171", fontWeight: 600, margin: "2px 0 4px 0" }}>▼ −0.21%</p>
            <p style={{ fontSize: 8, color: "#4b5563", letterSpacing: "0.5px" }}>ILUSTRATIVO</p>
          </div>
          {/* Photo credit */}
          <p style={{ position: "absolute", bottom: 8, right: 12, fontSize: 9, color: "rgba(255,255,255,0.3)", margin: 0 }}>
            Foto:{" "}
            <a href="https://unsplash.com/@joshwithers" target="_blank" rel="noopener noreferrer" style={{ color: "rgba(255,255,255,0.4)", textDecoration: "underline" }}>
              Josh Withers
            </a>{" "}/ Unsplash
          </p>
        </div>
      </div>

      {/* ── Stats ── */}
      <div
        style={{
          background: "#052e16",
          borderTop: "1px solid #14532d",
          borderBottom: "1px solid #14532d",
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          textAlign: "center",
        }}
      >
        {[
          { value: "10.000", label: "simulações por análise" },
          { value: "15+", label: "módulos analíticos" },
          { value: "P5–P95", label: "percentis de cenário" },
          { value: "Tempo real", label: "dados ao vivo" },
        ].map((s, i, arr) => (
          <div
            key={s.label}
            style={{
              padding: "24px 16px",
              borderRight: i < arr.length - 1 ? "1px solid #14532d" : undefined,
            }}
          >
            <p style={{ fontSize: 28, color: "#4ade80", fontWeight: 900, lineHeight: 1, margin: 0 }}>{s.value}</p>
            <p style={{ fontSize: 11, color: "#6b7280", margin: "6px 0 0 0" }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Features ── */}
      <div id="funcionalidades" style={{ padding: "72px 56px" }}>
        <p style={{ textAlign: "center", fontSize: 10, color: "#4ade80", fontWeight: 700, letterSpacing: "3px", textTransform: "uppercase", marginBottom: 12 }}>
          Funcionalidades
        </p>
        <h2 style={{ textAlign: "center", fontSize: 28, fontWeight: 800, margin: "0 0 48px 0", color: "#f9fafb" }}>
          Tudo que uma usina precisa para gerenciar risco
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24, maxWidth: 960, margin: "0 auto" }}>
          {FEATURES.map((f) => (
            <div
              key={f.title}
              style={{
                background: "#1e293b",
                border: "1px solid #334155",
                borderRadius: 12,
                padding: "24px 22px",
              }}
            >
              <p style={{ fontSize: 28, margin: "0 0 10px 0" }}>{f.icon}</p>
              <p style={{ fontSize: 15, fontWeight: 700, color: "#f9fafb", margin: "0 0 8px 0" }}>{f.title}</p>
              <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── How it works ── */}
      <div id="como-funciona" style={{ padding: "64px 56px", background: "#0d1b2a", borderTop: "1px solid #1e293b", borderBottom: "1px solid #1e293b" }}>
        <p style={{ textAlign: "center", fontSize: 10, color: "#4ade80", fontWeight: 700, letterSpacing: "3px", textTransform: "uppercase", marginBottom: 12 }}>
          Como funciona
        </p>
        <h2 style={{ textAlign: "center", fontSize: 28, fontWeight: 800, margin: "0 0 48px 0" }}>
          Comece em 3 passos
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 32, maxWidth: 840, margin: "0 auto" }}>
          {STEPS.map((s) => (
            <div key={s.n} style={{ textAlign: "center" }}>
              <p style={{ fontSize: 40, color: "#1a3c1a", fontWeight: 900, margin: "0 0 12px 0", lineHeight: 1 }}>{s.n}</p>
              <p style={{ fontSize: 15, fontWeight: 700, color: "#f9fafb", margin: "0 0 8px 0" }}>{s.title}</p>
              <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6, margin: 0 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Pricing ── */}
      <div id="precos" style={{ padding: "72px 56px" }}>
        <p style={{ textAlign: "center", fontSize: 10, color: "#4ade80", fontWeight: 700, letterSpacing: "3px", textTransform: "uppercase", marginBottom: 12 }}>
          Preços
        </p>
        <h2 style={{ textAlign: "center", fontSize: 28, fontWeight: 800, margin: "0 0 12px 0" }}>
          Simples e transparente
        </h2>
        <p style={{ textAlign: "center", fontSize: 14, color: "#9ca3af", margin: "0 0 48px 0" }}>
          Comece grátis. Faça upgrade quando precisar de alertas e relatórios.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24, maxWidth: 840, margin: "0 auto" }}>
          {PLANS.map((p) => (
            <div
              key={p.name}
              style={{
                background: p.highlight ? "#0d2e1a" : "#1e293b",
                border: `1px solid ${p.highlight ? "#16a34a" : "#334155"}`,
                borderRadius: 14,
                padding: "28px 24px",
                display: "flex",
                flexDirection: "column",
                gap: 16,
                boxShadow: p.highlight ? "0 4px 32px rgba(22,163,74,0.12)" : undefined,
              }}
            >
              {p.highlight && (
                <span
                  style={{
                    alignSelf: "flex-start",
                    background: "#16a34a",
                    color: "#fff",
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "2px 10px",
                    borderRadius: 99,
                    letterSpacing: "0.5px",
                  }}
                >
                  Mais popular
                </span>
              )}
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: "#f9fafb", margin: "0 0 4px 0" }}>{p.name}</p>
                <p style={{ fontSize: 22, fontWeight: 800, color: p.highlight ? "#4ade80" : "#f9fafb", margin: 0 }}>{p.price}</p>
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                {p.items.map((item) => (
                  <li key={item} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "#cbd5e1" }}>
                    <span style={{ color: "#4ade80", fontWeight: 700, flexShrink: 0 }}>✓</span>
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href={p.ctaHref}
                style={{
                  display: "block",
                  textAlign: "center",
                  padding: "11px 0",
                  borderRadius: 7,
                  fontSize: 13,
                  fontWeight: 700,
                  textDecoration: "none",
                  background: p.highlight ? "#16a34a" : "transparent",
                  color: p.highlight ? "#fff" : "#9ca3af",
                  border: p.highlight ? "none" : "1px solid #475569",
                }}
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* ── CTA band ── */}
      <div
        style={{
          background: "#052e16",
          borderTop: "1px solid #14532d",
          padding: "56px 40px",
          textAlign: "center",
        }}
      >
        <h2 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 12px 0" }}>
          Pronto para gerenciar seu risco com dados?
        </h2>
        <p style={{ fontSize: 14, color: "#9ca3af", margin: "0 0 28px 0" }}>
          Crie sua conta grátis hoje. Sem cartão de crédito.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link
            href="/login"
            style={{
              background: "#16a34a",
              color: "#fff",
              padding: "13px 32px",
              borderRadius: 7,
              fontSize: 15,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Começar gratuitamente →
          </Link>
          <a
            href="mailto:contato@sugarcane.app?subject=Demo Sugarcane"
            style={{
              border: "1px solid #374151",
              color: "#e5e7eb",
              padding: "13px 32px",
              borderRadius: 7,
              fontSize: 15,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Agendar demo
          </a>
        </div>
      </div>

      {/* ── Footer ── */}
      <footer
        style={{
          background: "#0f172a",
          borderTop: "1px solid #1e293b",
          padding: "24px 40px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {LOGO}
          <span style={{ color: "#4b5563", fontSize: 12 }}>© {new Date().getFullYear()} Sugarcane</span>
        </div>
        <div style={{ display: "flex", gap: 20 }}>
          <a href="mailto:contato@sugarcane.app" style={{ fontSize: 12, color: "#4b5563", textDecoration: "none" }}>
            Contato
          </a>
          <a href="#precos" style={{ fontSize: 12, color: "#4b5563", textDecoration: "none" }}>
            Preços
          </a>
        </div>
      </footer>
    </div>
  );
}
