"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PRESETS = [
  { value: "SB=F",      label: "SB=F — Açúcar NY #11 Futuro" },
  { value: "SBK26.NYB", label: "SBK26.NYB — Açúcar Maio 2026" },
  { value: "USDBRL=X",  label: "USDBRL=X — Dólar/Real" },
  { value: "CL=F",      label: "CL=F — Petróleo WTI" },
  { value: "__outro__", label: "Outro..." },
];

interface TickerSelectProps {
  value: string;
  onChange: (ticker: string) => void;
  disabled?: boolean;
}

export function TickerSelect({ value, onChange, disabled }: TickerSelectProps) {
  const isPreset = PRESETS.some((p) => p.value === value && p.value !== "__outro__");
  const [selectValue, setSelectValue] = useState(isPreset ? value : "__outro__");
  const [customTicker, setCustomTicker] = useState(isPreset ? "" : value);

  function handleSelectChange(v: string) {
    setSelectValue(v);
    if (v !== "__outro__") {
      onChange(v);
    }
  }

  function handleCustomChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value.toUpperCase();
    setCustomTicker(v);
    onChange(v);
  }

  return (
    <div className="space-y-2">
      <Label>Ticker</Label>
      <Select value={selectValue} onValueChange={handleSelectChange} disabled={disabled}>
        <SelectTrigger className="w-64">
          <SelectValue placeholder="Selecione um ativo" />
        </SelectTrigger>
        <SelectContent>
          {PRESETS.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectValue === "__outro__" && (
        <Input
          value={customTicker}
          onChange={handleCustomChange}
          placeholder="Ex: PETR4.SA, AAPL, GC=F"
          className="w-64"
          disabled={disabled}
        />
      )}
    </div>
  );
}
