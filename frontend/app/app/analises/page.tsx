"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/format";
import { hojeLocal } from "@/components/analises/botao-salvar-analise";
import {
  Analise,
  Ferramenta,
  FERRAMENTAS,
  TITULO_MAX,
  dataLocalDe,
  leituraDe,
  montarComparacao,
  motivoNaoMarcar,
  podeComparar,
  premissas,
  resultadoDe,
  validaTitulo,
} from "@/lib/analises";

const PAGINA = 50;

const ROTA: Record<Ferramenta, string> = {
  var: "/app/var",
  breakeven: "/app/breakeven",
  risco: "/app/risco",
  opcoes: "/app/options",
};

// data_referencia já é só data; created_at é instante e precisa do fuso local.
const dataDeReferencia = (dia: string) => formatDate(dia);
const dataSalva = (instante: string) => formatDate(dataLocalDe(instante));

/** ANA-07: área de impressão. Fica oculta na tela e, na impressão, é a única coisa visível. */
function Relatorio({ analises }: { analises: Analise[] }) {
  if (analises.length === 0) return null;
  const comparacao = analises.length >= 2 ? montarComparacao(analises) : null;
  return (
    <div className="area-relatorio hidden print:block">
      <p className="text-xl font-bold">Relatório de análises</p>
      <p className="text-sm">Emitido em {formatDate(hojeLocal())}</p>

      {comparacao && (
        <section className="mt-6">
          <h2 className="text-lg font-semibold">Comparação</h2>
          <Tabela colunas={comparacao.colunas} linhas={comparacao.linhas} />
        </section>
      )}

      {analises.map((a) => (
        <section key={a.id} className="mt-6 break-inside-avoid">
          <h2 className="text-lg font-semibold">{a.titulo}</h2>
          <p className="text-sm">
            {FERRAMENTAS[a.ferramenta]} · Data de referência: {dataDeReferencia(a.data_referencia)} · Salva em{" "}
            {dataSalva(a.created_at)}
          </p>
          <h3 className="mt-3 font-semibold">Premissas</h3>
          <ul className="text-sm">
            {premissas(a).map((p) => (
              <li key={p.rotulo}>
                {p.rotulo}: {p.valor}
              </li>
            ))}
          </ul>
          <h3 className="mt-3 font-semibold">Resultado</h3>
          <ul className="text-sm">
            {resultadoDe(a).map((r) => (
              <li key={r.rotulo}>
                {r.rotulo}: {r.valor}
              </li>
            ))}
          </ul>
          {leituraDe(a) && <p className="mt-3 text-sm italic">{leituraDe(a)}</p>}
        </section>
      ))}
    </div>
  );
}

function Tabela({ colunas, linhas }: { colunas: string[]; linhas: { rotulo: string; valores: string[] }[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2 pr-4 font-medium text-muted-foreground" />
            {colunas.map((c, i) => (
              <th key={i} className="py-2 pr-4 font-semibold">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.rotulo} className="border-b">
              <th scope="row" className="py-2 pr-4 text-left font-medium whitespace-nowrap">
                {l.rotulo}
              </th>
              {l.valores.map((v, i) => (
                <td key={i} className="py-2 pr-4 tabular-nums">
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AnalisesPage() {
  const [filtro, setFiltro] = useState<Ferramenta | "todas">("todas");
  const [analises, setAnalises] = useState<Analise[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [temMais, setTemMais] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  // ids na ordem em que foram marcados
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [comparando, setComparando] = useState(false);
  const [editando, setEditando] = useState<{ id: string; titulo: string } | null>(null);

  function query(offset: number) {
    const qs = new URLSearchParams({ limit: String(PAGINA), offset: String(offset) });
    if (filtro !== "todas") qs.set("ferramenta", filtro);
    return qs.toString();
  }

  useEffect(() => {
    let vivo = true;
    const qs = new URLSearchParams({ limit: String(PAGINA), offset: "0" });
    if (filtro !== "todas") qs.set("ferramenta", filtro);
    apiFetch<{ analises: Analise[] }>(`/api/analises?${qs}`)
      .then((r) => {
        if (!vivo) return;
        setAnalises(r.analises);
        setTemMais(r.analises.length === PAGINA);
        setErro(null);
      })
      .catch((e) => vivo && setErro((e as Error).message))
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
  }, [filtro, tentativa]);

  async function carregarMais() {
    try {
      const r = await apiFetch<{ analises: Analise[] }>(`/api/analises?${query(analises.length)}`);
      setAnalises((prev) => [...prev, ...r.analises]);
      setTemMais(r.analises.length === PAGINA);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function mudarFiltro(valor: string) {
    setFiltro(valor as Ferramenta | "todas");
    setCarregando(true);
    setSelecionadas([]);
    setComparando(false);
  }

  const selAnalises = selecionadas
    .map((id) => analises.find((a) => a.id === id))
    .filter((a): a is Analise => Boolean(a));
  const mostraComparacao = comparando && podeComparar(selAnalises);

  function alternar(a: Analise) {
    if (selecionadas.includes(a.id)) {
      setSelecionadas((s) => s.filter((x) => x !== a.id));
      return;
    }
    const motivo = motivoNaoMarcar(selAnalises, a);
    if (motivo) {
      toast.error(motivo);
      return;
    }
    setSelecionadas((s) => [...s, a.id]);
  }

  async function salvarTitulo() {
    if (!editando) return;
    const erroTitulo = validaTitulo(editando.titulo);
    if (erroTitulo) {
      toast.error(erroTitulo);
      return;
    }
    try {
      const atualizada = await apiFetch<Analise>(`/api/analises/${editando.id}`, {
        method: "PATCH",
        body: JSON.stringify({ titulo: editando.titulo.trim() }),
      });
      setAnalises((prev) => prev.map((a) => (a.id === atualizada.id ? { ...a, titulo: atualizada.titulo } : a)));
      setEditando(null);
      toast.success("Título atualizado.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function excluir(a: Analise) {
    if (!window.confirm(`Excluir a análise "${a.titulo}"? Essa ação não pode ser desfeita.`)) return;
    try {
      await apiFetch(`/api/analises/${a.id}`, { method: "DELETE" });
      setAnalises((prev) => prev.filter((x) => x.id !== a.id));
      setSelecionadas((s) => s.filter((x) => x !== a.id));
      toast.success("Análise excluída.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      {/* Na impressão só o relatório aparece (regra em <style> abaixo). */}
      <div className="space-y-6 print:hidden">
        <PageHeader
          titulo="Minhas análises"
          descricao="Resultados salvos das ferramentas. Marque de 2 a 3 da mesma ferramenta para comparar, ou imprima um relatório."
        />

        <div className="flex flex-wrap items-center gap-3">
          <Select value={filtro} onValueChange={(v) => v && mudarFiltro(v)}>
            <SelectTrigger className="w-56" aria-label="Filtrar por ferramenta">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as ferramentas</SelectItem>
              {(Object.keys(FERRAMENTAS) as Ferramenta[]).map((f) => (
                <SelectItem key={f} value={f}>
                  {FERRAMENTAS[f]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!podeComparar(selAnalises)}
              title={podeComparar(selAnalises) ? undefined : "Marque de 2 a 3 análises da mesma ferramenta."}
              onClick={() => setComparando(true)}
            >
              Comparar
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={selAnalises.length === 0}
              title={selAnalises.length === 0 ? "Marque uma ou mais análises para imprimir." : undefined}
              onClick={() => window.print()}
            >
              Imprimir / salvar PDF
            </Button>
          </div>
        </div>

        {erro && <ErrorState mensagem={erro} onRetry={() => { setErro(null); setCarregando(true); setTentativa((t) => t + 1); }} />}
        {carregando && <Skeleton className="h-40" />}
        {!carregando && !erro && analises.length === 0 && (
          <EmptyState mensagem="Nenhuma análise salva ainda. Use “Salvar análise” em VaR, Breakeven, Risco do EBITDA ou Opções." />
        )}

        {!carregando && !erro && analises.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="w-10 py-2" aria-label="Selecionar" />
                  <th className="py-2 pr-4 font-medium">Título</th>
                  <th className="py-2 pr-4 font-medium">Ferramenta</th>
                  <th className="py-2 pr-4 font-medium">Data de referência</th>
                  <th className="py-2 pr-4 font-medium">Salva em</th>
                  <th className="py-2 pr-4 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {analises.map((a) => {
                  const marcada = selecionadas.includes(a.id);
                  const motivo = !marcada ? motivoNaoMarcar(selAnalises, a) : null;
                  const editandoEsta = editando?.id === a.id;
                  return (
                    <tr key={a.id} className="border-b align-middle">
                      <td className="py-2">
                        <input
                          type="checkbox"
                          aria-label={`Selecionar ${a.titulo}`}
                          checked={marcada}
                          disabled={!!motivo}
                          title={motivo ?? undefined}
                          onChange={() => alternar(a)}
                          className="size-4"
                        />
                      </td>
                      <td className="py-2 pr-4">
                        {editandoEsta ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <Input
                              aria-label="Novo título"
                              value={editando.titulo}
                              maxLength={TITULO_MAX}
                              onChange={(e) => setEditando({ id: a.id, titulo: e.target.value })}
                              className="w-56"
                            />
                            <Button type="button" size="sm" onClick={salvarTitulo}>Salvar</Button>
                            <Button type="button" size="sm" variant="ghost" onClick={() => setEditando(null)}>Cancelar</Button>
                          </div>
                        ) : (
                          a.titulo
                        )}
                      </td>
                      <td className="py-2 pr-4">{FERRAMENTAS[a.ferramenta]}</td>
                      <td className="py-2 pr-4 tabular-nums">{dataDeReferencia(a.data_referencia)}</td>
                      <td className="py-2 pr-4 tabular-nums">{dataSalva(a.created_at)}</td>
                      <td className="py-2 pr-4">
                        <div className="flex flex-wrap gap-3">
                          <Link href={`${ROTA[a.ferramenta]}?reabrir=${a.id}`} className="text-primary underline">
                            Reabrir
                          </Link>
                          <button
                            type="button"
                            className="text-primary underline"
                            onClick={() => setEditando({ id: a.id, titulo: a.titulo })}
                          >
                            Renomear
                          </button>
                          <button type="button" className="text-negative underline" onClick={() => excluir(a)}>
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {mostraComparacao && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Comparação</h2>
            <Tabela {...montarComparacao(selAnalises)} />
            {selAnalises.map((a) =>
              leituraDe(a) ? (
                <p key={a.id} className="text-sm">
                  <span className="font-medium">{a.titulo}:</span> {leituraDe(a)}
                </p>
              ) : null,
            )}
          </section>
        )}

        {temMais && (
          <Button type="button" variant="outline" onClick={carregarMais}>
            Carregar mais
          </Button>
        )}
      </div>

      <Relatorio analises={selAnalises} />
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .area-relatorio, .area-relatorio * { visibility: visible; }
          .area-relatorio { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
}
