"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";

const NAV_SECTIONS = [
  {
    label: "Fixações",
    items: [
      { href: "/app/simulation", label: "Monte Carlo" },
      // { href: "/app/jump-diffusion", label: "Jump Diffusion" },
      // { href: "/app/metas", label: "Metas" },
      // { href: "/app/options", label: "Payoff Opções" },
      { href: "/app/volatilidade", label: "Volatilidade" },
    ],
  },
  {
    label: "Risco",
    items: [
      { href: "/app/var", label: "VaR" },
      { href: "/app/breakeven", label: "Breakeven" },
      { href: "/app/stress", label: "Stress Test" },
      // { href: "/app/risco", label: "Risco Operacional" },
      // { href: "/app/cenarios", label: "Cenários" },
    ],
  },
  {
    label: "Análise",
    items: [
      { href: "/app/noticias", label: "Notícias" },
      { href: "/app/regressao-dolar", label: "Regressão Dólar" },
      { href: "/app/regressao-acucar", label: "Regressão Açúcar" },
      { href: "/app/atr", label: "ATR" },
      // { href: "/app/focus", label: "Focus BCB" },
      // { href: "/app/arima", label: "ARIMA" },
    ],
  },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <TooltipProvider delayDuration={300}>
    <div className="flex min-h-screen">
      <aside
        className="w-56 flex-shrink-0 flex flex-col"
        style={{ background: "#111827" }}
      >
        {/* Brand */}
        <div
          className="px-5 py-[22px]"
          style={{ borderBottom: "1px solid #1f2937" }}
        >
          <p
            className="font-extrabold tracking-[2.5px]"
            style={{ color: "#f9fafb", fontSize: 15 }}
          >
            SUGARCANE
          </p>
          <p
            className="mt-0.5"
            style={{ color: "#4b5563", fontSize: 10, letterSpacing: "1px" }}
          >
            Análise de Mercado
          </p>
        </div>

        {/* Dashboard link */}
        <Link
          href="/app/dashboard"
          className="flex items-center gap-2.5 px-5 py-2.5"
          style={{
            color: pathname === "/app/dashboard" ? "#f9fafb" : "#9ca3af",
            background:
              pathname === "/app/dashboard" ? "#1f2937" : "transparent",
            borderLeft:
              pathname === "/app/dashboard"
                ? "2px solid #3b82f6"
                : "2px solid transparent",
            fontSize: 13,
            fontWeight: pathname === "/app/dashboard" ? 500 : 400,
          }}
        >
          <span
            className="rounded-full flex-shrink-0"
            style={{
              width: 5,
              height: 5,
              background:
                pathname === "/app/dashboard" ? "#3b82f6" : "currentColor",
              opacity: pathname === "/app/dashboard" ? 1 : 0.5,
            }}
          />
          Dashboard
        </Link>

        {/* Grouped nav */}
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <p
              className="px-5 pb-1.5"
              style={{
                paddingTop: 18,
                color: "#4b5563",
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "1.5px",
                textTransform: "uppercase",
              }}
            >
              {section.label}
            </p>
            {section.items.map(({ href, label }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-2.5 px-5 py-2"
                  style={{
                    color: active ? "#f9fafb" : "#9ca3af",
                    background: active ? "#1f2937" : "transparent",
                    borderLeft: active
                      ? "2px solid #3b82f6"
                      : "2px solid transparent",
                    fontSize: 13,
                    fontWeight: active ? 500 : 400,
                  }}
                >
                  <span
                    className="rounded-full flex-shrink-0"
                    style={{
                      width: 5,
                      height: 5,
                      background: active ? "#3b82f6" : "currentColor",
                      opacity: active ? 1 : 0.5,
                    }}
                  />
                  {label}
                </Link>
              );
            })}
          </div>
        ))}
      </aside>

      <main
        className="flex-1 overflow-auto"
        style={{ background: "#f4f6f9", padding: pathname === "/app/dashboard" ? 0 : "32px 40px" }}
      >
        {children}
      </main>
    </div>
    </TooltipProvider>
  );
}
