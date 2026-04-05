"use client";

import Link from "next/link";

const TOOLS = [
  {
    href: "/app/simulation",
    label: "Monte Carlo",
    desc: "Simulação de preços com fan chart P5–P95",
  },
  {
    href: "/app/options",
    label: "Payoff Opções",
    desc: "Estratégias multi-perna com gráfico de payoff",
  },
  {
    href: "/app/params",
    label: "Parâmetros",
    desc: "Configurar parâmetros de simulação por ativo",
  },
  {
    href: "/app/market",
    label: "Mercado",
    desc: "Histórico de preços por ticker",
  },
  {
    href: "/app/focus",
    label: "Focus",
    desc: "Expectativas do Relatório Focus (BCB)",
  },
  {
    href: "/app/var",
    label: "VaR",
    desc: "Value at Risk histórico e paramétrico",
  },
  {
    href: "/app/breakeven",
    label: "Breakeven",
    desc: "Ponto de equilíbrio por custo de produção",
  },
  {
    href: "/app/arima",
    label: "ARIMA",
    desc: "Previsão de preços com modelo ARIMA + IC",
  },
  {
    href: "/app/stress",
    label: "Estresse",
    desc: "Cenários históricos de drawdown por ativo",
  },
  {
    href: "/app/noticias",
    label: "Notícias",
    desc: "Feed de notícias — Açúcar & Câmbio",
  },
  {
    href: "/app/volatilidade",
    label: "Volatilidade",
    desc: "Volatilidade realizada 30d, 90d, 1 ano",
  },
];

export function ToolGrid() {
  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {TOOLS.map(({ href, label, desc }) => (
        <Link
          key={href}
          href={href}
          className="group block rounded-[10px] p-[18px] transition-all"
          style={{ background: "#fff", border: "1px solid #e5e7eb" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "#3b82f6";
            (e.currentTarget as HTMLElement).style.background = "#eff6ff";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "#e5e7eb";
            (e.currentTarget as HTMLElement).style.background = "#fff";
          }}
        >
          <p className="font-bold mb-1" style={{ fontSize: 13, color: "#111827" }}>
            {label}
          </p>
          <p className="leading-snug" style={{ fontSize: 11, color: "#9ca3af" }}>
            {desc}
          </p>
          <p className="mt-2.5 font-semibold" style={{ fontSize: 11, color: "#3b82f6" }}>
            Acessar →
          </p>
        </Link>
      ))}
    </div>
  );
}
