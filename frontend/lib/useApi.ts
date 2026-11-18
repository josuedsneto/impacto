"use client";

// Carga de dados no client: loading, erro e retry em um lugar (FD-06).
// Referência para as demais telas; o plano de migração fica em .specs/features/frontend-dados/spec.md.
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export interface EstadoApi<T> {
  dados: T | null;
  carregando: boolean;
  erro: string | null;
}

/** Busca sem lançar: devolve dados ou a mensagem de erro já em português. */
export async function buscar<T>(
  caminho: string,
  chamar: (c: string) => Promise<T> = (c) => apiFetch<T>(c),
): Promise<EstadoApi<T>> {
  try {
    return { dados: await chamar(caminho), carregando: false, erro: null };
  } catch (e) {
    return { dados: null, carregando: false, erro: (e as Error).message };
  }
}

/**
 * `caminho` null não chama a API (carga condicional). Respostas de um caminho antigo
 * são descartadas quando o caminho muda ou o componente desmonta (FD-06).
 */
export function useApi<T>(caminho: string | null) {
  const [tentativa, setTentativa] = useState(0);
  // A resposta guarda a chave (caminho + tentativa) a que pertence; se não bate com a atual, está carregando.
  const chave = `${caminho ?? ""}#${tentativa}`;
  const [guardado, setGuardado] = useState<{ chave: string; estado: EstadoApi<T> } | null>(null);

  useEffect(() => {
    if (caminho === null) return;
    let ignorar = false;
    buscar<T>(caminho).then((r) => {
      if (!ignorar) setGuardado({ chave, estado: r });
    });
    return () => {
      ignorar = true;
    };
    // chave já codifica caminho e tentativa
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  const estado: EstadoApi<T> =
    caminho === null
      ? { dados: null, carregando: false, erro: null }
      : guardado?.chave === chave
        ? guardado.estado
        : { dados: null, carregando: true, erro: null };

  const recarregar = useCallback(() => setTentativa((t) => t + 1), []);

  return { ...estado, recarregar };
}
