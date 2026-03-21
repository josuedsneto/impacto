"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import PayoffBuilder, { PayoffResult } from "@/components/options/PayoffBuilder";
import PayoffChart from "@/components/options/PayoffChart";
import BSPricer from "@/components/options/BSPricer";
import MCPricer from "@/components/options/MCPricer";

export default function OptionsPage() {
  const [payoffResult, setPayoffResult] = useState<PayoffResult | null>(null);
  const [activeTab, setActiveTab] = useState("payoff");

  return (
    <div className="container mx-auto py-8 space-y-6">
      <h1 className="text-2xl font-semibold">Opções e Pricing</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="payoff">Payoff</TabsTrigger>
          <TabsTrigger value="black-scholes">Black-Scholes</TabsTrigger>
          <TabsTrigger value="mc-pricer">MC Pricer</TabsTrigger>
        </TabsList>

        <TabsContent value="payoff" className="space-y-6 mt-6">
          <PayoffBuilder onPayoffResult={setPayoffResult} />
          {payoffResult !== null && (
            <PayoffChart
              prices={payoffResult.prices}
              payoff={payoffResult.payoff}
            />
          )}
        </TabsContent>

        <TabsContent value="black-scholes" className="mt-6 space-y-4">
          <BSPricer />
          <p className="text-sm text-muted-foreground mt-4">
            OPT-02: volatilidade customizável. Recalcula automaticamente a cada mudança.
          </p>
        </TabsContent>

        <TabsContent value="mc-pricer" className="mt-6 space-y-4">
          <MCPricer />
          <p className="text-sm text-muted-foreground mt-4">
            OPT-03: drift risk-neutral (r − 0.5σ²). Consistente com Black-Scholes no ATM.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
