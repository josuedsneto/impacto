"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { ATIVOS, nomeAtivo } from "@/lib/ativos";
import { descreverRegra, INDICADORES, LIMITE_REGRAS, montarParams, TIPOS, type Evento, type IndicadorSinal, type Regra, type SentidoSinal, type TipoAlerta } from "@/lib/alertas";
import { BriefingToggle, TelegramVinculo } from "@/components/alertas/CanaisAlerta";
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
  const [horizonte, setHorizonte] = useState("5");
  const [probPct, setProbPct] = useState("");
  const [margemPp, setMargemPp] = useState("5");
  const [margemPct, setMargemPct] = useState("0");
  const [indicador, setIndicador] = useState<IndicadorSinal>("rsi");
  const [sentido, setSentido] = useState<SentidoSinal>("compra");
  const [usinas, setUsinas] = useState<{ id: string; nome: string }[]>([]);
  const [usinaId, setUsinaId] = useState("");
  const [safra, setSafra] = useState("2026/27");
  const [canal, setCanal] = useState<"email" | "telegram">("email");
  const [telegramVinculado, setTelegramVinculado] = useState(false);

  useEffect(() => {
    apiFetch<{ usinas: { id: string; nome: string }[] }>("/api/atr/usinas")
      .then((d) => {
        setUsinas(d.usinas);
        setUsinaId((atual) => atual || d.usinas[0]?.id || "");
      })
      .catch(() => setUsinas([]));
  }, []);

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
    const prob = Number(probPct.replace(",", "."));
    const h = Number(horizonte);
    if (tipo === "posicao_limite") {
      if (!usinaId || !/^\d{4}\/\d{2}$/.test(safra)) {
        toast.error("Escolha a usina e informe a safra no formato 2026/27.");
        return;
      }
    } else if (tipo !== "sinal_tecnico" && (!nivel || !Number.isFinite(valor) || valor <= 0)) {
      toast.error(tipo === "preco_cruza" || tipo === "prob_cruzar" ? "Informe um nível de preço maior que zero." : "Informe um percentual maior que zero.");
      return;
    }
    if (tipo === "prob_cruzar" && (!Number.isInteger(h) || h < 1 || h > 252 || !(prob > 0 && prob <= 100))) {
      toast.error("Use de 1 a 252 dias úteis e uma probabilidade entre 0 e 100%.");
      return;
    }
    const mPp = Number(margemPp.replace(",", "."));
    const mPct = Number(margemPct.replace(",", "."));
    if (tipo === "prob_cruzar" && !(mPp >= 0 && mPp <= 20)) {
      toast.error("A margem para rearmar deve estar entre 0 e 20 pontos percentuais.");
      return;
    }
    if (tipo === "prob_cruzar" && mPp / 100 >= prob / 100) {
      toast.error("A margem para rearmar tem de ser menor que a probabilidade.");
      return;
    }
    if (tipo === "preco_cruza" && !(mPct >= 0 && mPct <= 20)) {
      toast.error("A margem para rearmar deve estar entre 0% e 20%.");
      return;
    }
    setSalvando(true);
    try {
      await apiFetch("/api/alertas", {
        method: "POST",
        body: JSON.stringify({
          tipo,
          ticker: tipo === "posicao_limite" ? "POSICAO" : ticker,
          params: montarParams(tipo, valor, direcao, {
            horizonte: h, probPct: prob, margemPp: mPp, margemPct: mPct, indicador, sentido, usinaId, safra,
          }),
          canal,
          cooldown_horas: Number(cooldown),
        }),
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
        descricao="Avisos por e-mail quando um preço cruza um nível, quando a volatilidade passa do limite ou quando um indicador técnico dá sinal. Cada alerta avisa na mudança, não a cada dia enquanto a condição continua."
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

              {tipo !== "posicao_limite" && (
                <div className="flex flex-col gap-1.5">
                  <Label>Ativo</Label>
                  <Select value={ticker} onValueChange={setTicker}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(ATIVOS).map(([cod, a]) => <SelectItem key={cod} value={cod}>{a.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {(tipo === "preco_cruza" || tipo === "prob_cruzar") && (
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

              {tipo === "sinal_tecnico" ? (
                <>
                  <div className="flex flex-col gap-1.5">
                    <Label>Indicador</Label>
                    <Select value={indicador} onValueChange={(v) => setIndicador(v as IndicadorSinal)}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {INDICADORES.map((i) => <SelectItem key={i.valor} value={i.valor}>{i.rotulo}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Sentido</Label>
                    <Select value={sentido} onValueChange={(v) => setSentido(v as SentidoSinal)}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="compra">Compra</SelectItem>
                        <SelectItem value="venda">Venda</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-xs text-muted-foreground">Sinal técnico, não uma recomendação. Avaliado no último fechamento, após o pregão.</span>
                  </div>
                </>
              ) : tipo === "posicao_limite" ? (
                <>
                  <div className="flex flex-col gap-1.5">
                    <Label>Usina</Label>
                    <Select value={usinaId} onValueChange={setUsinaId}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Escolha a usina" /></SelectTrigger>
                      <SelectContent>
                        {usinas.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="safra">Safra</Label>
                    <Input id="safra" placeholder="ex.: 2026/27" value={safra} onChange={(ev) => setSafra(ev.target.value)} />
                    <span className="text-xs text-muted-foreground">Avisa quando o % fixado sai da faixa da política dessa safra.</span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="nivel">
                    {tipo === "preco_cruza" || tipo === "prob_cruzar" ? "Nível de preço" : "Percentual (%)"}
                  </Label>
                  <Input
                    id="nivel"
                    inputMode="decimal"
                    placeholder={tipo === "preco_cruza" || tipo === "prob_cruzar" ? "ex.: 16,50" : "ex.: 2,5"}
                    value={nivel}
                    onChange={(ev) => setNivel(ev.target.value)}
                  />
                  {tipo === "preco_cruza" && (
                    <span className="text-xs text-muted-foreground">Use a unidade do ativo (ex.: ¢/lb para o açúcar).</span>
                  )}
                </div>
              )}

              {tipo === "preco_cruza" && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="margem-preco">Margem para rearmar (%)</Label>
                  <Input id="margem-preco" inputMode="decimal" value={margemPct} onChange={(ev) => setMargemPct(ev.target.value)} />
                  <span className="text-xs text-muted-foreground">Depois de avisar, o alerta só volta a valer quando o preço recuar essa porcentagem além do nível. Use 0 para rearmar assim que sair do lado do nível.</span>
                </div>
              )}

              {tipo === "prob_cruzar" && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="horizonte">Prazo (dias úteis)</Label>
                    <Input id="horizonte" inputMode="numeric" value={horizonte} onChange={(ev) => setHorizonte(ev.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="probabilidade">Avisar quando a chance passar de (%)</Label>
                    <Input id="probabilidade" inputMode="decimal" placeholder="ex.: 30" value={probPct} onChange={(ev) => setProbPct(ev.target.value)} />
                    <span className="text-xs text-muted-foreground">Estimativa no fechamento diário. Não é previsão.</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="margem-prob">Margem para rearmar (pontos percentuais)</Label>
                    <Input id="margem-prob" inputMode="decimal" value={margemPp} onChange={(ev) => setMargemPp(ev.target.value)} />
                    <span className="text-xs text-muted-foreground">Depois de avisar, o alerta só volta a valer quando a chance cair essa quantidade de pontos abaixo do limite.</span>
                  </div>
                </>
              )}

              <div className="flex flex-col gap-1.5">
                <Label>Canal</Label>
                <Select value={canal} onValueChange={(v) => setCanal(v as "email" | "telegram")}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="telegram" disabled={!telegramVinculado}>
                      Telegram{telegramVinculado ? "" : " (vincule abaixo)"}
                    </SelectItem>
                  </SelectContent>
                </Select>
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

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <BriefingToggle />
        <TelegramVinculo onMudou={setTelegramVinculado} />
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
                    <TableHead>Envio</TableHead>
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
