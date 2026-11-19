// Posições de fixação: tipos, validação (mesma regra do backend), CSV de importação e exportação.
import { gerarCsv, type Tabela } from "@/lib/csv";
import { formatNumber } from "@/lib/format";

export const INSTRUMENTOS = {
  fixacao_acucar: "Fixação de açúcar",
  futuro_acucar: "Futuro de açúcar",
  ndf_dolar: "NDF de dólar",
  opcao_acucar: "Opção de açúcar",
  opcao_dolar: "Opção de dólar",
} as const;
export type Instrumento = keyof typeof INSTRUMENTOS;

export const ehOpcao = (i: string) => i === "opcao_acucar" || i === "opcao_dolar";
export type TipoOpcao = "call" | "put";
export const TIPO_OPCAO_LABEL: Record<TipoOpcao, string> = {
  call: "Call (direito de comprar)",
  put: "Put (direito de vender)",
};

export const MODELO_LABEL: Record<string, string> = {
  black76: "Black-76",
  gk: "Garman-Kohlhagen",
  intrinseco: "Valor intrínseco",
};

export const STATUS_LABEL: Record<string, string> = {
  dentro: "Dentro da política",
  abaixo: "Abaixo do mínimo",
  acima: "Acima do máximo",
  sem_politica: "Sem política definida",
  sem_producao: "Sem produção estimada",
};

export const LOTE_MAX = 500;
const SAFRA_RE = /^\d{4}\/\d{2}$/;

/** Dados de uma posição como a tela os monta (números já convertidos). */
export interface PosicaoDados {
  safra: string;
  instrumento: Instrumento;
  volume: number; // NaN quando inválido
  preco_fixado: number;
  cambio_fixado: number | null;
  premio: number;
  vencimento: string | null;
  contraparte: string | null;
  observacao: string | null;
  tipo_opcao?: TipoOpcao | null; // nulo ou ausente em opção = put (linhas do MVP)
}

/** Detalhe do MTM por modelo de uma opção (POS-V2-05). Nulos quando o modelo é o intrínseco. */
export interface DetalheModelo {
  modelo?: "black76" | "gk" | "intrinseco" | null;
  vol_anual?: number | null;
  taxa_dom?: number | null;
  taxa_for?: number | null;
  anos_ate_vencimento?: number | null;
  valor_unitario?: number | null;
  aviso?: string | null;
}

export interface PosicaoLinha extends PosicaoDados, DetalheModelo {
  id: string;
  unidade: "t" | "US$";
  mtm_rs: number;
}

/** Resposta de GET /api/posicoes/exposicao (POS-V2-06). */
export interface Exposicao {
  pct_fixado: number | null;
  pct_travado: number | null;
  pct_travado_rs: number | null;
  producao_estimada_t: number | null;
  acucar_aberto_t: number | null;
  preco_medio_cents_lb: number | null;
  preco_medio_rs_t: number | null;
  receita_usd_estimada: number | null;
  usd_ndf: number;
  usd_opcao_dolar: number;
  usd_protegido: number;
  usd_aberto: number | null;
  sb_fechamento: number | null;
  usdbrl_fechamento: number | null;
  avisos: string[];
}

export interface Politica {
  minimo_pct: number | null;
  maximo_pct: number | null;
  producao_estimada_t: number | null;
}

export interface Resumo extends Politica {
  pct_fixado: number | null;
  preco_medio_cents_lb: number | null;
  preco_medio_rs_t: number | null;
  mtm_total_rs: number;
  status: string;
  avisos: string[];
  posicoes: PosicaoLinha[];
  sb_fechamento: number | null;
  usdbrl_fechamento: number | null;
  data_sb: string | null;
  data_usdbrl: string | null;
}

/** Mesmas regras de routers/posicoes.py (Pydantic). Devolve os motivos em português. */
export function validarPosicao(d: PosicaoDados): string[] {
  const motivos: string[] = [];
  if (!SAFRA_RE.test(d.safra)) motivos.push("safra deve ser no formato 2026/27");
  if (!(d.instrumento in INSTRUMENTOS)) motivos.push("instrumento desconhecido");
  // Mesmos limites de routers/posicoes.py. NaN cai em todas as comparações (não passa).
  if (!(d.volume > 0 && d.volume < 1e13)) motivos.push("volume deve ser maior que zero e menor que 10 trilhões");
  if (!(d.preco_fixado > 0 && d.preco_fixado < 1e6)) motivos.push("preço fixado deve ser maior que zero");
  if (d.cambio_fixado !== null && !(d.cambio_fixado > 0 && d.cambio_fixado < 1e6)) motivos.push("câmbio fixado deve ser maior que zero");
  if (!(d.premio >= 0 && d.premio < 1e6)) motivos.push("prêmio deve ser zero ou positivo");
  const tipo = d.tipo_opcao ?? null; // ausente = nulo (put nas linhas do MVP)
  if (tipo !== null && tipo !== "call" && tipo !== "put") motivos.push("tipo da opção deve ser call ou put");
  if (tipo !== null && !ehOpcao(d.instrumento)) motivos.push("tipo da opção só vale para opção");
  if (d.contraparte && d.contraparte.length > 120) motivos.push("contraparte com mais de 120 caracteres");
  if (d.observacao && d.observacao.length > 300) motivos.push("observação com mais de 300 caracteres");
  return motivos;
}

/** Número em formato pt-BR ("1.234,56") ou em ponto ("20.5"). Vazio → null; inválido → NaN. */
export function parseNumero(s: string, milhar = false): number | null {
  const t = s.trim();
  if (!t) return null;
  // Sem milhar, "5.250" é decimal (5,25 no ponto). Com milhar (volume e produção), "1.000" é 1000.
  const ehMilhar = milhar && /^-?\d{1,3}(\.\d{3})+$/.test(t);
  const n = Number(t.includes(",") || ehMilhar ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) ? n : NaN;
}

/** "05/10/2026" ou "2026-10-05" → "2026-10-05". Vazio → null; inválida → false. */
function parseData(s: string): string | null | false {
  const t = s.trim();
  if (!t) return null;
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
  const iso = br ? `${br[3]}-${br[2]}-${br[1]}` : t;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  // Data real: rejeita 31/02 e 2027-13-45, que o Date normalizaria em silêncio.
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso ? false : iso;
}

/** Uma linha de CSV com ";" como separador e aspas duplas (com "" para aspa interna). */
export function linhaCsv(l: string): string[] {
  const out: string[] = [];
  let cur = "";
  let aspas = false;
  for (let i = 0; i < l.length; i++) {
    const c = l[i];
    if (aspas) {
      if (c === '"' && l[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') aspas = false;
      else cur += c;
    } else if (c === '"') aspas = true;
    else if (c === ";") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// prefixo: início do nome normalizado (sem acento) da coluna; rotulo: nome mostrado ao usuário.
const COLUNAS: { chave: string; prefixo: string; rotulo: string; obrigatoria: boolean }[] = [
  { chave: "safra", prefixo: "safra", rotulo: "Safra", obrigatoria: true },
  { chave: "instrumento", prefixo: "instrumento", rotulo: "Instrumento", obrigatoria: true },
  { chave: "volume", prefixo: "volume", rotulo: "Volume", obrigatoria: true },
  { chave: "preco", prefixo: "preco fixado", rotulo: "Preço fixado", obrigatoria: true },
  { chave: "cambio", prefixo: "cambio fixado", rotulo: "Câmbio fixado", obrigatoria: false },
  { chave: "premio", prefixo: "premio", rotulo: "Prêmio", obrigatoria: false },
  { chave: "tipo", prefixo: "tipo", rotulo: "Tipo da opção", obrigatoria: false },
  { chave: "vencimento", prefixo: "vencimento", rotulo: "Vencimento", obrigatoria: false },
  { chave: "contraparte", prefixo: "contraparte", rotulo: "Contraparte", obrigatoria: false },
  { chave: "observacao", prefixo: "observacao", rotulo: "Observação", obrigatoria: false },
];

/** Aceita o rótulo em português ou o código do instrumento. */
function instrumentoDe(s: string): Instrumento | null {
  const t = semAcento(s);
  for (const [codigo, rotulo] of Object.entries(INSTRUMENTOS)) {
    if (t === codigo || t === semAcento(rotulo)) return codigo as Instrumento;
  }
  return null;
}

export interface ResultadoImportacao {
  posicoes: PosicaoDados[];
  /** Linha do arquivo (1 = cabeçalho) e motivo. */
  erros: { linha: number; motivo: string }[];
  /** Erro que impede a leitura do arquivo inteiro (cabeçalho, limite de linhas). */
  cabecalho?: string;
}

/** Lê o CSV de posições. Tudo ou nada: se há erro, a tela não envia nada. */
export function parseCsvPosicoes(texto: string, safraEsperada: string): ResultadoImportacao {
  const linhas = texto.replace(/^﻿/, "").split(/\r?\n/);
  // A linha de cabeçalho é a que tem Instrumento e Volume: assim o próprio CSV exportado (que traz
  // um bloco de parâmetros antes da tabela) volta a ser importável.
  const cabecalhoIdx = linhas.findIndex((l) => {
    const c = linhaCsv(l).map(semAcento);
    return c.some((n) => n.startsWith("instrumento")) && c.some((n) => n.startsWith("volume"));
  });
  const primeiraNaoVazia = linhas.findIndex((l) => l.trim() !== "");
  if (primeiraNaoVazia < 0) return { posicoes: [], erros: [], cabecalho: "O arquivo está vazio." };
  const hi = cabecalhoIdx >= 0 ? cabecalhoIdx : primeiraNaoVazia;

  const cols = linhaCsv(linhas[hi]).map(semAcento);
  const idx: Record<string, number> = {};
  for (const c of COLUNAS) {
    const i = cols.findIndex((n) => n.startsWith(c.prefixo));
    if (i < 0 && c.obrigatoria) {
      return { posicoes: [], erros: [], cabecalho: `Falta a coluna "${c.rotulo}" no cabeçalho.` };
    }
    if (i >= 0) idx[c.chave] = i;
  }

  const posicoes: PosicaoDados[] = [];
  const erros: ResultadoImportacao["erros"] = [];
  for (let i = hi + 1; i < linhas.length; i++) {
    if (!linhas[i].trim()) continue;
    const campos = linhaCsv(linhas[i]);
    const g = (k: string) => (k in idx ? campos[idx[k]] ?? "" : "");
    const instrumento = instrumentoDe(g("instrumento"));
    const data = parseData(g("vencimento"));
    const texto_ = (k: string) => g(k) || null;
    const volume = parseNumero(g("volume"), true);
    const preco = parseNumero(g("preco"));
    const cambio = parseNumero(g("cambio"));
    const premio = parseNumero(g("premio"));
    const tipoTexto = semAcento(g("tipo"));
    const tipo = tipoTexto === "" ? null : (tipoTexto as TipoOpcao);

    const motivos: string[] = [];
    if (!instrumento) motivos.push("instrumento desconhecido");
    if (data === false) motivos.push("vencimento deve ser dd/mm/aaaa");
    if (g("safra") !== safraEsperada) motivos.push(`safra deve ser ${safraEsperada}, a selecionada na tela`);

    const dados: PosicaoDados = {
      safra: g("safra"),
      instrumento: instrumento ?? ("" as Instrumento),
      volume: volume ?? NaN,
      preco_fixado: preco ?? NaN,
      cambio_fixado: cambio,
      premio: premio ?? 0,
      vencimento: data || null,
      contraparte: texto_("contraparte"),
      observacao: texto_("observacao"),
      tipo_opcao: tipo,
    };
    motivos.push(...validarPosicao(dados));
    if (motivos.length) erros.push({ linha: i + 1, motivo: [...new Set(motivos)].join("; ") });
    else posicoes.push(dados);
  }

  if (posicoes.length + erros.length > LOTE_MAX) {
    return { posicoes: [], erros: [], cabecalho: `Máximo de ${LOTE_MAX} posições por importação.` };
  }
  return { posicoes, erros };
}

/** CSV da carteira: parâmetros da safra antes da tabela (AD-004, lib/csv.ts). */
export function gerarCsvPosicoes({
  usina, safra, resumo,
}: { usina: string; safra: string; resumo: Resumo }): string {
  const tabela: Tabela = {
    colunas: [
      "Instrumento", "Safra", "Volume (t ou US$)", "Preço fixado (¢/lb ou R$/US$)", "Câmbio fixado (R$/US$)",
      "Prêmio (mesma unidade do preço)", "Tipo da opção", "Vencimento", "Contraparte", "Observação",
      "Modelo do MTM", "Vol anual", "MTM (R$)",
    ],
    linhas: resumo.posicoes.map((p) => [
      INSTRUMENTOS[p.instrumento], p.safra, p.volume, p.preco_fixado, p.cambio_fixado,
      p.premio, p.tipo_opcao ?? (ehOpcao(p.instrumento) ? "put" : null), p.vencimento, p.contraparte, p.observacao,
      p.modelo ? MODELO_LABEL[p.modelo] : null, p.vol_anual, p.mtm_rs,
    ]),
  };
  return gerarCsv({
    parametros: [
      ["Usina", usina],
      ["Safra", safra],
      ["Mínimo da política (%)", resumo.minimo_pct],
      ["Máximo da política (%)", resumo.maximo_pct],
      ["Produção estimada (t)", resumo.producao_estimada_t],
      ["SB=F fechamento (¢/lb)", resumo.sb_fechamento],
      ["SB=F data", resumo.data_sb],
      ["USDBRL=X fechamento (R$/US$)", resumo.usdbrl_fechamento],
      ["USDBRL=X data", resumo.data_usdbrl],
      ["% fixado (%)", resumo.pct_fixado],
    ],
    tabelas: [tabela],
  });
}

/** % em pontos (25 → "25,0%"). Usado na tela; formatPercent espera fração. */
export const pontosPercentuais = (v: number | null) => (v === null ? "—" : `${formatNumber(v, 1)}%`);

/** Safra agrícola começa em abril: em 18/11/2026 a safra é 2026/27. */
export function safraAtual(hoje: Date = new Date()): string {
  const ano = hoje.getMonth() >= 3 ? hoje.getFullYear() : hoje.getFullYear() - 1;
  return `${ano}/${String((ano + 1) % 100).padStart(2, "0")}`;
}

export const AVISO_SEM_CAMBIO = "Sem câmbio fixado, o preço médio em R$/t não foi preenchido. Informe o preço manualmente.";
export const AVISO_SEM_DOLAR = "Não há dólar em aberto nesta safra para preencher.";
export const AVISO_SEM_PRODUCAO = "Sem produção estimada na política da safra: informe o % fixado manualmente.";

/** Valores do risco conjunto a partir da carteira (POS-V2-08). Só a fixação com câmbio entra no %: é a parte com preço em R$/t. */
export function valoresParaRisco(ex: Exposicao): { pctFixado: string | null; precoFixado: string | null; aviso: string | null } {
  const pct = ex.pct_travado_rs === null ? null : Math.min(ex.pct_travado_rs, 100);
  const semPreco = ex.preco_medio_rs_t === null;
  return {
    pctFixado: pct === null ? null : String(pct),
    precoFixado: semPreco ? null : String(ex.preco_medio_rs_t),
    // Fixação existe, mas nenhuma com câmbio: o % vem 0 e o preço vazio; avisar em vez de preencher calado.
    aviso:
      pct === null
        ? AVISO_SEM_PRODUCAO
        : (pct > 0 && semPreco) || (pct === 0 && (ex.pct_travado ?? 0) > 0)
          ? AVISO_SEM_CAMBIO
          : null,
  };
}

/** Volume em US$ para o hedge cambial a partir do dólar em aberto (POS-V2-09). */
export function valorParaHedge(ex: Exposicao): { volume: string | null; aviso: string | null } {
  if (ex.usd_aberto === null) return { volume: null, aviso: "Sem produção estimada ou preço do açúcar: o dólar em aberto não foi calculado." };
  if (ex.usd_aberto <= 0) return { volume: null, aviso: AVISO_SEM_DOLAR };
  return { volume: String(Math.round(ex.usd_aberto)), aviso: null };
}
