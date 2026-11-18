"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { BotaoExportar } from "@/components/ui/botao-exportar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatBRL, formatCents, formatDate, formatFX, formatNumber } from "@/lib/format";
import { nomeArquivo } from "@/lib/csv";
import {
  INSTRUMENTOS, LOTE_MAX, STATUS_LABEL, gerarCsvPosicoes, parseCsvPosicoes, parseNumero, pontosPercentuais,
  validarPosicao, type Instrumento, type PosicaoDados, type PosicaoLinha, type ResultadoImportacao, type Resumo,
} from "@/lib/posicoes";

interface Usina { id: string; nome: string }

/** Safra agrícola começa em abril: em 18/11/2026 a safra é 2026/27. */
function safraAtual(): string {
  const hoje = new Date();
  const ano = hoje.getMonth() >= 3 ? hoje.getFullYear() : hoje.getFullYear() - 1;
  return `${ano}/${String((ano + 1) % 100).padStart(2, "0")}`;
}

interface Form {
  instrumento: Instrumento;
  volume: string;
  preco: string;
  cambio: string;
  premio: string;
  vencimento: string;
  contraparte: string;
  observacao: string;
}

const FORM_VAZIO: Form = {
  instrumento: "fixacao_acucar", volume: "", preco: "", cambio: "", premio: "",
  vencimento: "", contraparte: "", observacao: "",
};

const ehAcucar = (i: Instrumento) => i === "fixacao_acucar" || i === "futuro_acucar" || i === "opcao_acucar";
const precoFormatado = (p: PosicaoLinha) => (ehAcucar(p.instrumento) ? formatCents(p.preco_fixado) : formatFX(p.preco_fixado));
const nulo = (s: string) => (s.trim() === "" ? null : s.trim());

export default function PosicoesPage() {
  const [usinas, setUsinas] = useState<Usina[]>([]);
  const [usinaId, setUsinaId] = useState("");
  const [safra, setSafra] = useState(safraAtual);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [politica, setPolitica] = useState({ minimo: "", maximo: "", producao: "" });
  const [form, setForm] = useState<Form>(FORM_VAZIO);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [importacao, setImportacao] = useState<ResultadoImportacao | null>(null);
  const [enviando, setEnviando] = useState(false);

  const usinaNome = usinas.find((u) => u.id === usinaId)?.nome ?? "";

  useEffect(() => {
    apiFetch<{ usinas: Usina[] }>("/api/atr/usinas")
      .then((d) => {
        setUsinas(d.usinas);
        setUsinaId((atual) => atual || d.usinas[0]?.id || "");
      })
      .catch((e) => setErro((e as Error).message));
  }, []);

  // Trocar usina ou safra invalida o que estava na tela: importação, edição e resumo antigo.
  useEffect(() => {
    setImportacao(null);
    setEditandoId(null);
    setForm(FORM_VAZIO);
    setResumo(null);
  }, [usinaId, safra]);

  const carregar = useCallback(async () => {
    // Só busca com safra completa: evita uma requisição (e um 429) por tecla digitada.
    if (!usinaId || !/^\d{4}\/\d{2}$/.test(safra)) return;
    setCarregando(true);
    setErro(null);
    try {
      const r = await apiFetch<Resumo>(`/api/posicoes/resumo?usina_id=${usinaId}&safra=${encodeURIComponent(safra)}`);
      setResumo(r);
      setPolitica({
        minimo: r.minimo_pct?.toString() ?? "",
        maximo: r.maximo_pct?.toString() ?? "",
        producao: r.producao_estimada_t?.toString() ?? "",
      });
    } catch (e) {
      setResumo(null);
      setErro((e as Error).message);
    } finally {
      setCarregando(false);
    }
  }, [usinaId, safra]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function salvarPolitica() {
    const minimo = parseNumero(politica.minimo);
    const maximo = parseNumero(politica.maximo);
    const producao = parseNumero(politica.producao, true);
    if ((minimo !== null && Number.isNaN(minimo)) || (maximo !== null && Number.isNaN(maximo)) || (producao !== null && Number.isNaN(producao))) {
      toast.error("Use números nos campos da política.");
      return;
    }
    try {
      await apiFetch("/api/politica-hedge", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usina_id: usinaId, safra, minimo_pct: minimo, maximo_pct: maximo, producao_estimada_t: producao }),
      });
      toast.success("Política salva.");
      carregar();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function editar(p: PosicaoLinha) {
    setEditandoId(p.id);
    setForm({
      instrumento: p.instrumento,
      volume: String(p.volume),
      preco: String(p.preco_fixado),
      cambio: p.cambio_fixado?.toString() ?? "",
      premio: p.premio ? String(p.premio) : "",
      vencimento: p.vencimento ?? "",
      contraparte: p.contraparte ?? "",
      observacao: p.observacao ?? "",
    });
  }

  async function salvarPosicao() {
    const dados: PosicaoDados = {
      safra,
      instrumento: form.instrumento,
      volume: parseNumero(form.volume, true) ?? NaN,
      preco_fixado: parseNumero(form.preco) ?? NaN,
      cambio_fixado: parseNumero(form.cambio),
      premio: parseNumero(form.premio) ?? 0,
      vencimento: nulo(form.vencimento),
      contraparte: nulo(form.contraparte),
      observacao: nulo(form.observacao),
    };
    const motivos = validarPosicao(dados);
    if (motivos.length) {
      toast.error(`Não foi possível salvar: ${motivos.join("; ")}.`);
      return;
    }
    setEnviando(true);
    const corpo = JSON.stringify({ ...dados, usina_id: usinaId });
    try {
      await apiFetch(editandoId ? `/api/posicoes/${editandoId}` : "/api/posicoes", {
        method: editandoId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: corpo,
      });
      toast.success(editandoId ? "Posição atualizada." : "Posição registrada.");
      setForm(FORM_VAZIO);
      setEditandoId(null);
      carregar();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  async function apagar(id: string) {
    if (!window.confirm("Apagar esta posição? Essa ação não pode ser desfeita.")) return;
    try {
      await apiFetch(`/api/posicoes/${id}`, { method: "DELETE" });
      toast.success("Posição apagada.");
      carregar();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function lerArquivo(arquivo: File) {
    setImportacao(parseCsvPosicoes(await arquivo.text(), safra));
  }

  async function importar() {
    if (!importacao?.posicoes.length) return;
    setEnviando(true);
    try {
      const r = await apiFetch<{ inseridas: number }>("/api/posicoes/lote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usina_id: usinaId, safra, posicoes: importacao.posicoes }),
      });
      toast.success(`${r.inseridas} posições importadas.`);
      setImportacao(null);
      carregar();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  const alerta = resumo && (resumo.status === "abaixo" || resumo.status === "acima");
  const campo = (rotulo: string, chave: keyof Form, tipo = "text", extra?: object) => (
    <div className="grid gap-1.5">
      <Label htmlFor={chave}>{rotulo}</Label>
      <Input id={chave} type={tipo} value={form[chave]} onChange={(e) => setForm({ ...form, [chave]: e.target.value })} {...extra} />
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Posições da safra"
        descricao="Fixações da usina por safra: quanto está fechado, a que preço e quanto vale a carteira hoje."
        atualizadoEm={resumo?.data_sb ? `Preço do açúcar em ${formatDate(resumo.data_sb)}` : undefined}
        acoes={
          <BotaoExportar
            arquivo={nomeArquivo("posicoes", `${usinaNome} ${safra}`)}
            montar={resumo ? () => gerarCsvPosicoes({ usina: usinaNome, safra, resumo }) : null}
          />
        }
      />

      <div className="flex flex-wrap gap-3">
        <select
          aria-label="Usina"
          className="h-9 rounded-md border bg-background px-3 text-sm"
          value={usinaId}
          onChange={(e) => { setUsinaId(e.target.value); setEditandoId(null); }}
        >
          {usinas.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
        </select>
        <Input aria-label="Safra" className="w-32" value={safra} onChange={(e) => setSafra(e.target.value)} placeholder="2026/27" />
      </div>

      {erro && <ErrorState mensagem={erro} onRetry={carregar} />}
      {!erro && carregando && !resumo && <Skeleton className="h-40 w-full" />}

      {usinaId && (
        <>
          {resumo && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">% fixado da safra</CardTitle></CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{pontosPercentuais(resumo.pct_fixado)}</p>
                <p className={alerta ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
                  {STATUS_LABEL[resumo.status]}
                  {resumo.minimo_pct !== null && resumo.maximo_pct !== null && ` · política ${formatNumber(resumo.minimo_pct, 0)}% a ${formatNumber(resumo.maximo_pct, 0)}%`}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Preço médio fixado</CardTitle></CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{formatCents(resumo.preco_medio_cents_lb)}</p>
                <p className="text-sm text-muted-foreground">{resumo.preco_medio_rs_t === null ? "Sem câmbio fixado" : `${formatBRL(resumo.preco_medio_rs_t)}/t`}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Valor a mercado (MTM)</CardTitle></CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{formatBRL(resumo.mtm_total_rs)}</p>
                <p className="text-sm text-muted-foreground">Positivo: a carteira ganha com o preço atual</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Preço usado</CardTitle></CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{formatCents(resumo.sb_fechamento)}</p>
                <p className="text-sm text-muted-foreground">
                  Dólar {formatFX(resumo.usdbrl_fechamento)} · SB=F {formatDate(resumo.data_sb)}
                </p>
              </CardContent>
            </Card>
          </div>}

          {resumo && resumo.avisos.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {resumo.avisos.map((a) => <li key={a}>{a}</li>)}
            </ul>
          )}

          <Card>
            <CardHeader><CardTitle>Política de hedge</CardTitle></CardHeader>
            <CardContent className="grid items-end gap-3 sm:grid-cols-4">
              <div className="grid gap-1.5"><Label htmlFor="pmin">Mínimo (%)</Label><Input id="pmin" inputMode="decimal" value={politica.minimo} onChange={(e) => setPolitica({ ...politica, minimo: e.target.value })} /></div>
              <div className="grid gap-1.5"><Label htmlFor="pmax">Máximo (%)</Label><Input id="pmax" inputMode="decimal" value={politica.maximo} onChange={(e) => setPolitica({ ...politica, maximo: e.target.value })} /></div>
              <div className="grid gap-1.5"><Label htmlFor="pprod">Produção estimada (t)</Label><Input id="pprod" inputMode="decimal" value={politica.producao} onChange={(e) => setPolitica({ ...politica, producao: e.target.value })} /></div>
              <Button type="button" onClick={salvarPolitica}>Salvar política</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>{editandoId ? "Editar posição" : "Nova posição"}</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="grid gap-1.5">
                <Label htmlFor="instrumento">Instrumento</Label>
                <select id="instrumento" className="h-9 rounded-md border bg-background px-3 text-sm" value={form.instrumento}
                  onChange={(e) => setForm({ ...form, instrumento: e.target.value as Instrumento })}>
                  {Object.entries(INSTRUMENTOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              {campo(ehAcucar(form.instrumento) ? "Volume (t)" : "Volume (US$)", "volume")}
              {campo(ehAcucar(form.instrumento) ? "Preço fixado (¢/lb)" : "Taxa ou strike (R$/US$)", "preco")}
              {ehAcucar(form.instrumento) && campo("Câmbio fixado (R$/US$)", "cambio")}
              {form.instrumento.startsWith("opcao") && campo("Prêmio pago (mesma unidade do preço)", "premio")}
              {campo("Vencimento", "vencimento", "date")}
              {campo("Contraparte", "contraparte")}
              {campo("Observação", "observacao")}
              <div className="flex gap-2 sm:col-span-2 xl:col-span-4">
                <Button type="button" onClick={salvarPosicao} disabled={enviando || !usinaId}>
                  {editandoId ? "Salvar alterações" : "Registrar posição"}
                </Button>
                {editandoId && <Button type="button" variant="outline" onClick={() => { setEditandoId(null); setForm(FORM_VAZIO); }}>Cancelar edição</Button>}
              </div>
            </CardContent>
          </Card>

          {resumo && (resumo.posicoes.length === 0 ? (
            <EmptyState mensagem="Esta safra ainda não tem posições. Registre a primeira acima ou importe a planilha da carteira." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Instrumento</TableHead>
                    <TableHead>Volume</TableHead>
                    <TableHead>Preço</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>MTM</TableHead>
                    <TableHead><span className="sr-only">Ações</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resumo.posicoes.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{INSTRUMENTOS[p.instrumento]}</TableCell>
                      <TableCell>{formatNumber(p.volume, 0)} {p.unidade}</TableCell>
                      <TableCell>{precoFormatado(p)}</TableCell>
                      <TableCell>{formatDate(p.vencimento)}</TableCell>
                      <TableCell>{formatBRL(p.mtm_rs)}</TableCell>
                      <TableCell className="space-x-2 whitespace-nowrap">
                        <Button type="button" variant="ghost" size="sm" onClick={() => editar(p)}>Editar</Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => apagar(p.id)}>Apagar</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ))}
        </>
      )}

      <Card>
        <CardHeader><CardTitle>Importar planilha da carteira</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            CSV com separador &quot;;&quot; e vírgula decimal (padrão Excel BR). Colunas: Safra, Instrumento, Volume, Preço fixado,
            Câmbio fixado, Prêmio, Vencimento, Contraparte, Observação. Até {LOTE_MAX} linhas, todas na safra selecionada.
          </p>
          <Input type="file" accept=".csv,text/csv" aria-label="Arquivo CSV" onChange={(e) => { const f = e.target.files?.[0]; if (f) lerArquivo(f); }} />
          {importacao?.cabecalho && <p className="text-sm text-destructive">{importacao.cabecalho}</p>}
          {importacao && !importacao.cabecalho && (
            <div className="space-y-2 text-sm">
              <p>{importacao.posicoes.length} posições prontas para importar.</p>
              {importacao.erros.length > 0 && (
                <ul className="space-y-1 text-destructive">
                  {importacao.erros.map((e) => <li key={e.linha}>Linha {e.linha}: {e.motivo}</li>)}
                </ul>
              )}
              {importacao.erros.length === 0 && importacao.posicoes.length > 0 && (
                <Button type="button" onClick={importar} disabled={enviando}>Importar {importacao.posicoes.length} posições</Button>
              )}
              {importacao.erros.length > 0 && <p className="text-muted-foreground">Nada foi importado. Corrija o arquivo e envie de novo.</p>}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        MTM marcado contra o último fechamento de SB=F e USDBRL=X, sem ajuste por mês de vencimento. Opções valem pelo intrínseco menos o prêmio.
      </p>
    </div>
  );
}
