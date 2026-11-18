// Tipos das respostas da API usados em mais de uma tela (fonte única).

export interface PriceRow {
  date: string;
  close: number | null;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  volume?: number | null;
}

export interface FocusEntry {
  value: number | null;
  delta: number | null;
}

export interface FocusData {
  ipca: FocusEntry;
  cambio: FocusEntry;
  selic: FocusEntry;
  pib: FocusEntry;
  ano_referencia: string;
}

/** state: REGULAR, PRE, POST, CLOSED ou UNKNOWN (este último quando o backend não sabe). */
export interface MarketStatus {
  ticker: string;
  state: string;
  open: boolean;
}

/** Simulação salva (GET /api/simulations). */
export interface SimulationRow {
  id: string;
  ticker: string;
  label: string | null;
  preco_inicial: number;
  dias_simulados: number;
  p5: number;
  p50: number;
  p95: number;
  created_at: string;
}
