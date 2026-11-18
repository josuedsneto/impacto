// Autenticação das rotas de cron (DEC-19). Usado pelas rotas em app/api/cron/*.
import { timingSafeEqual } from "node:crypto";

/** Confere `Authorization: Bearer <CRON_SECRET>` em tempo constante. Sem segredo configurado, recusa tudo. */
export function cronAutorizado(header: string | null, segredo: string | undefined): boolean {
  if (!segredo) return false;
  const esperado = Buffer.from(`Bearer ${segredo}`);
  const recebido = Buffer.from(header ?? "");
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
}
