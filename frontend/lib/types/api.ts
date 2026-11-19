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

// ── Painel "Hoje" (GET /api/painel/hoje) ────────────────────────────────────────

/** Cada seção falha sozinha: dados null com motivo em português (painel-hoje PNL-02). */
export interface Secao<T> {
  dados: T | null;
  motivo: string | null;
}

export interface PainelAlerta {
  id: string;
  rule_id: string;
  mensagem: string;
  created_at: string;
}

export interface PainelFaixaDolar {
  horizonte: number;
  spot: number;
  p5: number;
  p50: number;
  p95: number;
  data_dado: string;
}

export interface PainelAlertas {
  dia_referencia: string;
  disparados: PainelAlerta[];
  ativos: number;
}

export type StatusPosicao = "dentro" | "abaixo" | "acima" | "sem_politica" | "sem_producao";

export interface PainelPosicao {
  usina_id: string;
  usina_nome: string | null;
  safra: string;
  status: StatusPosicao | null;
  pct_fixado: number | null;
  minimo_pct: number | null;
  maximo_pct: number | null;
  mtm_total_rs: number | null;
  n_posicoes: number;
  aviso: string | null;
  motivo: string | null;
}

export interface PainelAnalise {
  id: string;
  ferramenta: string;
  titulo: string;
  created_at: string;
}

export interface PainelHoje {
  gerado_em: string;
  faixa_dolar: Secao<PainelFaixaDolar>;
  alertas: Secao<PainelAlertas>;
  posicoes: Secao<PainelPosicao[]>;
  analises: Secao<PainelAnalise[]>;
}
