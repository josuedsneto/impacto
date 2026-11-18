"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import PayoffBuilder, { PayoffResult, PernaSalva } from "@/components/options/PayoffBuilder";
import { BotaoSalvarAnalise } from "@/components/analises/botao-salvar-analise";
import { useReabrirAnalise } from "@/lib/reabrir-analise";
import PayoffChart from "@/components/options/PayoffChart";
import BSPricer from "@/components/options/BSPricer";
import MCPricer from "@/components/options/MCPricer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Leitura } from "@/components/ui/leitura";
import { leituraPayoff } from "@/lib/leitura";

export default function OptionsPage() {
  const [payoffResult, setPayoffResult] = useState<PayoffResult | null>(null);
  const [activeTab, setActiveTab] = useState("payoff");
  // Pernas como digitadas no último cálculo (para salvar) e pernas a reabrir (para remontar o construtor).
  const [pernas, setPernas] = useState<PernaSalva[]>([]);
  const [reabertura, setReabertura] = useState<{ versao: number; pernas: PernaSalva[] } | null>(null);

  // ANA-05: reabrir preenche as pernas; o payoff aparece quando o usuário calcular.
  useReabrirAnalise("opcoes", (p) => {
    const lidas: PernaSalva[] = [];
    for (let i = 1; p[`Perna ${i}: tipo`] !== undefined; i++) {
      lidas.push({
        type: String(p[`Perna ${i}: tipo`]).startsWith("Put") ? "put" : "call",
        position: String(p[`Perna ${i}: posição`]).startsWith("Vendida") ? "short" : "long",
        strike: String(p[`Perna ${i}: strike`] ?? ""),
        premium: String(p[`Perna ${i}: prêmio`] ?? ""),
        quantity: String(p[`Perna ${i}: quantidade`] ?? "1"),
      });
    }
    if (!lidas.length) {
      toast.error("Esta análise não tem pernas para reabrir.");
      return;
    }
    setPayoffResult(null);
    setPernas([]);
    setReabertura({ versao: Date.now(), pernas: lidas });
    setActiveTab("payoff");
  });

  const parametrosOpcoes = Object.fromEntries(
    pernas.flatMap((l, i) => [
      [`Perna ${i + 1}: tipo`, l.type === "call" ? "Call" : "Put"],
      [`Perna ${i + 1}: posição`, l.position === "long" ? "Comprada" : "Vendida"],
      [`Perna ${i + 1}: strike`, l.strike],
      [`Perna ${i + 1}: prêmio`, l.premium],
      [`Perna ${i + 1}: quantidade`, l.quantity],
    ]),
  );
  const resumoOpcoes = payoffResult
    ? {
        lucro_maximo: Math.max(...payoffResult.payoff),
        perda_maxima: Math.max(0, -Math.min(...payoffResult.payoff)),
        pernas: pernas.length,
        leitura: leituraPayoff({ precos: payoffResult.prices, payoff: payoffResult.payoff }),
      }
    : null;

  return (
    <div>
      <PageHeader
        titulo="Opções"
        descricao="Monte estratégias com opções e veja o resultado no vencimento, ou calcule o preço justo de uma call."
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="payoff">Estratégia</TabsTrigger>
          <TabsTrigger value="black-scholes">Black-Scholes</TabsTrigger>
          <TabsTrigger value="mc-pricer">Monte Carlo</TabsTrigger>
        </TabsList>

        <TabsContent value="payoff" className="space-y-6 mt-6">
          <PayoffBuilder
            key={reabertura?.versao ?? "inicial"}
            pernasIniciais={reabertura?.pernas}
            onPayoffResult={(resultado, ps) => {
              setPayoffResult(resultado);
              setPernas(ps);
            }}
          />
          {payoffResult !== null && (
            <Leitura>{leituraPayoff({ precos: payoffResult.prices, payoff: payoffResult.payoff })}</Leitura>
          )}
          {payoffResult !== null && resumoOpcoes && (
            <div className="flex justify-end">
              <BotaoSalvarAnalise ferramenta="opcoes" parametros={parametrosOpcoes} resultado={resumoOpcoes} />
            </div>
          )}
          {payoffResult !== null && (
            <PayoffChart
              prices={payoffResult.prices}
              payoff={payoffResult.payoff}
            />
          )}
        </TabsContent>

        <TabsContent value="black-scholes" className="mt-6 space-y-4">
          <BSPricer />
          <p className="mt-4 text-sm text-muted-foreground">
            O preço é recalculado a cada mudança nos campos.
          </p>
        </TabsContent>

        <TabsContent value="mc-pricer" className="mt-6 space-y-4">
          <MCPricer />
          <p className="mt-4 text-sm text-muted-foreground">
            Simula milhares de preços no vencimento; o resultado converge para o Black-Scholes.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
