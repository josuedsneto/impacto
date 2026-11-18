"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { ATIVOS, nomeAtivo } from "@/lib/ativos";
import { descreverRegra, LIMITE_REGRAS, montarParams, TIPOS, type Evento, type Regra, type TipoAlerta } from "@/lib/alertas";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const COOLDOWNS = [24, 48, 72, 168, 720];
const ROTULO_COOLDOWN: Record<number, string> = {
  24: "1 dia", 48: "2 dias", 72: "3 dias", 168: "1 semana", 720: "30 dias",
};

export default function AlertasPage() {
  const [regras, setRegras] = useState<Regra[] | null>(null);
  const [eventos, setEventos] = useState<Evento[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [testes, setTestes] = useState<Record<string, string>>({});

  const [tipo, setTipo] = useState<TipoAlerta>("preco_cruza");
  const [ticker, setTicker] = useState("SB=F");
  const [nivel, setNivel] = useState("");
  const [direcao, setDirecao] = useState<"acima" | "abaixo">("acima");
  const [cooldown, setCooldown] = useState("24");

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const [r, e] = await Promise.all([
        apiFetch<Regra[]>("/api/alertas"),
        apiFetch<Evento[]>("/api/alertas/eventos"),
      ]);
      setRegras(r);
      setEventos(e);
    } catch (e) {
      setErro((e as Error).message);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function criar(ev: React.FormEvent) {
    ev.preventDefault();
    if (regras && regras.length >= LIMITE_REGRAS) {
      toast.error(`Limite de ${LIMITE_REGRAS} alertas por conta atingido. Apague um alerta para criar outro.`);
      return;
    }
    const valor = Number(nivel.replace(",", "."));
    if (!nivel || !Number.isFinite(valor) || valor <= 0) {
      toast.error(tipo === "preco_cruza" ? "Informe um nível de preço maior que zero." : "Informe um percentual maior que zero.");
      return;
    }
    setSalvando(true);
    try {
      await apiFetch("/api/alertas", {
        method: "POST",
        body: JSON.stringify({ tipo, ticker, params: montarParams(tipo, valor, direcao), cooldown_horas: Number(cooldown) }),
      });
      toast.success("Alerta criado. Ele é avaliado uma vez por dia, após o fechamento.");
      setNivel("");
      await carregar();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  async function alternar(r: Regra, ativo: boolean) {
    try {
      await apiFetch(`/api/alertas/${r.id}`, { method: "PATCH", body: JSON.stringify({ ativo }) });
      await carregar();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function apagar(r: Regra) {
    if (!window.confirm("Apagar este alerta? O histórico de disparos dele também será apagado.")) return;
    try {
      await apiFetch(`/api/alertas/${r.id}`, { method: "DELETE" });
      await carregar();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function testar(r: Regra) {
    try {
      const res = await apiFetch<{ mensagem: string }>(`/api/alertas/${r.id}/testar`, { method: "POST" });
      setTestes((t) => ({ ...t, [r.id]: res.mensagem }));
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const cheio = regras !== null && regras.length >= LIMITE_REGRAS;

  return (
    <div>
      <PageHeader
        titulo="Alertas"
        descricao="Avisos por e-mail quando um preço cruza um nível ou quando a volatilidade passa do limite. Cada alerta avisa na mudança, não a cada dia enquanto a condição continua."
      />

      {erro && <ErrorState mensagem={erro} onRetry={carregar} />}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader>
            <CardTitle>Meus alertas {regras && <span className="text-sm font-normal text-muted-foreground">({regras.length} de {LIMITE_REGRAS})</span>}</CardTitle>
          </CardHeader>
          <CardContent>
            {regras === null && !erro && <Skeleton className="h-32 w-full" />}
            {regras?.length === 0 && (
              <EmptyState mensagem="Você ainda não tem alertas. Crie um ao lado." />
            )}
            {regras && regras.length > 0 && (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ativo</TableHead>
                      <TableHead>Condição</TableHead>
                      <TableHead>Último disparo</TableHead>
                      <TableHead>Ativo</TableHead>
                      <TableHead><span className="sr-only">Ações</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {regras.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{nomeAtivo(r.ticker)}</TableCell>
                        <TableCell>
                          {descreverRegra(r)}
                          <span className="block text-xs text-muted-foreground">Intervalo mínimo entre avisos: {ROTULO_COOLDOWN[r.cooldown_horas] ?? `${r.cooldown_horas} h`}</span>
                          {testes[r.id] && <span className="mt-1 block text-xs text-muted-foreground">Teste agora: {testes[r.id]}</span>}
                        </TableCell>
                        <TableCell>{r.ultimo_disparo ? formatDate(r.ultimo_disparo) : "Nunca"}</TableCell>
                        <TableCell>
                          <input
                            type="checkbox"
                            role="switch"
                            aria-label={`Alerta ${nomeAtivo(r.ticker)} ativo`}
                            checked={r.ativo}
                            onChange={(ev) => alternar(r, ev.target.checked)}
                            className="size-4 accent-current"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" onClick={() => testar(r)}>Testar</Button>
                            <Button variant="ghost" size="sm" onClick={() => apagar(r)}>Apagar</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Novo alerta</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={criar} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Tipo</Label>
                <Select value={tipo} onValueChange={(v) => setTipo(v as TipoAlerta)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS.map((t) => <SelectItem key={t.valor} value={t.valor}>{t.rotulo}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Ativo</Label>
                <Select value={ticker} onValueChange={setTicker}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ATIVOS).map(([cod, a]) => <SelectItem key={cod} value={cod}>{a.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {tipo === "preco_cruza" && (
                <div className="flex flex-col gap-1.5">
                  <Label>Quando o preço ficar</Label>
                  <Select value={direcao} onValueChange={(v) => setDirecao(v as "acima" | "abaixo")}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="acima">Acima de</SelectItem>
                      <SelectItem value="abaixo">Abaixo de</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="nivel">{tipo === "preco_cruza" ? "Nível de preço" : "Percentual (%)"}</Label>
                <Input
                  id="nivel"
                  inputMode="decimal"
                  placeholder={tipo === "preco_cruza" ? "ex.: 16,50" : "ex.: 2,5"}
                  value={nivel}
                  onChange={(ev) => setNivel(ev.target.value)}
                />
                {tipo === "preco_cruza" && (
                  <span className="text-xs text-muted-foreground">Use a unidade do ativo (ex.: ¢/lb para o açúcar).</span>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Intervalo mínimo entre avisos</Label>
                <Select value={cooldown} onValueChange={setCooldown}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COOLDOWNS.map((h) => <SelectItem key={h} value={String(h)}>{ROTULO_COOLDOWN[h]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <Button type="submit" disabled={salvando || cheio}>
                {cheio ? "Limite de alertas atingido" : salvando ? "Salvando…" : "Criar alerta"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Histórico de disparos</CardTitle>
        </CardHeader>
        <CardContent>
          {eventos === null && !erro && <Skeleton className="h-24 w-full" />}
          {eventos?.length === 0 && <EmptyState mensagem="Nenhum alerta disparou ainda." />}
          {eventos && eventos.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Mensagem</TableHead>
                    <TableHead>E-mail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eventos.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>{formatDate(e.created_at)}</TableCell>
                      <TableCell>{e.mensagem}</TableCell>
                      <TableCell>
                        {e.enviado ? "Enviado" : <span className="text-negative">{e.erro ?? "Não enviado"}</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
