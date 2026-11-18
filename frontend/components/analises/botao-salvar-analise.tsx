"use client";

import { useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { FERRAMENTAS, Ferramenta, Valor, validaTitulo, TITULO_MAX } from "@/lib/analises";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Data de hoje no fuso local, AAAA-MM-DD (toISOString usaria UTC e erraria à noite no Brasil). */
export function hojeLocal(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

interface BotaoSalvarAnaliseProps {
  ferramenta: Ferramenta;
  /** Parâmetros usados no cálculo (premissas do relatório). */
  parametros: Record<string, Valor>;
  /** Números principais e a frase de leitura (chave `leitura`). null enquanto não há resultado. */
  resultado: Record<string, Valor> | null;
}

/** ANA-03: salva parâmetros + resumo do resultado com um título. */
export function BotaoSalvarAnalise({ ferramenta, parametros, resultado }: BotaoSalvarAnaliseProps) {
  const [aberto, setAberto] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    const erro = validaTitulo(titulo);
    if (erro) {
      toast.error(erro);
      return;
    }
    if (!resultado) return;
    setSalvando(true);
    try {
      await apiFetch("/api/analises", {
        method: "POST",
        body: JSON.stringify({
          ferramenta,
          titulo: titulo.trim(),
          parametros,
          resultado_resumo: resultado,
          data_referencia: hojeLocal(),
        }),
      });
      toast.success("Análise salva. Veja em Minhas análises.");
      setAberto(false);
      setTitulo("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  if (!aberto) {
    const semResultado = !resultado;
    return (
      // Botão desabilitado não dispara hover; a dica fica no invólucro (mesmo padrão de BotaoExportar).
      <span title={semResultado ? "Gere um resultado para salvar." : undefined}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={semResultado}
          onClick={() => {
            setTitulo(`${FERRAMENTAS[ferramenta]} ${hojeLocal()}`);
            setAberto(true);
          }}
        >
          Salvar análise
        </Button>
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        aria-label="Título da análise"
        value={titulo}
        maxLength={TITULO_MAX}
        onChange={(e) => setTitulo(e.target.value)}
        className="w-56"
      />
      <Button type="button" size="sm" onClick={salvar} disabled={salvando}>
        {salvando ? "Salvando..." : "Salvar"}
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setAberto(false)}>
        Cancelar
      </Button>
    </div>
  );
}
