"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_SECTIONS = [
  {
    label: "Fixações",
    items: [
      { href: "/app/fixacoes", label: "Mercado" },
      { href: "/app/market", label: "Análise Técnica" },
      { href: "/app/metas", label: "Metas" },
      { href: "/app/options", label: "Opções" },
    ],
  },
  {
    label: "Simulação",
    items: [
      { href: "/app/simulation", label: "Monte Carlo" },
      { href: "/app/jump-diffusion", label: "Jump Diffusion" },
      { href: "/app/arima", label: "ARIMA" },
      { href: "/app/volatilidade", label: "Volatilidade" },
    ],
  },
  {
    label: "Risco",
    items: [
      { href: "/app/var", label: "VaR" },
      { href: "/app/breakeven", label: "Breakeven" },
      { href: "/app/stress", label: "Stress Test" },
      { href: "/app/risco", label: "Risco (EBITDA)" },
      { href: "/app/cenarios", label: "Cenários" },
    ],
  },
  {
    label: "Análise",
    items: [
      { href: "/app/noticias", label: "Notícias" },
      { href: "/app/focus", label: "Boletim Focus" },
      { href: "/app/regressao-dolar", label: "Regressão Dólar" },
      { href: "/app/regressao-acucar", label: "Regressão Açúcar" },
      { href: "/app/atr", label: "ATR" },
    ],
  },
  {
    label: "Conta",
    items: [{ href: "/app/params", label: "Parâmetros" }],
  },
];

function NavLink({ href, label, onNavigate }: { href: string; label: string; onNavigate?: () => void }) {
  const active = usePathname() === href;
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 border-l-2 px-5 py-2 text-[13px] outline-none transition-colors focus-visible:bg-sidebar-accent",
        active
          ? "border-sidebar-primary bg-sidebar-accent font-medium text-sidebar-accent-foreground"
          : "border-transparent text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      )}
    >
      <span
        aria-hidden
        className={cn("size-[5px] shrink-0 rounded-full", active ? "bg-sidebar-primary" : "bg-current opacity-50")}
      />
      {label}
    </Link>
  );
}

/** Links do app, usados no menu lateral fixo e na gaveta do celular. */
export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Ferramentas" className="pb-6">
      <NavLink href="/app/dashboard" label="Dashboard" onNavigate={onNavigate} />
      {NAV_SECTIONS.map((section) => (
        <div key={section.label}>
          <p className="px-5 pb-1.5 pt-[18px] text-[10px] font-semibold uppercase tracking-[1.5px] text-sidebar-muted">
            {section.label}
          </p>
          {section.items.map(({ href, label }) => (
            <NavLink key={href} href={href} label={label} onNavigate={onNavigate} />
          ))}
        </div>
      ))}
    </nav>
  );
}

/** Marca do app no topo do menu. */
export function Marca() {
  return (
    <div className="border-b border-sidebar-border px-5 py-[22px]">
      <p className="text-[15px] font-extrabold tracking-[2.5px] text-sidebar-accent-foreground">SUGARCANE</p>
      <p className="mt-0.5 text-[10px] tracking-[1px] text-sidebar-muted">Análise de Mercado</p>
    </div>
  );
}
