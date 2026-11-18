// Estado do pregão vindo de /api/market/status (YAH-05). Sem resposta, o estado é UNKNOWN, nunca "fechado".

export interface StatusMercado {
  rotulo: string;
  classeChip: string;
  classePonto: string;
}

export function statusMercado(state: string): StatusMercado {
  if (state === "REGULAR") {
    return { rotulo: "Mercado aberto", classeChip: "bg-positive/10 text-positive", classePonto: "animate-pulse bg-positive" };
  }
  if (state === "CLOSED") {
    return { rotulo: "Mercado fechado", classeChip: "bg-negative/10 text-negative", classePonto: "bg-negative" };
  }
  return { rotulo: "Status indisponível", classeChip: "bg-muted text-muted-foreground", classePonto: "bg-muted-foreground" };
}
