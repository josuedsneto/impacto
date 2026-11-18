"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldTooltip } from "@/components/ui/field-tooltip";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { CampoNumero, campoValido } from "@/components/ui/campo-numero";
import { TickerSelect } from "@/components/market/TickerSelect";
import { unidadeAtivo } from "@/lib/ativos";
import { fracaoParaPercentual, lerNumero } from "@/lib/numero";
import { formatDate, formatPreco } from "@/lib/format";
import { LIMITE_CENARIOS_SIMULACAO } from "@/lib/simulacao";

export interface SimulationResult {
  id: string;
  ticker: string;
  preco_inicial: number;
  dias_simulados: number;
  num_simulacoes: number;
  pct_bound: number;
  pct_passou_limite: number | null;
  label: string | null;
  p5: number;
  p20: number;
  p50: number;
  p80: number;
  p95: number;
  percentiles_series: Record<string, number[]>;
  created_at: string;
}

interface SimulationFormProps {
  onResult: (result: SimulationResult) => void;
}

export default function SimulationForm({ onResult }: SimulationFormProps) {
  const [ticker, setTicker] = useState("SB=F");
  const [precoInicial, setPrecoInicial] = useState("");
  const [diasSimulados, setDiasSimulados] = useState("252");
  const [numSimulacoes, setNumSimulacoes] = useState("10000");
  const [variacaoMax, setVariacaoMax] = useState("50");
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const controle = useRef<AbortController | null>(null);

  // Faixas aceitas pela API (backend/main.py SimulationRequest)
  const FAIXAS = {
    preco: { min: 0.0001, max: 100_000 },
    dias: { min: 1, max: 1260 },
    cenarios: LIMITE_CENARIOS_SIMULACAO,
    variacao: { min: 1, max: 200 },
  };

  // Último fechamento do ativo, para preencher o preço de partida.
  const [ultimoFechamento, setUltimoFechamento] = useState<{ preco: number; data: string } | null>(null);

  useEffect(() => {
    let cancelado = false;
    async function carregarUltimoFechamento() {
      // Data local (não UTC): depois das 21h em Brasília, UTC já é o dia seguinte.
      const iso = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const params = new URLSearchParams({
        ticker,
        start: iso(new Date(Date.now() - 10 * 86_400_000)),
        end: iso(new Date()),
      });
      try {
        const data = await apiFetch<{ rows: { date: string; close: number | null }[] }>(
          `/api/market/prices?${params}`
        );
        const ultimo = [...data.rows]
          .reverse()
          .find((r) => r.close !== null && Number.isFinite(r.close));
        if (cancelado) return;
        if (ultimo && ultimo.close !== null) {
          setUltimoFechamento({ preco: ultimo.close, data: ultimo.date });
          // yfinance traz floats com artefato (19.459999…); arredonda antes de preencher.
          setPrecoInicial(String(Math.round(ultimo.close * 1e4) / 1e4).replace(".", ","));
        } else {
          setUltimoFechamento(null);
          setPrecoInicial("");
        }
      } catch {
        if (!cancelado) {
          setUltimoFechamento(null);
          setPrecoInicial("");
        }
      }
    }
    carregarUltimoFechamento();
    return () => {
      cancelado = true;
    };
  }, [ticker]);

  useEffect(() => {
    async function loadParams() {
      try {
        const data = await apiFetch<{ pct_bound_preferido?: number | null }>(
          `/api/params/${encodeURIComponent(ticker)}`
        );
        // Parâmetro salvo como fração (0.5); a tela trabalha em % (50).
        if (data.pct_bound_preferido != null) setVariacaoMax(fracaoParaPercentual(data.pct_bound_preferido));
      } catch {
        // Sem parâmetro salvo: fica o padrão da tela.
      }
    }
    loadParams();
  }, [ticker]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ok =
      campoValido(precoInicial, FAIXAS.preco) &&
      campoValido(diasSimulados, FAIXAS.dias) &&
      campoValido(numSimulacoes, FAIXAS.cenarios) &&
      campoValido(variacaoMax, FAIXAS.variacao);
    if (!ok) {
      toast.error("Corrija os campos destacados antes de simular.");
      return;
    }
    setLoading(true);
    controle.current = new AbortController();

    try {
      const data = await apiFetch<SimulationResult>("/api/simulations", {
        method: "POST",
        timeoutMs: 120_000,
        signal: controle.current.signal,
        body: JSON.stringify({
          ticker: ticker.trim().toUpperCase(),
          preco_inicial: lerNumero(precoInicial),
          dias_simulados: Math.round(lerNumero(diasSimulados)!),
          num_simulacoes: Math.round(lerNumero(numSimulacoes)!),
          pct_bound: lerNumero(variacaoMax)! / 100,
          label: label.trim() || null,
        }),
      });
      onResult(data);
      toast.success("Simulação concluída e salva no histórico.");
    } catch (e) {
      // Cancelado pelo usuário: volta ao formulário sem erro.
      if ((e as Error).name !== "AbortError") toast.error((e as Error).message);
    } finally {
      setLoading(false);
      controle.current = null;
    }
  }

  function cancelar() {
    controle.current?.abort();
  }

  const unidade = unidadeAtivo(ticker);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <TickerSelect value={ticker} onChange={setTicker} disabled={loading} />

      <CampoNumero
        id="preco_inicial"
        rotulo="Preço de partida"
        unidade={unidade || undefined}
        ajuda="Preço de onde os cenários começam. Use o preço atual para ver o futuro a partir de hoje."
        valor={precoInicial}
        onChange={setPrecoInicial}
        {...FAIXAS.preco}
        placeholder="ex.: 19,50"
        disabled={loading}
      />
      <p className="-mt-2 text-xs text-muted-foreground">
        {ultimoFechamento
          ? `Último fechamento: ${formatPreco(ticker, ultimoFechamento.preco)} em ${formatDate(ultimoFechamento.data)}`
          : "Sem fechamento recente para este ativo."}
      </p>

      <CampoNumero
        id="dias_simulados"
        rotulo="Prazo da simulação"
        unidade="dias úteis"
        ajuda="Até onde os cenários vão. 252 dias úteis são cerca de 1 ano."
        valor={diasSimulados}
        onChange={setDiasSimulados}
        {...FAIXAS.dias}
        disabled={loading}
      />

      <CampoNumero
        id="num_simulacoes"
        rotulo="Quantidade de cenários"
        termo="monte-carlo"
        ajuda="Mais cenários deixam o resultado mais estável, mas a simulação demora mais."
        valor={numSimulacoes}
        onChange={setNumSimulacoes}
        {...FAIXAS.cenarios}
        disabled={loading}
      />

      <CampoNumero
        id="variacao_max"
        rotulo="Limite de referência"
        unidade="%"
        ajuda="Não corta os cenários. Mostramos quantos deles saem desta faixa, para cima ou para baixo, em algum dia do prazo."
        valor={variacaoMax}
        onChange={setVariacaoMax}
        {...FAIXAS.variacao}
        disabled={loading}
      />

      <div className="space-y-1">
        <Label htmlFor="label">
          Nome da simulação <span className="font-normal text-muted-foreground">· opcional</span>
          <FieldTooltip text="Ajuda a encontrar esta simulação depois, na aba Histórico." />
        </Label>
        <Input
          id="label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="ex.: Safra 26/27 pessimista"
          disabled={loading}
        />
      </div>

      {loading && (
        <p className="text-sm text-muted-foreground" role="status">
          Isso pode levar até 1 minuto.
        </p>
      )}
      {loading ? (
        <Button type="button" variant="outline" onClick={cancelar} className="w-full">
          Cancelar
        </Button>
      ) : (
        <Button type="submit" className="w-full">
          Simular
        </Button>
      )}
    </form>
  );
}
