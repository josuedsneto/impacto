"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

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
  { key: "bollinger", label: "Bollinger Bands" },
  { key: "rsi",       label: "RSI" },
  { key: "macd",      label: "MACD" },
  { key: "stoch",     label: "Estocástico Lento" },
  { key: "cci",       label: "CCI" },
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

  function setParam(key: keyof IndicatorConfig, value: number) {
    onChange({ ...config, [key]: value });
  }

  const pillBase = "px-3 py-1 rounded-full text-sm border transition-colors cursor-pointer";
  const pillActive = "bg-primary text-primary-foreground border-primary";
  const pillInactive = "bg-background text-muted-foreground border-border hover:border-primary";

  const chipBase = "px-2 py-1 rounded text-xs border transition-colors cursor-pointer";

  return (
    <div className="space-y-3">
      {/* Oscillator pills */}
      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">Indicadores</Label>
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
          <Label className="text-xs text-muted-foreground mb-1 block">SMA</Label>
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
          <Label className="text-xs text-muted-foreground mb-1 block">EMA</Label>
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
          <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {config.indicators.includes("rsi") && (
              <div className="flex items-center gap-2">
                <Label className="w-28 text-xs">RSI — Período</Label>
                <Input
                  type="number"
                  value={config.rsiPeriod}
                  min={2}
                  max={100}
                  onChange={(e) => setParam("rsiPeriod", +e.target.value)}
                  className="w-20 h-7 text-xs"
                  disabled={disabled}
                />
              </div>
            )}
            {config.indicators.includes("bollinger") && (
              <>
                <div className="flex items-center gap-2">
                  <Label className="w-28 text-xs">BB — Janela</Label>
                  <Input
                    type="number"
                    value={config.bbWindow}
                    min={2}
                    max={200}
                    onChange={(e) => setParam("bbWindow", +e.target.value)}
                    className="w-20 h-7 text-xs"
                    disabled={disabled}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="w-28 text-xs">BB — Desvios</Label>
                  <Input
                    type="number"
                    value={config.bbStd}
                    min={0.5}
                    max={5}
                    step={0.5}
                    onChange={(e) => setParam("bbStd", +e.target.value)}
                    className="w-20 h-7 text-xs"
                    disabled={disabled}
                  />
                </div>
              </>
            )}
            {config.indicators.includes("macd") && (
              <>
                <div className="flex items-center gap-2">
                  <Label className="w-28 text-xs">MACD — Rápido</Label>
                  <Input type="number" value={config.macdFast} min={2} max={100} onChange={(e) => setParam("macdFast", +e.target.value)} className="w-20 h-7 text-xs" disabled={disabled} />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="w-28 text-xs">MACD — Lento</Label>
                  <Input type="number" value={config.macdSlow} min={2} max={200} onChange={(e) => setParam("macdSlow", +e.target.value)} className="w-20 h-7 text-xs" disabled={disabled} />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="w-28 text-xs">MACD — Sinal</Label>
                  <Input type="number" value={config.macdSignal} min={2} max={50} onChange={(e) => setParam("macdSignal", +e.target.value)} className="w-20 h-7 text-xs" disabled={disabled} />
                </div>
              </>
            )}
            {config.indicators.includes("stoch") && (
              <>
                <div className="flex items-center gap-2">
                  <Label className="w-28 text-xs">Estoc. — %K</Label>
                  <Input type="number" value={config.stochK} min={1} max={100} onChange={(e) => setParam("stochK", +e.target.value)} className="w-20 h-7 text-xs" disabled={disabled} />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="w-28 text-xs">Estoc. — %D</Label>
                  <Input type="number" value={config.stochD} min={1} max={20} onChange={(e) => setParam("stochD", +e.target.value)} className="w-20 h-7 text-xs" disabled={disabled} />
                </div>
              </>
            )}
            {config.indicators.includes("cci") && (
              <div className="flex items-center gap-2">
                <Label className="w-28 text-xs">CCI — Período</Label>
                <Input type="number" value={config.cciPeriod} min={2} max={100} onChange={(e) => setParam("cciPeriod", +e.target.value)} className="w-20 h-7 text-xs" disabled={disabled} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
