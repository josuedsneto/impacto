"use client";

import { useState, useRef, useCallback } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldTooltip } from "@/components/ui/field-tooltip";
import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadCsv, formatBrNumber, isoToday, printPage } from "@/lib/export";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

async function getAccessToken(): Promise<string | null> {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export default function BSPricer() {
  const [S, setS] = useState(20);
  const [K, setK] = useState(20);
  const [T, setT] = useState(1);
  const [r, setR] = useState(0.05);
  const [sigma, setSigma] = useState(0.2);
  const [price, setPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCalculate = useCallback(
    async (params: { S: number; K: number; T: number; r: number; sigma: number }) => {
      setLoading(true);
      setError(null);
      try {
        const token = await getAccessToken();
        const res = await fetch(`${API}/api/options/bs-price`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(params),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.detail ?? "Erro ao calcular preço BS.");
        } else {
          setPrice(data.price);
        }
      } catch {
        setError("Erro de conexão com o servidor.");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  function scheduleCalculate(overrides: Partial<{ S: number; K: number; T: number; r: number; sigma: number }>) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      handleCalculate({ S, K, T, r, sigma, ...overrides });
    }, 300);
  }

  return (
    <div className="space-y-4 max-w-md">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="bs-S">S (Preço atual) <FieldTooltip text="Preço spot atual do ativo subjacente" /></Label>
          <Input
            id="bs-S"
            type="number"
            step={0.5}
            value={S}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setS(val);
              scheduleCalculate({ S: val });
            }}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="bs-K">K (Strike) <FieldTooltip text="Preço de exercício (strike) da opção" /></Label>
          <Input
            id="bs-K"
            type="number"
            step={0.5}
            value={K}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setK(val);
              scheduleCalculate({ K: val });
            }}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="bs-T">T (Anos até vencimento) <FieldTooltip text="Tempo até vencimento em anos. Ex: 0.25 = 3 meses" /></Label>
          <Input
            id="bs-T"
            type="number"
            step={0.1}
            min={0.01}
            value={T}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setT(val);
              scheduleCalculate({ T: val });
            }}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="bs-r">r (Taxa livre de risco) <FieldTooltip text="Taxa de juros livre de risco anualizada. Ex: 0.105 = 10,5% a.a." /></Label>
          <Input
            id="bs-r"
            type="number"
            step={0.005}
            min={0}
            value={r}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setR(val);
              scheduleCalculate({ r: val });
            }}
          />
        </div>

        <div className="space-y-1 col-span-2">
          <Label htmlFor="bs-sigma">σ (Volatilidade) <FieldTooltip text="Volatilidade anualizada. Ex: 0.25 = 25% a.a." /></Label>
          <Input
            id="bs-sigma"
            type="number"
            step={0.01}
            min={0.001}
            value={sigma}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setSigma(val);
              scheduleCalculate({ sigma: val });
            }}
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <p className="text-2xl font-bold">
        Preço BS:{" "}
        <span className="text-primary">
          {loading ? "—" : price !== null ? price.toFixed(4) : "—"}
        </span>
      </p>

      <div className="flex gap-2 no-print">
        <Button
          variant="outline"
          size="sm"
          disabled={price === null}
          className="no-print"
          onClick={() => {
            if (price === null) return;
            const rows = [
              ["Spot_S", "Strike_K", "Tempo_T", "Taxa_r", "Sigma", "Preco_Call_BS"],
              [
                formatBrNumber(S),
                formatBrNumber(K),
                formatBrNumber(T),
                formatBrNumber(r),
                formatBrNumber(sigma),
                formatBrNumber(price),
              ],
            ];
            downloadCsv(rows, `opcoes_bs_${isoToday()}.csv`);
          }}
        >
          <Download className="w-4 h-4 mr-1.5" />
          Exportar CSV
        </Button>
        <Button variant="outline" size="sm" onClick={printPage} className="no-print">
          <Printer className="w-4 h-4 mr-1.5" />
          Imprimir PDF
        </Button>
      </div>
    </div>
  );
}
