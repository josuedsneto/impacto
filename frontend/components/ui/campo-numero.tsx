"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldTooltip } from "@/components/ui/field-tooltip";
import { erroFaixa, lerNumero } from "@/lib/numero";
import { cn } from "@/lib/utils";

interface Faixa {
  min?: number;
  max?: number;
  opcional?: boolean;
}

interface CampoNumeroProps extends Faixa {
  id: string;
  rotulo: string;
  /** Mostrada no rótulo entre parênteses: "Volatilidade anual (%)". */
  unidade?: string;
  /** Até 2 frases sobre o efeito do campo no resultado. */
  ajuda: string;
  /** id de um termo do glossário, para o link "Ver no glossário". */
  termo?: string;
  /** Texto digitado; quem usa converte com lerNumero (e divide por 100 quando a unidade é %). */
  valor: string;
  onChange: (texto: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  /** Erro vindo do formulário (envio ou API). Tem prioridade sobre a checagem local. */
  erro?: string;
}

/** Mensagem de erro do campo, ou null se o texto é aceitável. */
export function erroCampo(texto: string, { min = -Infinity, max = Infinity, opcional }: Faixa, unidade = ""): string | null {
  if (!texto.trim()) return opcional ? null : "Informe um número.";
  return erroFaixa(lerNumero(texto), min, max, unidade);
}

/** Erros de todos os campos antes do envio: vazio ou fora da faixa. Objeto vazio = pode enviar. */
export function errosDosCampos<T extends { chave: string; unidade?: string }>(
  campos: readonly T[],
  valores: Record<string, string>,
  faixa: Faixa,
): Record<string, string> {
  const erros: Record<string, string> = {};
  for (const c of campos) {
    const e = erroCampo(valores[c.chave] ?? "", faixa, c.unidade);
    if (e) erros[c.chave] = e;
  }
  return erros;
}

/** Converte o 422 da API (campo → "Valor inválido.") em mensagem com o rótulo em português. */
export function errosDaApi(
  campos: Record<string, string>,
  lista: readonly { chave: string; rotulo: string }[],
): Record<string, string> {
  const erros: Record<string, string> = {};
  for (const chave of Object.keys(campos)) {
    const c = lista.find((item) => item.chave === chave);
    if (c) erros[chave] = `Valor inválido para ${c.rotulo}.`;
  }
  return erros;
}

/** O formulário usa para bloquear o envio enquanto houver campo inválido (LING-02 AC6). */
export function campoValido(texto: string, faixa: Faixa = {}): boolean {
  return erroCampo(texto, faixa) === null;
}

/** Campo numérico que aceita vírgula, mostra a unidade no rótulo e avisa quando sai da faixa. */
export function CampoNumero({
  id, rotulo, unidade, ajuda, termo, valor, onChange, min, max, opcional, disabled, placeholder, className, erro: erroExterno,
}: CampoNumeroProps) {
  // Erro do formulário tem prioridade. Sem ele, só reclama de campo vazio depois que a pessoa digitou algo.
  const erro = erroExterno || (valor.trim() ? erroCampo(valor, { min, max, opcional }, unidade) : null);
  return (
    <div className={cn("space-y-1", className)}>
      <Label htmlFor={id}>
        {rotulo}
        {unidade && ` (${unidade})`}
        {opcional && <span className="font-normal text-muted-foreground"> · opcional</span>}
        <FieldTooltip text={ajuda} termo={termo} />
      </Label>
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? `${id}-erro` : undefined}
      />
      {erro && (
        <p id={`${id}-erro`} className="text-xs text-negative">
          {erro}
        </p>
      )}
    </div>
  );
}
