// Cartões da tela "Hoje" (painel-hoje). Cada um leva à ferramenta correspondente (PNL-14).
import Link from "next/link";
import type { ReactNode } from "react";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { formatBRL, formatDataHora, formatDate, formatPercent } from "@/lib/format";
import { leituraCambio, leituraPosicaoPolitica } from "@/lib/leitura";
import type { PainelAlertas, PainelAnalise, PainelFaixaDolar, PainelPosicao, Secao } from "@/lib/types/api";

export function Cartao({ titulo, href, rotulo, children }: { titulo: string; href: string; rotulo: string; children: ReactNode }) {
  return (
    <section aria-label={titulo} className="rounded-xl border border-border bg-card p-5 text-card-foreground">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[13px] font-bold">{titulo}</h2>
        <Link href={href} className="text-xs font-semibold text-primary hover:underline">{rotulo}</Link>
      </div>
      {children}
    </section>
  );
}

export function CartaoAlertas({ s }: { s: Secao<PainelAlertas> }) {
  if (!s.dados) return <Cartao titulo="Alertas" href="/app/alertas" rotulo="Abrir alertas"><ErrorState mensagem={s.motivo ?? ""} /></Cartao>;
  const { disparados, ativos, dia_referencia } = s.dados;
  return (
    <Cartao titulo="Alertas" href="/app/alertas" rotulo="Abrir alertas">
      {disparados.length > 0 ? (
        <ul className="space-y-2">
          {disparados.slice(0, 5).map((e) => (
            <li key={e.id} className="text-[13px]">
              {e.mensagem} <span className="text-xs text-muted-foreground">{formatDataHora(e.created_at)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          mensagem="Nenhum alerta disparou no último dia útil."
          acao={ativos === 0 ? <Link href="/app/alertas" className="font-semibold text-primary hover:underline">Criar alerta</Link> : undefined}
        />
      )}
      <p className="mt-3 text-[11px] text-muted-foreground">Desde {formatDate(dia_referencia)}</p>
    </Cartao>
  );
}

export function CartaoPosicoes({ s }: { s: Secao<PainelPosicao[]> }) {
  if (!s.dados) return <Cartao titulo="Posições da safra" href="/app/posicoes" rotulo="Abrir posições"><ErrorState mensagem={s.motivo ?? ""} /></Cartao>;
  if (s.dados.length === 0) {
    return (
      <Cartao titulo="Posições da safra" href="/app/posicoes" rotulo="Abrir posições">
        <EmptyState mensagem="Sua conta não está associada a nenhuma usina. Fale com o administrador." />
      </Cartao>
    );
  }
  return (
    <Cartao titulo="Posições da safra" href="/app/posicoes" rotulo="Abrir posições">
      {s.dados.map((u) => (
        <div key={u.usina_id} className="border-b border-border py-3 last:border-0">
          <p className="text-[13px] font-semibold">{u.usina_nome ?? "Usina"}</p>
          {u.motivo ? (
            <ErrorState mensagem={u.motivo} />
          ) : (
            <>
              <p className="text-[13px]">
                {leituraPosicaoPolitica({ status: u.status, pct: u.pct_fixado, minimo: u.minimo_pct, maximo: u.maximo_pct, safra: u.safra })}
              </p>
              {u.mtm_total_rs !== null && (
                <p className="text-xs text-muted-foreground">Resultado a mercado: {formatBRL(u.mtm_total_rs)}</p>
              )}
              {u.aviso && <p className="text-xs text-muted-foreground">{u.aviso}</p>}
              {u.n_posicoes === 0 && (
                <Link href="/app/posicoes" className="mt-1 inline-block text-xs font-semibold text-primary hover:underline">Cadastrar posições</Link>
              )}
            </>
          )}
        </div>
      ))}
    </Cartao>
  );
}

export function CartaoFaixaDolar({ s }: { s: Secao<PainelFaixaDolar> }) {
  if (!s.dados) return <Cartao titulo="Dólar em 1 mês" href="/app/cambio" rotulo="Abrir câmbio"><ErrorState mensagem={s.motivo ?? ""} /></Cartao>;
  const d = s.dados;
  return (
    <Cartao titulo="Dólar em 1 mês" href="/app/cambio" rotulo="Abrir câmbio">
      <p className="text-[13px]">{leituraCambio({ horizonte: d.horizonte, spot: d.spot, p5: d.p5, p95: d.p95, forward: null })}</p>
    </Cartao>
  );
}

export function CartaoAnalises({ s }: { s: Secao<PainelAnalise[]> }) {
  if (!s.dados) return <Cartao titulo="Últimas análises" href="/app/analises" rotulo="Abrir análises"><ErrorState mensagem={s.motivo ?? ""} /></Cartao>;
  if (s.dados.length === 0) {
    return <Cartao titulo="Últimas análises" href="/app/analises" rotulo="Abrir análises"><EmptyState mensagem="Nenhuma análise salva ainda." /></Cartao>;
  }
  return (
    <Cartao titulo="Últimas análises" href="/app/analises" rotulo="Abrir análises">
      <ul className="space-y-2">
        {s.dados.map((a) => (
          <li key={a.id} className="text-[13px]">
            {a.titulo} <span className="text-xs text-muted-foreground">{a.ferramenta} · {formatDataHora(a.created_at)}</span>
          </li>
        ))}
      </ul>
    </Cartao>
  );
}

export function RodapeMercado({ semana }: { semana: number | null }) {
  return (
    <p className="mt-2 text-xs text-muted-foreground">
      Na semana: {semana === null ? "sem dados" : formatPercent(semana)} · <Link href="/app/mercado" className="font-semibold text-primary hover:underline">Abrir mercado</Link>
    </p>
  );
}
