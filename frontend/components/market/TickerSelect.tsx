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
import { ATIVOS } from "@/lib/ativos";

// Ativos com nome conhecido, mais a opção de digitar qualquer código do Yahoo Finance.
const PRESETS = [
  ...Object.entries(ATIVOS).map(([value, a]) => ({ value, label: `${a.nome} · ${value}` })),
  { value: "__outro__", label: "Outro código…" },
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
      <Label>Ativo</Label>
      <Select value={selectValue} onValueChange={handleSelectChange} disabled={disabled}>
        <SelectTrigger className="w-full sm:w-64">
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
          placeholder="Código no Yahoo Finance, ex.: PETR4.SA"
          aria-label="Código do ativo no Yahoo Finance"
          className="w-full sm:w-64"
          disabled={disabled}
        />
      )}
    </div>
  );
}
