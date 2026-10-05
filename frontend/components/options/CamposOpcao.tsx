"use client";

import { CampoNumero, campoValido } from "@/components/ui/campo-numero";
import { lerNumero } from "@/lib/numero";

export interface CamposOpcaoValor {
  S: string;
  K: string;
  T: string;
  r: string;
  sigma: string;
}

export const CAMPOS_OPCAO_PADRAO: CamposOpcaoValor = { S: "20", K: "20", T: "1", r: "5", sigma: "20" };

// Faixas aceitas pela API (backend/main.py BSPriceRequest/MCPriceRequest); juros e volatilidade em %.
const FAIXAS = {
  S: { min: 0.0001, max: 100_000 },
  K: { min: 0.0001, max: 1_000_000 },
  T: { min: 0.01, max: 30 },
  r: { min: 0, max: 100 },
  sigma: { min: 0.1, max: 500 },
};

/** Valores prontos para a API (juros e volatilidade em fração), ou null se algum campo for inválido. */
export function paraApi(v: CamposOpcaoValor) {
  const ok = (Object.keys(FAIXAS) as (keyof CamposOpcaoValor)[]).every((k) => campoValido(v[k], FAIXAS[k]));
  if (!ok) return null;
  return {
    S: lerNumero(v.S)!,
    K: lerNumero(v.K)!,
    T: lerNumero(v.T)!,
    r: lerNumero(v.r)! / 100,
    sigma: lerNumero(v.sigma)! / 100,
  };
}

export function CamposOpcao({
  prefixo,
  valor,
  onChange,
  disabled,
}: {
  prefixo: string;
  valor: CamposOpcaoValor;
  onChange: (v: CamposOpcaoValor) => void;
  disabled?: boolean;
}) {
  const set = (k: keyof CamposOpcaoValor) => (texto: string) => onChange({ ...valor, [k]: texto });
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <CampoNumero
        id={`${prefixo}-S`}
        rotulo="Preço atual do ativo"
        ajuda="Preço de hoje do ativo da opção (açúcar, dólar…)."
        valor={valor.S}
        onChange={set("S")}
        {...FAIXAS.S}
        disabled={disabled}
      />
      <CampoNumero
        id={`${prefixo}-K`}
        rotulo="Preço de exercício (strike)"
        termo="strike"
        ajuda="Preço pelo qual a call dá o direito de comprar o ativo no vencimento."
        valor={valor.K}
        onChange={set("K")}
        {...FAIXAS.K}
        disabled={disabled}
      />
      <CampoNumero
        id={`${prefixo}-T`}
        rotulo="Prazo até o vencimento"
        unidade="anos"
        ajuda="Quanto falta para a opção vencer. 0,25 ano são cerca de 3 meses."
        valor={valor.T}
        onChange={set("T")}
        {...FAIXAS.T}
        disabled={disabled}
      />
      <CampoNumero
        id={`${prefixo}-r`}
        rotulo="Taxa de juros anual"
        unidade="%"
        ajuda="Juros sem risco no período, como a Selic. Juros maiores encarecem a call."
        valor={valor.r}
        onChange={set("r")}
        {...FAIXAS.r}
        disabled={disabled}
      />
      <CampoNumero
        id={`${prefixo}-sigma`}
        rotulo="Volatilidade anual (σ)"
        termo="volatilidade"
        unidade="%"
        ajuda="Quanto o preço costuma oscilar em um ano. Mais volatilidade deixa a opção mais cara."
        valor={valor.sigma}
        onChange={set("sigma")}
        {...FAIXAS.sigma}
        disabled={disabled}
        className="sm:col-span-2"
      />
    </div>
  );
}
