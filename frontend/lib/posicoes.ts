// Posições de fixação: tipos, validação (mesma regra do backend), CSV de importação e exportação.
import { gerarCsv, type Tabela } from "@/lib/csv";
import { formatNumber } from "@/lib/format";

export const INSTRUMENTOS = {
  fixacao_acucar: "Fixação de açúcar",
  futuro_acucar: "Futuro de açúcar",
  ndf_dolar: "NDF de dólar",
  opcao_acucar: "Opção de açúcar (put)",
  opcao_dolar: "Opção de dólar (put)",
} as const;
export type Instrumento = keyof typeof INSTRUMENTOS;

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
}

export interface PosicaoLinha extends PosicaoDados {
  id: string;
  unidade: "t" | "US$";
  mtm_rs: number;
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
  if (!(d.volume > 0)) motivos.push("volume deve ser maior que zero");
  if (!(d.preco_fixado > 0)) motivos.push("preço fixado deve ser maior que zero");
  if (d.cambio_fixado !== null && !(d.cambio_fixado > 0)) motivos.push("câmbio fixado deve ser maior que zero");
  if (!(d.premio >= 0)) motivos.push("prêmio não pode ser negativo");
  return motivos;
}

/** Número em formato pt-BR ("1.234,56") ou em ponto ("20.5"). Vazio → null; inválido → NaN. */
export function parseNumero(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  // "1.000" e "1.234.567" são milhar; "20.5" continua decimal.
  const milhar = /^-?\d{1,3}(\.\d{3})+$/.test(t);
  const n = Number(t.includes(",") || milhar ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) ? n : NaN;
}

/** "05/10/2026" ou "2026-10-05" → "2026-10-05". Vazio → null; inválida → false. */
function parseData(s: string): string | null | false {
  const t = s.trim();
  if (!t) return null;
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : false;
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
  const hi = linhas.findIndex((l) => l.trim() !== "");
  if (hi < 0) return { posicoes: [], erros: [], cabecalho: "O arquivo está vazio." };

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
    const volume = parseNumero(g("volume"));
    const preco = parseNumero(g("preco"));
    const cambio = parseNumero(g("cambio"));
    const premio = parseNumero(g("premio"));

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
      "Prêmio (mesma unidade do preço)", "Vencimento", "Contraparte", "Observação", "MTM (R$)",
    ],
    linhas: resumo.posicoes.map((p) => [
      INSTRUMENTOS[p.instrumento], p.safra, p.volume, p.preco_fixado, p.cambio_fixado,
      p.premio, p.vencimento, p.contraparte, p.observacao, p.mtm_rs,
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
