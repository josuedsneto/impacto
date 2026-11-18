"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { FieldTooltip } from "@/components/ui/field-tooltip";
import { lerNumero } from "@/lib/numero";

export interface IndicatorConfig {
  indicators: string[];   // "rsi" | "bollinger" | "macd" | "stoch" | "cci"
  rsiPeriod: number;
  bbWindow: number;
  bbStd: number;
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
  stochK: number;
  stochD: number;
  cciPeriod: number;
  smaPeriods: number[];
  emaPeriods: number[];
}

export const DEFAULT_CONFIG: IndicatorConfig = {
  indicators: ["bollinger", "rsi"],
  rsiPeriod: 14,
  bbWindow: 20,
  bbStd: 2.0,
  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,
  stochK: 14,
  stochD: 3,
  cciPeriod: 20,
  smaPeriods: [20, 50],
  emaPeriods: [],
};

const OSCILLATORS: { key: string; label: string }[] = [
  { key: "bollinger", label: "Bandas de Bollinger" },
  { key: "rsi",       label: "RSI (força relativa)" },
  { key: "macd",      label: "MACD" },
  { key: "stoch",     label: "Estocástico" },
  { key: "cci",       label: "CCI" },
];

type ParamNumerico = Exclude<keyof IndicatorConfig, "indicators" | "smaPeriods" | "emaPeriods">;

/** Parâmetros por indicador, com rótulo em português e faixa aceita (dias, salvo desvios-padrão). */
const PARAMS: { indicador: string; chave: ParamNumerico; rotulo: string; min: number; max: number }[] = [
  { indicador: "rsi", chave: "rsiPeriod", rotulo: "RSI: período (dias)", min: 2, max: 250 },
  { indicador: "bollinger", chave: "bbWindow", rotulo: "Bollinger: período (dias)", min: 2, max: 250 },
  { indicador: "bollinger", chave: "bbStd", rotulo: "Bollinger: desvios-padrão", min: 0.5, max: 5 },
  { indicador: "macd", chave: "macdFast", rotulo: "MACD: média rápida (dias)", min: 2, max: 250 },
  { indicador: "macd", chave: "macdSlow", rotulo: "MACD: média lenta (dias)", min: 2, max: 250 },
  { indicador: "macd", chave: "macdSignal", rotulo: "MACD: sinal (dias)", min: 2, max: 250 },
  { indicador: "stoch", chave: "stochK", rotulo: "Estocástico: %K (dias)", min: 2, max: 250 },
  { indicador: "stoch", chave: "stochD", rotulo: "Estocástico: %D (dias)", min: 2, max: 250 },
  { indicador: "cci", chave: "cciPeriod", rotulo: "CCI: período (dias)", min: 2, max: 250 },
];

const SMA_OPTIONS = [20, 50, 200];
const EMA_OPTIONS = [9, 21];

interface Props {
  config: IndicatorConfig;
  onChange: (config: IndicatorConfig) => void;
  disabled?: boolean;
}

export function IndicatorSelector({ config, onChange, disabled }: Props) {
  const [paramsOpen, setParamsOpen] = useState(false);

  function toggleIndicator(key: string) {
    const next = config.indicators.includes(key)
      ? config.indicators.filter((k) => k !== key)
      : [...config.indicators, key];
    onChange({ ...config, indicators: next });
  }

  function toggleSma(period: number) {
    const next = config.smaPeriods.includes(period)
      ? config.smaPeriods.filter((p) => p !== period)
      : [...config.smaPeriods, period].sort((a, b) => a - b);
    onChange({ ...config, smaPeriods: next });
  }

  function toggleEma(period: number) {
    const next = config.emaPeriods.includes(period)
      ? config.emaPeriods.filter((p) => p !== period)
      : [...config.emaPeriods, period].sort((a, b) => a - b);
    onChange({ ...config, emaPeriods: next });
  }

  // Só aplica números dentro da faixa; o campo fica marcado como inválido até corrigir.
  function setParam(key: ParamNumerico, texto: string, min: number, max: number) {
    const v = lerNumero(texto);
    if (v !== null && v >= min && v <= max) onChange({ ...config, [key]: v });
  }

  const pillBase = "px-3 py-1 rounded-full text-sm border transition-colors cursor-pointer";
  const pillActive = "bg-primary text-primary-foreground border-primary";
  const pillInactive = "bg-background text-muted-foreground border-border hover:border-primary";

  const chipBase = "px-2 py-1 rounded text-xs border transition-colors cursor-pointer";

  return (
    <div className="space-y-3">
      {/* Oscillator pills */}
      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">
          Indicadores <FieldTooltip text="Cada indicador marca no gráfico pontos de possível entrada (compra) e saída (venda)." />
        </Label>
        <div className="flex flex-wrap gap-2">
          {OSCILLATORS.map(({ key, label }) => {
            const active = config.indicators.includes(key);
            return (
              <button
                key={key}
                type="button"
                disabled={disabled}
                onClick={() => toggleIndicator(key)}
                className={`${pillBase} ${active ? pillActive : pillInactive}`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* MA toggles */}
      <div className="flex flex-wrap gap-6">
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">
            Médias móveis simples (dias) <FieldTooltip text="Média dos últimos N fechamentos. O cruzamento das duas mais curtas gera sinal." />
          </Label>
          <div className="flex gap-1">
            {SMA_OPTIONS.map((p) => (
              <button
                key={p}
                type="button"
                disabled={disabled}
                onClick={() => toggleSma(p)}
                className={`${chipBase} ${config.smaPeriods.includes(p) ? pillActive : pillInactive}`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">
            Médias móveis exponenciais (dias) <FieldTooltip text="Como a média simples, mas dá mais peso aos dias recentes." />
          </Label>
          <div className="flex gap-1">
            {EMA_OPTIONS.map((p) => (
              <button
                key={p}
                type="button"
                disabled={disabled}
                onClick={() => toggleEma(p)}
                className={`${chipBase} ${config.emaPeriods.includes(p) ? pillActive : pillInactive}`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Collapsible params */}
      <div>
        <button
          type="button"
          onClick={() => setParamsOpen(!paramsOpen)}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <span>{paramsOpen ? "▲" : "▼"}</span> Parâmetros
        </button>

        {paramsOpen && (
          <div className="mt-2 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {PARAMS.filter((p) => config.indicators.includes(p.indicador)).map((p) => (
              <div key={p.chave} className="flex items-center gap-2">
                <Label htmlFor={`ind-${p.chave}`} className="w-44 text-xs">
                  {p.rotulo}
                </Label>
                <Input
                  id={`ind-${p.chave}`}
                  type="text"
                  inputMode="decimal"
                  defaultValue={String(config[p.chave]).replace(".", ",")}
                  onChange={(e) => setParam(p.chave, e.target.value, p.min, p.max)}
                  onBlur={(e) => {
                    const v = lerNumero(e.target.value);
                    e.target.setAttribute("aria-invalid", String(v === null || v < p.min || v > p.max));
                  }}
                  className="h-7 w-20 text-xs"
                  disabled={disabled}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
