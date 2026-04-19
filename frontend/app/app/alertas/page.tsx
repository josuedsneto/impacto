"use client";

import { useEffect, useState, useCallback } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

interface Alert {
  id: string;
  ticker: string;
  condition: "above" | "below";
  price: number;
  label: string | null;
  created_at: string;
}

async function getToken(): Promise<string> {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

export default function AlertasPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [ticker, setTicker] = useState("SB=F");
  const [condition, setCondition] = useState<"above" | "below">("above");
  const [price, setPrice] = useState("");
  const [label, setLabel] = useState("");

  const fetchAlerts = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${API}/api/alerts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setAlerts(data.alerts ?? []);
    } catch {
      toast.error("Erro ao carregar alertas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  async function handleCreate() {
    if (!ticker.trim() || !price) {
      toast.error("Preencha ticker e preço.");
      return;
    }
    setSubmitting(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API}/api/alerts`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: ticker.trim().toUpperCase(),
          condition,
          price: parseFloat(price),
          label: label.trim() || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.detail ?? "Erro ao criar alerta.");
        return;
      }
      toast.success("Alerta criado!");
      setPrice("");
      setLabel("");
      fetchAlerts();
    } catch {
      toast.error("Erro de conexão.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const token = await getToken();
      const res = await fetch(`${API}/api/alerts/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      toast.success("Alerta removido.");
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    } catch {
      toast.error("Erro ao remover alerta.");
    }
  }

  const conditionLabel = (c: "above" | "below") => (c === "above" ? "Acima de" : "Abaixo de");

  return (
    <div className="space-y-6 px-7 py-6">
      <h1 className="text-2xl font-semibold">Alertas de Preço</h1>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Novo Alerta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <Label>Ticker</Label>
              <Input
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                placeholder="SB=F"
                className="w-32"
              />
            </div>
            <div className="space-y-1">
              <Label>Condição</Label>
              <Select value={condition} onValueChange={(v) => setCondition(v as "above" | "below")}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="above">Acima de</SelectItem>
                  <SelectItem value="below">Abaixo de</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Preço</Label>
              <Input
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                className="w-32"
              />
            </div>
            <div className="space-y-1">
              <Label>Label (opcional)</Label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Ex: Meta safra"
                className="w-44"
              />
            </div>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting ? "Criando..." : "Criar Alerta"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardHeader>
          <CardTitle>Alertas Ativos</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-12 rounded bg-muted animate-pulse" />
              ))}
            </div>
          ) : alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum alerta ativo.</p>
          ) : (
            <div className="space-y-2">
              {alerts.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between px-4 py-3 rounded-lg border"
                >
                  <div className="flex items-center gap-4">
                    <span className="font-mono font-semibold text-sm">{a.ticker}</span>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{
                        background: a.condition === "above" ? "#dcfce7" : "#fee2e2",
                        color: a.condition === "above" ? "#166534" : "#991b1b",
                      }}
                    >
                      {conditionLabel(a.condition)} {a.price.toFixed(2)}
                    </span>
                    {a.label && (
                      <span className="text-xs text-muted-foreground">{a.label}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {new Date(a.created_at).toLocaleDateString("pt-BR")}
                    </span>
                    <button
                      onClick={() => handleDelete(a.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors text-lg leading-none"
                      aria-label="Remover alerta"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
