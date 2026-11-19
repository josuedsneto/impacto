"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Interruptor do briefing diário (BRF-01). RLS garante que só a linha do próprio usuário é lida e gravada. */
export function BriefingToggle() {
  const [ativo, setAtivo] = useState<boolean | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const supa = createClient();
    supa.auth.getUser().then(async ({ data }) => {
      if (!data.user) return setAtivo(false);
      const { data: linha } = await supa
        .from("preferencias_usuario")
        .select("briefing_email")
        .eq("user_id", data.user.id)
        .maybeSingle();
      setAtivo(Boolean(linha?.briefing_email));
    });
  }, []);

  async function alternar(novo: boolean) {
    setSalvando(true);
    const supa = createClient();
    const { data } = await supa.auth.getUser();
    if (!data.user) {
      toast.error("Entre de novo para alterar esta opção.");
      setSalvando(false);
      return;
    }
    const { error } = await supa
      .from("preferencias_usuario")
      .upsert({ user_id: data.user.id, briefing_email: novo, updated_at: new Date().toISOString() });
    if (error) {
      toast.error("Não foi possível salvar. Tente novamente.");
    } else {
      setAtivo(novo);
      toast.success(novo ? "Briefing diário ativado." : "Briefing diário desativado.");
    }
    setSalvando(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Briefing diário</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <label className="flex items-center justify-between gap-4">
          <span className="text-sm">Receber briefing diário por e-mail</span>
          <input
            type="checkbox"
            role="switch"
            aria-label="Receber briefing diário por e-mail"
            checked={ativo ?? false}
            disabled={ativo === null || salvando}
            onChange={(ev) => alternar(ev.target.checked)}
            className="size-4 accent-current"
          />
        </label>
        <p className="text-xs text-muted-foreground">
          Chega em dias úteis, entre 7h e 8h da manhã (horário de Brasília). Traz cotação do açúcar e do dólar, expectativas do Focus, as principais notícias e os alertas do último pregão.
        </p>
      </CardContent>
    </Card>
  );
}

interface StatusTelegram {
  disponivel: boolean;
  vinculado: boolean;
}

/** Vínculo do Telegram por código (ALE-09). `onMudou` avisa a tela para atualizar as opções de canal. */
export function TelegramVinculo({ onMudou }: { onMudou: (vinculado: boolean) => void }) {
  const [status, setStatus] = useState<StatusTelegram | null>(null);
  const [codigo, setCodigo] = useState<{ codigo: string; expira_em: string } | null>(null);

  useEffect(() => {
    apiFetch<StatusTelegram>("/api/telegram/status")
      .then((s) => {
        setStatus(s);
        onMudou(s.vinculado);
      })
      .catch(() => setStatus({ disponivel: false, vinculado: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function gerar() {
    try {
      setCodigo(await apiFetch<{ codigo: string; expira_em: string }>("/api/telegram/codigo", { method: "POST" }));
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function verificar() {
    try {
      const s = await apiFetch<StatusTelegram>("/api/telegram/status");
      setStatus(s);
      onMudou(s.vinculado);
      if (!s.vinculado) toast.message("Ainda não vinculado. Confira se enviou /start com o código.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function desvincular() {
    try {
      await apiFetch("/api/telegram/vinculo", { method: "DELETE" });
      setStatus((s) => (s ? { ...s, vinculado: false } : s));
      setCodigo(null);
      onMudou(false);
      toast.success("Telegram desvinculado.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Telegram</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {status === null && <span className="text-muted-foreground">Carregando…</span>}
        {status && !status.disponivel && (
          <span className="text-muted-foreground">Indisponível: o bot do Telegram ainda não está configurado no servidor.</span>
        )}
        {status?.disponivel && status.vinculado && (
          <>
            <span>Telegram vinculado. Alertas com canal Telegram chegam no chat do bot.</span>
            <Button variant="outline" size="sm" className="w-fit" onClick={desvincular}>Desvincular</Button>
          </>
        )}
        {status?.disponivel && !status.vinculado && (
          <>
            <span className="text-muted-foreground">
              Gere um código e envie <strong>/start CÓDIGO</strong> em conversa privada com o bot.
            </span>
            {codigo ? (
              <span>
                Seu código: <strong className="font-mono">{codigo.codigo}</strong>
                <span className="block text-xs text-muted-foreground">Válido até {formatDate(codigo.expira_em)}. Use uma vez.</span>
              </span>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={gerar}>
                {codigo ? "Gerar outro código" : "Gerar código"}
              </Button>
              {codigo && <Button variant="ghost" size="sm" onClick={verificar}>Já enviei o código</Button>}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
