"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { Plan } from "@/lib/plan";
import { PLAN_LABELS, isPro } from "@/lib/plan";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

async function getToken(): Promise<string> {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

const PLANS: {
  id: Plan;
  label: string;
  price: string;
  period: string;
  highlight: boolean;
  features: string[];
  cta: string;
}[] = [
  {
    id: "free",
    label: "Básico",
    price: "Grátis",
    period: "",
    highlight: false,
    features: [
      "Todas as análises de mercado",
      "Monte Carlo ilimitado",
      "VaR, Breakeven, Black-Scholes",
      "1 usina / 2 usuários",
      "Sem alertas por email",
      "Sem relatórios PDF",
    ],
    cta: "Plano atual",
  },
  {
    id: "pro",
    label: "Profissional",
    price: "R$ 1.490",
    period: "/mês",
    highlight: true,
    features: [
      "Tudo do Básico",
      "Alertas de preço por email",
      "Relatórios PDF exportáveis",
      "5 usinas / 10 usuários",
      "Convites por email para equipe",
      "Suporte prioritário",
    ],
    cta: "Assinar Profissional",
  },
  {
    id: "enterprise",
    label: "Enterprise",
    price: "R$ 4.990",
    period: "/mês",
    highlight: false,
    features: [
      "Tudo do Profissional",
      "Usinas e usuários ilimitados",
      "Acesso à API REST",
      "White-label (logo próprio)",
      "Gerente de conta dedicado",
      "SLA 99,9%",
    ],
    cta: "Assinar Enterprise",
  },
];

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 mt-0.5">
      <circle cx="8" cy="8" r="8" fill="#dcfce7" />
      <path d="M5 8l2 2 4-4" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PlanosClient({
  currentPlan,
  hasStripe,
  periodEnd,
  successParam,
  canceledParam,
}: {
  currentPlan: Plan;
  hasStripe: boolean;
  periodEnd: string | null;
  successParam: boolean;
  canceledParam: boolean;
}) {
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    if (successParam) toast.success("Assinatura ativada com sucesso! Bem-vindo ao Profissional.");
    if (canceledParam) toast.info("Checkout cancelado. Você pode assinar a qualquer momento.");
  }, [successParam, canceledParam]);

  async function handleCheckout(plan: Plan) {
    if (plan === "free") return;
    setLoading(plan);
    try {
      const token = await getToken();
      const res = await fetch(`${API}/api/billing/checkout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.detail ?? "Erro ao iniciar checkout.");
        return;
      }
      window.location.href = data.checkout_url;
    } catch {
      toast.error("Erro de conexão.");
    } finally {
      setLoading(null);
    }
  }

  async function handlePortal() {
    setLoading("portal");
    try {
      const token = await getToken();
      const res = await fetch(`${API}/api/billing/portal`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.detail ?? "Erro ao abrir portal.");
        return;
      }
      window.location.href = data.portal_url;
    } catch {
      toast.error("Erro de conexão.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="px-7 py-8 max-w-5xl mx-auto space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Planos e Preços</h1>
        <p className="text-sm text-muted-foreground">
          Plano atual:{" "}
          <span className="font-medium" style={{ color: isPro(currentPlan) ? "#16a34a" : undefined }}>
            {PLAN_LABELS[currentPlan]}
          </span>
          {periodEnd && (
            <span className="ml-2 text-xs">
              · renova em {new Date(periodEnd).toLocaleDateString("pt-BR")}
            </span>
          )}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentPlan;
          const isUpgrade = plan.id !== "free" && !isCurrent && !(currentPlan === "enterprise" && plan.id === "pro");

          return (
            <Card
              key={plan.id}
              className="relative flex flex-col"
              style={
                plan.highlight
                  ? { border: "2px solid #16a34a", boxShadow: "0 4px 24px rgba(22,163,74,0.10)" }
                  : {}
              }
            >
              {plan.highlight && (
                <div
                  className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-semibold"
                  style={{ background: "#16a34a", color: "#fff" }}
                >
                  Mais popular
                </div>
              )}

              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{plan.label}</CardTitle>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  {plan.period && (
                    <span className="text-sm text-muted-foreground">{plan.period}</span>
                  )}
                </div>
              </CardHeader>

              <CardContent className="flex flex-col flex-1 gap-5">
                <ul className="space-y-2 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <CheckIcon />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <div className="space-y-2">
                    <Button variant="outline" className="w-full" disabled>
                      Plano atual
                    </Button>
                    {hasStripe && (
                      <Button
                        variant="ghost"
                        className="w-full text-xs text-muted-foreground"
                        onClick={handlePortal}
                        disabled={loading === "portal"}
                      >
                        {loading === "portal" ? "Abrindo..." : "Gerenciar assinatura"}
                      </Button>
                    )}
                  </div>
                ) : isUpgrade ? (
                  <Button
                    className="w-full"
                    style={plan.highlight ? { background: "#16a34a" } : {}}
                    onClick={() => handleCheckout(plan.id)}
                    disabled={loading === plan.id}
                  >
                    {loading === plan.id ? "Redirecionando..." : plan.cta}
                  </Button>
                ) : (
                  <Button variant="outline" className="w-full" disabled>
                    {plan.cta}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-center text-muted-foreground">
        Cobrado em BRL via cartão de crédito. Cancele a qualquer momento.
        Dúvidas? <a href="mailto:contato@sugarcane.app" className="underline">contato@sugarcane.app</a>
      </p>
    </div>
  );
}
