"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Analise, Ferramenta, FERRAMENTAS, idReabertura } from "@/lib/analises";

/**
 * ANA-05: se a URL traz ?reabrir=<id>, busca a análise e entrega os parâmetros salvos
 * à tela, que preenche o formulário. Análise de outra ferramenta vira aviso.
 */
export function useReabrirAnalise(ferramenta: Ferramenta, aplicar: (parametros: Analise["parametros"]) => void) {
  const aplicarRef = useRef(aplicar);
  useEffect(() => {
    aplicarRef.current = aplicar;
  });

  useEffect(() => {
    const id = idReabertura(window.location.search);
    if (!id) return;
    apiFetch<Analise>(`/api/analises/${encodeURIComponent(id)}`)
      .then((a) => {
        if (a.ferramenta !== ferramenta) {
          toast.error(`Esta análise é de ${FERRAMENTAS[a.ferramenta]}. Abra-a pela ferramenta certa.`);
          return;
        }
        aplicarRef.current(a.parametros);
      })
      .catch((e) => toast.error((e as Error).message));
  }, [ferramenta]);
}
