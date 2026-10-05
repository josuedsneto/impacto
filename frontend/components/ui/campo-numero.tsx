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
  /** Texto digitado; quem usa converte com lerNumero (e divide por 100 quando a unidade é %). */
  valor: string;
  onChange: (texto: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

/** Mensagem de erro do campo, ou null se o texto é aceitável. */
function erroCampo(texto: string, { min = -Infinity, max = Infinity, opcional }: Faixa, unidade = ""): string | null {
  if (!texto.trim()) return opcional ? null : "Informe um número.";
  return erroFaixa(lerNumero(texto), min, max, unidade);
}

/** O formulário usa para bloquear o envio enquanto houver campo inválido (LING-02 AC6). */
export function campoValido(texto: string, faixa: Faixa = {}): boolean {
  return erroCampo(texto, faixa) === null;
}

/** Campo numérico que aceita vírgula, mostra a unidade no rótulo e avisa quando sai da faixa. */
export function CampoNumero({
  id, rotulo, unidade, ajuda, valor, onChange, min, max, opcional, disabled, placeholder, className,
}: CampoNumeroProps) {
  // Só reclama de campo vazio depois que a pessoa digitou algo; vazio inicial não é erro visível.
  const erro = valor.trim() ? erroCampo(valor, { min, max, opcional }, unidade) : null;
  return (
    <div className={cn("space-y-1", className)}>
      <Label htmlFor={id}>
        {rotulo}
        {unidade && ` (${unidade})`}
        {opcional && <span className="font-normal text-muted-foreground"> · opcional</span>}
        <FieldTooltip text={ajuda} />
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
