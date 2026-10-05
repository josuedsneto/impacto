"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import PayoffBuilder, { PayoffResult } from "@/components/options/PayoffBuilder";
import PayoffChart from "@/components/options/PayoffChart";
import BSPricer from "@/components/options/BSPricer";
import MCPricer from "@/components/options/MCPricer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Leitura } from "@/components/ui/leitura";
import { leituraPayoff } from "@/lib/leitura";

export default function OptionsPage() {
  const [payoffResult, setPayoffResult] = useState<PayoffResult | null>(null);
  const [activeTab, setActiveTab] = useState("payoff");

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
          <PayoffBuilder onPayoffResult={setPayoffResult} />
          {payoffResult !== null && (
            <Leitura>{leituraPayoff({ precos: payoffResult.prices, payoff: payoffResult.payoff })}</Leitura>
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
