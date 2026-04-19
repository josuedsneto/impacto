# Feature Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 8 missing app pages (focus, pricing redirect, var, breakeven, arima, stress, news, volatility) with corresponding FastAPI backend endpoints, plus admin config system.

**Architecture:** Each feature is a FastAPI endpoint in `backend/main.py` + a Next.js page in `frontend/app/app/<feature>/page.tsx`. Server Components for read-only pages, Client Components for interactive forms. All endpoints require JWT auth via `Depends(get_current_user)`. Charts use Recharts.

**Tech Stack:** FastAPI, numpy, scipy (already installed), statsmodels (new), feedparser (new), Next.js App Router, Recharts, shadcn/ui

---

### Task 1: Install New Python Dependencies

**Files:**
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Add new deps to requirements.txt**

Add to `backend/requirements.txt`:
```
statsmodels==0.14.4
feedparser==6.0.11
```

- [ ] **Step 2: Install on VM**

```bash
ssh -i ssh-key-2026-03-23.key ubuntu@147.15.88.123
pip3 install statsmodels==0.14.4 feedparser==6.0.11
```

Expected: Both install without errors.

- [ ] **Step 3: Commit**

```bash
git add backend/requirements.txt
git commit -m "chore(backend): add statsmodels and feedparser dependencies"
```

---

### Task 2: Admin Config — Supabase Table + Backend Endpoints

**Files:**
- Modify: `backend/main.py` (add 2 endpoints at end of file)

- [ ] **Step 1: Create admin_config table in Supabase**

Run this SQL in Supabase Dashboard → SQL Editor:
```sql
create table if not exists admin_config (
  key text primary key,
  value text not null,
  description text,
  updated_at date
);

insert into admin_config (key, value, description, updated_at)
values ('breakeven_fator_conversao', '1.12045', 'Fator de conversão cents/lb → R$/saca (0.022046 × 50.802)', current_date)
on conflict (key) do nothing;
```

- [ ] **Step 2: Add backend endpoints to main.py**

Append to `backend/main.py`:
```python
# ── Admin Config ───────────────────────────────────────────────────────────────

class AdminConfigUpdateRequest(BaseModel):
    value: str
    description: str | None = None


@app.get("/api/admin/config")
async def get_admin_config(user: Annotated[dict, Depends(require_admin)]):
    """Return all admin config rows."""
    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    result = client.table("admin_config").select("*").order("key").execute()
    return {"config": result.data}


@app.put("/api/admin/config/{key}")
async def update_admin_config(
    key: str,
    body: AdminConfigUpdateRequest,
    user: Annotated[dict, Depends(require_admin)],
):
    """Upsert a config key."""
    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    client.table("admin_config").upsert(
        {
            "key": key,
            "value": body.value,
            "description": body.description,
            "updated_at": date_type.today().isoformat(),
        },
        on_conflict="key",
    ).execute()
    return {"key": key, "value": body.value, "updated": True}
```

- [ ] **Step 3: Restart uvicorn on VM**

```bash
pkill -f uvicorn
cd ~/impacto-v2/backend
source ~/.bashrc
nohup python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 > ~/uvicorn.log 2>&1 &
sleep 2
curl http://localhost:8000/api/health
```

Expected: `{"status":"ok"}`

- [ ] **Step 4: Commit**

```bash
git add backend/main.py
git commit -m "feat(backend): add admin_config GET and PUT endpoints"
```

---

### Task 3: /app/pricing Redirect + /app/focus Page

**Files:**
- Create: `frontend/app/app/pricing/page.tsx`
- Create: `frontend/app/app/focus/page.tsx`

- [ ] **Step 1: Create pricing redirect**

`frontend/app/app/pricing/page.tsx`:
```tsx
import { redirect } from "next/navigation";

export default function PricingPage() {
  redirect("/app/options");
}
```

- [ ] **Step 2: Create focus page**

`frontend/app/app/focus/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

async function fetchFocus(token: string) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/focus`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function Delta({ value }: { value: number | null }) {
  if (value === null || value === undefined) return null;
  const color = value > 0 ? "#dc2626" : value < 0 ? "#16a34a" : "#6b7280";
  const sign = value > 0 ? "+" : "";
  return (
    <span style={{ fontSize: 12, color, marginLeft: 6 }}>
      {sign}{value.toFixed(4)}
    </span>
  );
}

function MetricCard({
  label,
  value,
  delta,
  unit,
}: {
  label: string;
  value: number | null;
  delta: number | null;
  unit: string;
}) {
  return (
    <div
      className="rounded-[10px] p-5"
      style={{ background: "#fff", border: "1px solid #e5e7eb" }}
    >
      <p style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase" }}>
        {label}
      </p>
      <div className="flex items-baseline gap-1 mt-2">
        <span style={{ fontSize: 28, fontWeight: 700, color: "#111827", fontVariantNumeric: "tabular-nums" }}>
          {value !== null ? value.toFixed(2) : "—"}
        </span>
        <span style={{ fontSize: 13, color: "#6b7280" }}>{unit}</span>
        <Delta value={delta} />
      </div>
    </div>
  );
}

export default async function FocusPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? "";
  const data = await fetchFocus(token);

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "#f4f6f9" }}>
      <div
        className="flex items-center px-7"
        style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", paddingTop: 18, paddingBottom: 18 }}
      >
        <div>
          <h1 className="font-bold" style={{ fontSize: 20, color: "#111827" }}>Focus BCB</h1>
          <p style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>
            Expectativas de mercado · Ano {data?.ano_referencia ?? new Date().getFullYear()}
          </p>
        </div>
      </div>

      <div className="px-7 py-6">
        {data ? (
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
            <MetricCard label="IPCA" value={data.ipca?.value} delta={data.ipca?.delta} unit="%" />
            <MetricCard label="Câmbio" value={data.cambio?.value} delta={data.cambio?.delta} unit="R$" />
            <MetricCard label="Selic" value={data.selic?.value} delta={data.selic?.delta} unit="%" />
            <MetricCard label="PIB Total" value={data.pib?.value} delta={data.pib?.delta} unit="%" />
          </div>
        ) : (
          <p style={{ color: "#6b7280", fontSize: 14 }}>Não foi possível carregar os dados do Focus BCB.</p>
        )}
        <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 16 }}>
          Fonte: Banco Central do Brasil — Relatório Focus. Atualizado a cada hora.
          Delta = variação em relação à leitura de ~7 dias atrás.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/app/app/pricing/page.tsx frontend/app/app/focus/page.tsx
git commit -m "feat(frontend): add pricing redirect and focus BCB page"
```

---

### Task 4: VaR Backend Endpoint

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Add VaR endpoint to main.py**

Append to `backend/main.py`:
```python
# ── VaR ────────────────────────────────────────────────────────────────────────

@app.get("/api/var/{ticker}")
async def get_var(
    ticker: str,
    start: date_type,
    end: date_type,
    confidence: float = 0.95,
    user: Annotated[dict, Depends(get_current_user)],
):
    """VaR histórico e paramétrico para um ticker."""
    from scipy.stats import norm

    rows = get_prices(ticker.upper(), start, end)
    if len(rows) < 20:
        raise HTTPException(
            status_code=400,
            detail=f"Dados insuficientes para '{ticker}' (mínimo 20 dias).",
        )

    closes = np.array([r["close"] for r in rows if r["close"] is not None], dtype=float)
    returns = np.diff(np.log(closes)).tolist()
    mean = float(np.mean(returns))
    std = float(np.std(returns, ddof=1))

    # Historical VaR: percentile of realized returns (negative = loss)
    hist_var = float(np.percentile(returns, (1 - confidence) * 100))

    # Parametric VaR: mean + z * std
    z = float(norm.ppf(1 - confidence))
    param_var = float(mean + z * std)

    return {
        "ticker": ticker.upper(),
        "historical_var": hist_var,
        "parametric_var": param_var,
        "returns": returns,
        "mean": mean,
        "std": std,
        "n_days": len(returns),
        "confidence": confidence,
    }
```

- [ ] **Step 2: Restart uvicorn and test**

```bash
pkill -f uvicorn
cd ~/impacto-v2/backend && source ~/.bashrc
nohup python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 > ~/uvicorn.log 2>&1 &
sleep 2
curl "http://localhost:8000/api/var/SB%3DF?start=2024-01-01&end=2024-12-31" \
  -H "Authorization: Bearer $TOKEN"
```

Expected: JSON with `historical_var`, `parametric_var`, `returns` array.

- [ ] **Step 3: Commit**

```bash
git add backend/main.py
git commit -m "feat(backend): add VaR historical and parametric endpoint"
```

---

### Task 5: VaR Frontend Page

**Files:**
- Create: `frontend/app/app/var/page.tsx`

- [ ] **Step 1: Create VaR page**

`frontend/app/app/var/page.tsx`:
```tsx
"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

async function getAccessToken(): Promise<string | null> {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

interface VarResult {
  ticker: string;
  historical_var: number;
  parametric_var: number;
  returns: number[];
  mean: number;
  std: number;
  n_days: number;
  confidence: number;
}

function buildHistogram(returns: number[], bins = 40) {
  if (!returns.length) return [];
  const min = Math.min(...returns);
  const max = Math.max(...returns);
  const width = (max - min) / bins;
  const buckets: { range: string; count: number; x: number }[] = [];
  for (let i = 0; i < bins; i++) {
    const lo = min + i * width;
    const hi = lo + width;
    buckets.push({
      range: `${(lo * 100).toFixed(2)}%`,
      x: (lo + hi) / 2,
      count: returns.filter((r) => r >= lo && r < hi).length,
    });
  }
  return buckets;
}

export default function VaRPage() {
  const [ticker, setTicker] = useState("SB=F");
  const [start, setStart] = useState("2023-01-01");
  const [end, setEnd] = useState(new Date().toISOString().slice(0, 10));
  const [confidence, setConfidence] = useState("0.95");
  const [result, setResult] = useState<VarResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const res = await fetch(
        `${API}/api/var/${encodeURIComponent(ticker)}?start=${start}&end=${end}&confidence=${confidence}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail ?? "Erro ao calcular VaR");
      }
      setResult(await res.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const histogram = result ? buildHistogram(result.returns) : [];
  const confPct = result ? (result.confidence * 100).toFixed(0) : "95";

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "#f4f6f9" }}>
      <div
        className="px-7"
        style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", paddingTop: 18, paddingBottom: 18 }}
      >
        <h1 className="font-bold" style={{ fontSize: 20, color: "#111827" }}>Value at Risk</h1>
        <p style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>
          VaR histórico e paramétrico com distribuição de retornos
        </p>
      </div>

      <div className="px-7 py-6 space-y-6">
        <Card style={{ background: "#fff", border: "1px solid #e5e7eb" }}>
          <CardContent className="pt-5">
            <form onSubmit={handleSubmit} className="flex flex-wrap gap-4 items-end">
              <div className="space-y-1.5">
                <Label>Ticker</Label>
                <Input value={ticker} onChange={(e) => setTicker(e.target.value)} style={{ width: 110 }} />
              </div>
              <div className="space-y-1.5">
                <Label>Início</Label>
                <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} style={{ width: 140 }} />
              </div>
              <div className="space-y-1.5">
                <Label>Fim</Label>
                <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} style={{ width: 140 }} />
              </div>
              <div className="space-y-1.5">
                <Label>Confiança</Label>
                <Select value={confidence} onValueChange={setConfidence}>
                  <SelectTrigger style={{ width: 100 }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0.95">95%</SelectItem>
                    <SelectItem value="0.99">99%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? "Calculando..." : "Calcular VaR"}
              </Button>
            </form>
            {error && <p style={{ color: "#dc2626", fontSize: 13, marginTop: 12 }}>{error}</p>}
          </CardContent>
        </Card>

        {result && (
          <>
            <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
              {[
                { label: `VaR Histórico ${confPct}%`, value: `${(result.historical_var * 100).toFixed(3)}%`, color: "#dc2626" },
                { label: `VaR Paramétrico ${confPct}%`, value: `${(result.parametric_var * 100).toFixed(3)}%`, color: "#2563eb" },
                { label: "Retorno médio diário", value: `${(result.mean * 100).toFixed(4)}%`, color: "#111827" },
                { label: "Volatilidade diária", value: `${(result.std * 100).toFixed(4)}%`, color: "#111827" },
              ].map(({ label, value, color }) => (
                <Card key={label} style={{ background: "#fff", border: "1px solid #e5e7eb" }}>
                  <CardContent className="pt-4 pb-4">
                    <p style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      {label}
                    </p>
                    <p style={{ fontSize: 24, fontWeight: 700, color, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
                      {value}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card style={{ background: "#fff", border: "1px solid #e5e7eb" }}>
              <CardHeader>
                <CardTitle style={{ fontSize: 14, color: "#374151" }}>
                  Distribuição de retornos diários — {result.n_days} dias
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={histogram} margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="range" tick={{ fontSize: 10 }} interval={4} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => [v, "Frequência"]} />
                    <Legend />
                    <Bar dataKey="count" name="Frequência" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                    <ReferenceLine
                      x={histogram.find((b) => b.x <= result.historical_var)?.range}
                      stroke="#dc2626"
                      strokeDasharray="4 2"
                      label={{ value: `VaR Hist.`, position: "top", fontSize: 10, fill: "#dc2626" }}
                    />
                    <ReferenceLine
                      x={histogram.find((b) => b.x <= result.parametric_var)?.range}
                      stroke="#2563eb"
                      strokeDasharray="4 2"
                      label={{ value: `VaR Param.`, position: "top", fontSize: 10, fill: "#2563eb" }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/app/app/var/page.tsx
git commit -m "feat(frontend): add VaR page with histogram and comparison table"
```

---

### Task 6: Breakeven Backend Endpoint

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Add breakeven endpoint to main.py**

Append to `backend/main.py`:
```python
# ── Breakeven ──────────────────────────────────────────────────────────────────

class BreakevenRequest(BaseModel):
    mode: Literal["cambio_minimo", "custo_maximo", "grid"]
    custo_reais: float | None = None
    preco_cents: float | None = None
    cambio: float | None = None
    cambio_min: float | None = None
    cambio_max: float | None = None
    preco_min: float | None = None
    preco_max: float | None = None


@app.post("/api/breakeven")
async def breakeven(
    body: BreakevenRequest,
    user: Annotated[dict, Depends(get_current_user)],
):
    """Cálculo de breakeven com fator de conversão configurável via admin_config."""
    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    cfg = (
        client.table("admin_config")
        .select("value")
        .eq("key", "breakeven_fator_conversao")
        .maybe_single()
        .execute()
    )
    fator = float((cfg.data or {}).get("value", "1.12045"))

    if body.mode == "cambio_minimo":
        if body.custo_reais is None or body.preco_cents is None:
            raise HTTPException(status_code=400, detail="custo_reais e preco_cents obrigatórios")
        if body.preco_cents == 0:
            raise HTTPException(status_code=400, detail="preco_cents não pode ser zero")
        cambio_necessario = body.custo_reais / (body.preco_cents * fator)
        return {"mode": "cambio_minimo", "cambio_minimo": round(cambio_necessario, 4), "fator": fator}

    elif body.mode == "custo_maximo":
        if body.preco_cents is None or body.cambio is None:
            raise HTTPException(status_code=400, detail="preco_cents e cambio obrigatórios")
        custo_max = body.preco_cents * fator * body.cambio
        return {"mode": "custo_maximo", "custo_maximo": round(custo_max, 2), "fator": fator}

    else:  # grid
        required = [body.cambio_min, body.cambio_max, body.preco_min, body.preco_max, body.custo_reais]
        if any(v is None for v in required):
            raise HTTPException(
                status_code=400,
                detail="cambio_min, cambio_max, preco_min, preco_max, custo_reais obrigatórios",
            )
        cambios = np.linspace(body.cambio_min, body.cambio_max, 10).tolist()
        precos = np.linspace(body.preco_min, body.preco_max, 10).tolist()
        grid = []
        for c in cambios:
            row = []
            for p in precos:
                receita = p * fator * c
                row.append(round(receita - body.custo_reais, 2))
            grid.append(row)
        return {
            "mode": "grid",
            "cambios": [round(c, 4) for c in cambios],
            "precos": [round(p, 2) for p in precos],
            "grid": grid,
            "fator": fator,
        }
```

- [ ] **Step 2: Restart uvicorn and test**

```bash
pkill -f uvicorn
cd ~/impacto-v2/backend && source ~/.bashrc
nohup python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 > ~/uvicorn.log 2>&1 &
sleep 2
curl -X POST "http://localhost:8000/api/breakeven" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"mode":"cambio_minimo","custo_reais":120.0,"preco_cents":22.5}'
```

Expected: `{"mode":"cambio_minimo","cambio_minimo":4.76...,"fator":1.12045}`

- [ ] **Step 3: Commit**

```bash
git add backend/main.py
git commit -m "feat(backend): add breakeven endpoint with admin_config conversion factor"
```

---

### Task 7: Breakeven Frontend Page

**Files:**
- Create: `frontend/app/app/breakeven/page.tsx`

- [ ] **Step 1: Create breakeven page**

`frontend/app/app/breakeven/page.tsx`:
```tsx
"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

async function getAccessToken(): Promise<string | null> {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function postBreakeven(body: object): Promise<any> {
  const token = await getAccessToken();
  const res = await fetch(`${API}/api/breakeven`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail ?? "Erro");
  }
  return res.json();
}

export default function BreakevenPage() {
  // Câmbio Mínimo
  const [custoReais, setCustoReais] = useState("120");
  const [precoCents, setPrecoCents] = useState("22.5");
  const [cambioMin, setCambioMin] = useState<number | null>(null);

  // Custo Máximo
  const [precoCentsMax, setPrecoCentsMax] = useState("22.5");
  const [cambioVal, setCambioVal] = useState("5.20");
  const [custoMax, setCustoMax] = useState<number | null>(null);

  // Grid
  const [gridCustoReais, setGridCustoReais] = useState("120");
  const [cambioMinG, setCambioMinG] = useState("4.50");
  const [cambioMaxG, setCambioMaxG] = useState("6.00");
  const [precoMinG, setPrecoMinG] = useState("18");
  const [precoMaxG, setPrecoMaxG] = useState("26");
  const [gridResult, setGridResult] = useState<any | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCambioMinimo(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const r = await postBreakeven({ mode: "cambio_minimo", custo_reais: +custoReais, preco_cents: +precoCents });
      setCambioMin(r.cambio_minimo);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function handleCustoMaximo(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const r = await postBreakeven({ mode: "custo_maximo", preco_cents: +precoCentsMax, cambio: +cambioVal });
      setCustoMax(r.custo_maximo);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function handleGrid(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const r = await postBreakeven({
        mode: "grid",
        custo_reais: +gridCustoReais,
        cambio_min: +cambioMinG, cambio_max: +cambioMaxG,
        preco_min: +precoMinG, preco_max: +precoMaxG,
      });
      setGridResult(r);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "#f4f6f9" }}>
      <div
        className="px-7"
        style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", paddingTop: 18, paddingBottom: 18 }}
      >
        <h1 className="font-bold" style={{ fontSize: 20, color: "#111827" }}>Breakeven</h1>
        <p style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>
          Ponto de equilíbrio por cenário de câmbio e preço do açúcar
        </p>
      </div>

      <div className="px-7 py-6">
        {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}

        <Tabs defaultValue="cambio_minimo">
          <TabsList>
            <TabsTrigger value="cambio_minimo">Câmbio Mínimo</TabsTrigger>
            <TabsTrigger value="custo_maximo">Custo Máximo</TabsTrigger>
            <TabsTrigger value="grid">Grid de Cenários</TabsTrigger>
          </TabsList>

          <TabsContent value="cambio_minimo" className="mt-4">
            <Card style={{ background: "#fff", border: "1px solid #e5e7eb" }}>
              <CardContent className="pt-5">
                <form onSubmit={handleCambioMinimo} className="flex flex-wrap gap-4 items-end">
                  <div className="space-y-1.5">
                    <Label>Custo de produção (R$/saca)</Label>
                    <Input value={custoReais} onChange={e => setCustoReais(e.target.value)} style={{ width: 160 }} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Preço do açúcar (cents/lb)</Label>
                    <Input value={precoCents} onChange={e => setPrecoCents(e.target.value)} style={{ width: 160 }} />
                  </div>
                  <Button type="submit" disabled={loading}>Calcular</Button>
                </form>
                {cambioMin !== null && (
                  <div className="mt-6 p-5 rounded-[10px]" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                    <p style={{ fontSize: 13, color: "#6b7280" }}>Câmbio mínimo necessário para cobrir o custo:</p>
                    <p style={{ fontSize: 36, fontWeight: 700, color: "#15803d", fontVariantNumeric: "tabular-nums" }}>
                      R$ {cambioMin.toFixed(4)}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="custo_maximo" className="mt-4">
            <Card style={{ background: "#fff", border: "1px solid #e5e7eb" }}>
              <CardContent className="pt-5">
                <form onSubmit={handleCustoMaximo} className="flex flex-wrap gap-4 items-end">
                  <div className="space-y-1.5">
                    <Label>Preço do açúcar (cents/lb)</Label>
                    <Input value={precoCentsMax} onChange={e => setPrecoCentsMax(e.target.value)} style={{ width: 160 }} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Câmbio (R$/USD)</Label>
                    <Input value={cambioVal} onChange={e => setCambioVal(e.target.value)} style={{ width: 140 }} />
                  </div>
                  <Button type="submit" disabled={loading}>Calcular</Button>
                </form>
                {custoMax !== null && (
                  <div className="mt-6 p-5 rounded-[10px]" style={{ background: "#eff6ff", border: "1px solid #bfdbfe" }}>
                    <p style={{ fontSize: 13, color: "#6b7280" }}>Custo máximo suportável (R$/saca):</p>
                    <p style={{ fontSize: 36, fontWeight: 700, color: "#1d4ed8", fontVariantNumeric: "tabular-nums" }}>
                      R$ {custoMax.toFixed(2)}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="grid" className="mt-4">
            <Card style={{ background: "#fff", border: "1px solid #e5e7eb" }}>
              <CardContent className="pt-5 space-y-4">
                <form onSubmit={handleGrid} className="flex flex-wrap gap-4 items-end">
                  <div className="space-y-1.5">
                    <Label>Custo (R$/saca)</Label>
                    <Input value={gridCustoReais} onChange={e => setGridCustoReais(e.target.value)} style={{ width: 120 }} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Câmbio mín</Label>
                    <Input value={cambioMinG} onChange={e => setCambioMinG(e.target.value)} style={{ width: 100 }} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Câmbio máx</Label>
                    <Input value={cambioMaxG} onChange={e => setCambioMaxG(e.target.value)} style={{ width: 100 }} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Preço mín (¢/lb)</Label>
                    <Input value={precoMinG} onChange={e => setPrecoMinG(e.target.value)} style={{ width: 100 }} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Preço máx (¢/lb)</Label>
                    <Input value={precoMaxG} onChange={e => setPrecoMaxG(e.target.value)} style={{ width: 100 }} />
                  </div>
                  <Button type="submit" disabled={loading}>Gerar Grid</Button>
                </form>

                {gridResult && (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ borderCollapse: "collapse", fontSize: 12, width: "100%" }}>
                      <thead>
                        <tr>
                          <th style={{ padding: "6px 10px", background: "#f9fafb", border: "1px solid #e5e7eb", color: "#374151" }}>
                            Câmbio ↓ / Preço →
                          </th>
                          {gridResult.precos.map((p: number) => (
                            <th key={p} style={{ padding: "6px 10px", background: "#f9fafb", border: "1px solid #e5e7eb", color: "#374151" }}>
                              {p.toFixed(1)}¢
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {gridResult.cambios.map((c: number, ci: number) => (
                          <tr key={c}>
                            <td style={{ padding: "6px 10px", border: "1px solid #e5e7eb", fontWeight: 600, color: "#374151", background: "#f9fafb" }}>
                              R${c.toFixed(2)}
                            </td>
                            {gridResult.grid[ci].map((val: number, pi: number) => (
                              <td
                                key={pi}
                                style={{
                                  padding: "6px 10px",
                                  border: "1px solid #e5e7eb",
                                  textAlign: "right",
                                  background: val >= 0 ? "#f0fdf4" : "#fef2f2",
                                  color: val >= 0 ? "#15803d" : "#dc2626",
                                  fontVariantNumeric: "tabular-nums",
                                }}
                              >
                                {val >= 0 ? "+" : ""}{val.toFixed(2)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/app/app/breakeven/page.tsx
git commit -m "feat(frontend): add breakeven page with 3 calculation modes"
```

---

### Task 8: ARIMA Backend Endpoint

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Add ARIMA endpoint to main.py**

Append to `backend/main.py`:
```python
# ── ARIMA ──────────────────────────────────────────────────────────────────────

class ARIMARequest(BaseModel):
    ticker: str = "SB=F"
    dias_historico: int = 252
    dias_forecast: int = 30
    p: int = 1
    d: int = 1
    q: int = 1


@app.post("/api/arima")
async def run_arima(
    body: ARIMARequest,
    user: Annotated[dict, Depends(get_current_user)],
):
    """Fit ARIMA(p,d,q) and return forecast with 95% confidence interval."""
    import asyncio
    from statsmodels.tsa.arima.model import ARIMA as ARIMAModel

    end_date = date_type.today()
    start_date = end_date - timedelta(days=int(body.dias_historico * 1.6))
    rows = get_prices(body.ticker.upper(), start_date, end_date)

    if len(rows) < 30:
        raise HTTPException(status_code=400, detail="Dados insuficientes para ARIMA (mínimo 30 dias).")

    rows = rows[-body.dias_historico:]
    closes = [float(r["close"]) for r in rows if r["close"] is not None]
    dates = [r["date"] for r in rows if r["close"] is not None]

    def fit_and_forecast():
        model = ARIMAModel(closes, order=(body.p, body.d, body.q))
        fit = model.fit()
        forecast_res = fit.get_forecast(steps=body.dias_forecast)
        mean = forecast_res.predicted_mean.tolist()
        ci = forecast_res.conf_int(alpha=0.05).values.tolist()
        return mean, ci

    loop = asyncio.get_event_loop()
    try:
        mean, ci = await loop.run_in_executor(None, fit_and_forecast)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Erro ao ajustar ARIMA: {exc}")

    # Generate forecast dates (skip weekends)
    last_date = date_type.fromisoformat(str(dates[-1]))
    forecast_dates = []
    d = last_date
    while len(forecast_dates) < body.dias_forecast:
        d = d + timedelta(days=1)
        if d.weekday() < 5:
            forecast_dates.append(d.isoformat())

    return {
        "ticker": body.ticker.upper(),
        "historico": [{"date": str(dt), "value": v} for dt, v in zip(dates, closes)],
        "forecast": [
            {
                "date": fd,
                "value": round(m, 4),
                "lower": round(c[0], 4),
                "upper": round(c[1], 4),
            }
            for fd, m, c in zip(forecast_dates, mean, ci)
        ],
        "params": {"p": body.p, "d": body.d, "q": body.q},
    }
```

- [ ] **Step 2: Restart uvicorn and test**

```bash
pkill -f uvicorn
cd ~/impacto-v2/backend && source ~/.bashrc
nohup python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 > ~/uvicorn.log 2>&1 &
sleep 3
curl -X POST "http://localhost:8000/api/arima" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"ticker":"SB=F","dias_historico":100,"dias_forecast":10,"p":1,"d":1,"q":1}'
```

Expected: JSON with `historico`, `forecast` (with `date`, `value`, `lower`, `upper`), `params`.

- [ ] **Step 3: Commit**

```bash
git add backend/main.py
git commit -m "feat(backend): add ARIMA(p,d,q) forecast endpoint with CI"
```

---

### Task 9: ARIMA Frontend Page

**Files:**
- Create: `frontend/app/app/arima/page.tsx`

- [ ] **Step 1: Create ARIMA page**

`frontend/app/app/arima/page.tsx`:
```tsx
"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

async function getAccessToken(): Promise<string | null> {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export default function ARIMAPage() {
  const [ticker, setTicker] = useState("SB=F");
  const [diasHistorico, setDiasHistorico] = useState("252");
  const [diasForecast, setDiasForecast] = useState("30");
  const [p, setP] = useState("1");
  const [d, setD] = useState("1");
  const [q, setQ] = useState("1");
  const [result, setResult] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const token = await getAccessToken();
      const res = await fetch(`${API}/api/arima`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ticker,
          dias_historico: +diasHistorico,
          dias_forecast: +diasForecast,
          p: +p, d: +d, q: +q,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail ?? "Erro ao rodar ARIMA");
      }
      setResult(await res.json());
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }

  // Merge historico + forecast for chart
  const chartData = result
    ? [
        ...result.historico.slice(-60).map((h: any) => ({
          date: h.date,
          historico: h.value,
        })),
        ...result.forecast.map((f: any) => ({
          date: f.date,
          forecast: f.value,
          ci: [f.lower, f.upper],
          lower: f.lower,
          upper: f.upper,
        })),
      ]
    : [];

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "#f4f6f9" }}>
      <div
        className="px-7"
        style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", paddingTop: 18, paddingBottom: 18 }}
      >
        <h1 className="font-bold" style={{ fontSize: 20, color: "#111827" }}>ARIMA</h1>
        <p style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>
          Forecast de preços com intervalo de confiança 95%
        </p>
      </div>

      <div className="px-7 py-6 space-y-6">
        <Card style={{ background: "#fff", border: "1px solid #e5e7eb" }}>
          <CardContent className="pt-5">
            <form onSubmit={handleSubmit} className="flex flex-wrap gap-4 items-end">
              <div className="space-y-1.5">
                <Label>Ativo</Label>
                <Select value={ticker} onValueChange={setTicker}>
                  <SelectTrigger style={{ width: 140 }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SB=F">Açúcar NY (SB=F)</SelectItem>
                    <SelectItem value="USDBRL=X">Dólar BRL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Histórico (dias)</Label>
                <Input type="number" min="63" max="504" value={diasHistorico} onChange={e => setDiasHistorico(e.target.value)} style={{ width: 100 }} />
              </div>
              <div className="space-y-1.5">
                <Label>Forecast (dias)</Label>
                <Input type="number" min="5" max="90" value={diasForecast} onChange={e => setDiasForecast(e.target.value)} style={{ width: 100 }} />
              </div>
              <div className="space-y-1.5">
                <Label>p</Label>
                <Input type="number" min="0" max="5" value={p} onChange={e => setP(e.target.value)} style={{ width: 60 }} />
              </div>
              <div className="space-y-1.5">
                <Label>d</Label>
                <Input type="number" min="0" max="5" value={d} onChange={e => setD(e.target.value)} style={{ width: 60 }} />
              </div>
              <div className="space-y-1.5">
                <Label>q</Label>
                <Input type="number" min="0" max="5" value={q} onChange={e => setQ(e.target.value)} style={{ width: 60 }} />
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? "Ajustando modelo..." : "Rodar ARIMA"}
              </Button>
            </form>
            {error && <p style={{ color: "#dc2626", fontSize: 13, marginTop: 12 }}>{error}</p>}
          </CardContent>
        </Card>

        {result && (
          <Card style={{ background: "#fff", border: "1px solid #e5e7eb" }}>
            <CardHeader>
              <CardTitle style={{ fontSize: 14, color: "#374151" }}>
                {result.ticker} — ARIMA({result.params.p},{result.params.d},{result.params.q}) · forecast {diasForecast} dias
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={chartData} margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={Math.floor(chartData.length / 8)} />
                  <YAxis tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
                  <Tooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="upper"
                    stroke="none"
                    fill="#dbeafe"
                    name="IC 95% sup"
                    dot={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="lower"
                    stroke="none"
                    fill="#fff"
                    name="IC 95% inf"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="historico"
                    stroke="#374151"
                    dot={false}
                    strokeWidth={1.5}
                    name="Histórico"
                  />
                  <Line
                    type="monotone"
                    dataKey="forecast"
                    stroke="#2563eb"
                    dot={false}
                    strokeWidth={2}
                    strokeDasharray="5 3"
                    name="Forecast"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/app/app/arima/page.tsx
git commit -m "feat(frontend): add ARIMA page with forecast chart and CI band"
```

---

### Task 10: Stress Test Backend Endpoint

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Add stress test endpoint to main.py**

Append to `backend/main.py`:
```python
# ── Stress Test ────────────────────────────────────────────────────────────────

CENARIOS_HISTORICOS: dict[str, dict] = {
    "crise_2008": {"label": "Crise Financeira 2008", "choque_preco_pct": -45.0, "choque_cambio_pct": 60.0},
    "covid_2020": {"label": "COVID-19 2020", "choque_preco_pct": -25.0, "choque_cambio_pct": 30.0},
    "seca_2021": {"label": "Seca Brasil 2021", "choque_preco_pct": 35.0, "choque_cambio_pct": 15.0},
    "eleicoes_2022": {"label": "Eleições BR 2022", "choque_preco_pct": -10.0, "choque_cambio_pct": 25.0},
}


class StressRequest(BaseModel):
    mode: Literal["historico", "manual"]
    preco_atual: float
    cambio_atual: float
    cenario: str | None = None
    choque_preco_pct: float | None = None
    choque_cambio_pct: float | None = None


@app.get("/api/stress/cenarios")
async def list_cenarios(user: Annotated[dict, Depends(get_current_user)]):
    """List available historical stress scenarios."""
    return {"cenarios": {k: v["label"] for k, v in CENARIOS_HISTORICOS.items()}}


@app.post("/api/stress")
async def stress_test(
    body: StressRequest,
    user: Annotated[dict, Depends(get_current_user)],
):
    """Apply historical or manual shock to price and exchange rate."""
    if body.mode == "historico":
        if body.cenario not in CENARIOS_HISTORICOS:
            raise HTTPException(status_code=400, detail=f"Cenário '{body.cenario}' não encontrado.")
        s = CENARIOS_HISTORICOS[body.cenario]
        choque_preco = s["choque_preco_pct"] / 100
        choque_cambio = s["choque_cambio_pct"] / 100
        label = s["label"]
    else:
        if body.choque_preco_pct is None or body.choque_cambio_pct is None:
            raise HTTPException(status_code=400, detail="choque_preco_pct e choque_cambio_pct obrigatórios")
        choque_preco = body.choque_preco_pct / 100
        choque_cambio = body.choque_cambio_pct / 100
        label = "Cenário Manual"

    preco_estressado = body.preco_atual * (1 + choque_preco)
    cambio_estressado = body.cambio_atual * (1 + choque_cambio)
    receita_base = body.preco_atual / 100 * body.cambio_atual
    receita_estressada = preco_estressado / 100 * cambio_estressado
    impacto_pct = ((receita_estressada - receita_base) / receita_base) * 100 if receita_base else 0.0

    return {
        "label": label,
        "preco_atual": body.preco_atual,
        "preco_estressado": round(preco_estressado, 2),
        "cambio_atual": body.cambio_atual,
        "cambio_estressado": round(cambio_estressado, 4),
        "impacto_pct": round(impacto_pct, 2),
        "receita_base": round(receita_base, 4),
        "receita_estressada": round(receita_estressada, 4),
        "choque_preco_pct": choque_preco * 100,
        "choque_cambio_pct": choque_cambio * 100,
    }
```

- [ ] **Step 2: Restart uvicorn and test**

```bash
pkill -f uvicorn
cd ~/impacto-v2/backend && source ~/.bashrc
nohup python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 > ~/uvicorn.log 2>&1 &
sleep 2
curl -X POST "http://localhost:8000/api/stress" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"mode":"historico","preco_atual":22.5,"cambio_atual":5.20,"cenario":"covid_2020"}'
```

Expected: JSON with `preco_estressado`, `cambio_estressado`, `impacto_pct`.

- [ ] **Step 3: Commit**

```bash
git add backend/main.py
git commit -m "feat(backend): add stress test endpoint with historical and manual scenarios"
```

---

### Task 11: Stress Test Frontend Page

**Files:**
- Create: `frontend/app/app/stress/page.tsx`

- [ ] **Step 1: Create stress test page**

`frontend/app/app/stress/page.tsx`:
```tsx
"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

const CENARIOS: Record<string, string> = {
  crise_2008: "Crise Financeira 2008",
  covid_2020: "COVID-19 2020",
  seca_2021: "Seca Brasil 2021",
  eleicoes_2022: "Eleições BR 2022",
};

async function getAccessToken(): Promise<string | null> {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function postStress(body: object): Promise<any> {
  const token = await getAccessToken();
  const res = await fetch(`${API}/api/stress`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) { const err = await res.json(); throw new Error(err.detail ?? "Erro"); }
  return res.json();
}

function ResultCard({ result }: { result: any }) {
  const positivo = result.impacto_pct >= 0;
  return (
    <div className="grid gap-4 mt-6" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
      {[
        { label: "Preço estressado (¢/lb)", value: result.preco_estressado.toFixed(2), choque: result.choque_preco_pct },
        { label: "Câmbio estressado (R$)", value: result.cambio_estressado.toFixed(4), choque: result.choque_cambio_pct },
        { label: "Impacto na receita", value: `${result.impacto_pct >= 0 ? "+" : ""}${result.impacto_pct.toFixed(2)}%`, choque: null },
      ].map(({ label, value, choque }) => (
        <div key={label} className="rounded-[10px] p-5" style={{
          background: label.includes("Impacto") ? (positivo ? "#f0fdf4" : "#fef2f2") : "#f9fafb",
          border: `1px solid ${label.includes("Impacto") ? (positivo ? "#bbf7d0" : "#fecaca") : "#e5e7eb"}`,
        }}>
          <p style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</p>
          <p style={{ fontSize: 24, fontWeight: 700, color: label.includes("Impacto") ? (positivo ? "#15803d" : "#dc2626") : "#111827", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
            {value}
          </p>
          {choque !== null && (
            <p style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
              choque: {choque >= 0 ? "+" : ""}{choque.toFixed(1)}%
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

export default function StressPage() {
  const [precoAtual, setPrecoAtual] = useState("22.5");
  const [cambioAtual, setCambioAtual] = useState("5.20");
  const [cenario, setCenario] = useState("covid_2020");
  const [choquePct, setChoquePct] = useState("0");
  const [choqueCambioPct, setChoqueCambioPct] = useState("0");
  const [result, setResult] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runHistorico(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError(null);
    try { setResult(await postStress({ mode: "historico", preco_atual: +precoAtual, cambio_atual: +cambioAtual, cenario })); }
    catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function runManual(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError(null);
    try { setResult(await postStress({ mode: "manual", preco_atual: +precoAtual, cambio_atual: +cambioAtual, choque_preco_pct: +choquePct, choque_cambio_pct: +choqueCambioPct })); }
    catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "#f4f6f9" }}>
      <div className="px-7" style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", paddingTop: 18, paddingBottom: 18 }}>
        <h1 className="font-bold" style={{ fontSize: 20, color: "#111827" }}>Stress Test</h1>
        <p style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>Impacto de cenários de choque no preço e câmbio</p>
      </div>

      <div className="px-7 py-6 space-y-4">
        <Card style={{ background: "#fff", border: "1px solid #e5e7eb" }}>
          <CardContent className="pt-5">
            <div className="flex flex-wrap gap-4 items-end mb-4">
              <div className="space-y-1.5">
                <Label>Preço atual (¢/lb)</Label>
                <Input value={precoAtual} onChange={e => setPrecoAtual(e.target.value)} style={{ width: 130 }} />
              </div>
              <div className="space-y-1.5">
                <Label>Câmbio atual (R$)</Label>
                <Input value={cambioAtual} onChange={e => setCambioAtual(e.target.value)} style={{ width: 130 }} />
              </div>
            </div>

            {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}

            <Tabs defaultValue="historico">
              <TabsList>
                <TabsTrigger value="historico">Cenários Históricos</TabsTrigger>
                <TabsTrigger value="manual">Cenário Manual</TabsTrigger>
              </TabsList>

              <TabsContent value="historico" className="mt-4">
                <form onSubmit={runHistorico} className="flex gap-4 items-end">
                  <div className="space-y-1.5">
                    <Label>Cenário</Label>
                    <Select value={cenario} onValueChange={setCenario}>
                      <SelectTrigger style={{ width: 220 }}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(CENARIOS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" disabled={loading}>{loading ? "Calculando..." : "Aplicar cenário"}</Button>
                </form>
              </TabsContent>

              <TabsContent value="manual" className="mt-4">
                <form onSubmit={runManual} className="flex flex-wrap gap-4 items-end">
                  <div className="space-y-1.5">
                    <Label>Choque preço (%)</Label>
                    <Input type="number" min="-80" max="80" value={choquePct} onChange={e => setChoquePct(e.target.value)} style={{ width: 130 }} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Choque câmbio (%)</Label>
                    <Input type="number" min="-80" max="80" value={choqueCambioPct} onChange={e => setChoqueCambioPct(e.target.value)} style={{ width: 130 }} />
                  </div>
                  <Button type="submit" disabled={loading}>{loading ? "Calculando..." : "Simular"}</Button>
                </form>
              </TabsContent>
            </Tabs>

            {result && <ResultCard result={result} />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/app/app/stress/page.tsx
git commit -m "feat(frontend): add stress test page with historical and manual scenarios"
```

---

### Task 12: News Backend Endpoint

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Add news endpoint to main.py**

Append to `backend/main.py`:
```python
# ── News ───────────────────────────────────────────────────────────────────────

import time as _time
_news_cache: dict = {"data": None, "ts": 0.0}


@app.get("/api/news")
async def get_news(user: Annotated[dict, Depends(get_current_user)]):
    """Fetch and cache Google News RSS for sugar and FX. 30-minute cache."""
    import asyncio
    import feedparser

    now = _time.time()
    if _news_cache["data"] is not None and now - _news_cache["ts"] < 1800:
        return _news_cache["data"]

    feeds = [
        "https://news.google.com/rss/search?q=a%C3%A7%C3%BAcar+futuros+NY+mercado&hl=pt-BR&gl=BR&ceid=BR:pt-419",
        "https://news.google.com/rss/search?q=d%C3%B3lar+real+c%C3%A2mbio+Brasil&hl=pt-BR&gl=BR&ceid=BR:pt-419",
    ]

    def fetch_all():
        articles = []
        for url in feeds:
            feed = feedparser.parse(url)
            for entry in feed.entries[:10]:
                articles.append({
                    "title": entry.get("title", ""),
                    "source": (entry.get("source") or {}).get("title", "Google News"),
                    "published": entry.get("published", ""),
                    "link": entry.get("link", ""),
                })
        seen: set = set()
        unique = []
        for a in articles:
            if a["title"] not in seen:
                seen.add(a["title"])
                unique.append(a)
        return unique[:20]

    loop = asyncio.get_event_loop()
    articles = await loop.run_in_executor(None, fetch_all)

    result = {"articles": articles, "cached_at": int(now)}
    _news_cache["data"] = result
    _news_cache["ts"] = now
    return result
```

- [ ] **Step 2: Restart uvicorn and test**

```bash
pkill -f uvicorn
cd ~/impacto-v2/backend && source ~/.bashrc
nohup python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 > ~/uvicorn.log 2>&1 &
sleep 2
curl "http://localhost:8000/api/news" -H "Authorization: Bearer $TOKEN"
```

Expected: JSON with `articles` array containing `title`, `source`, `published`, `link`.

- [ ] **Step 3: Commit**

```bash
git add backend/main.py
git commit -m "feat(backend): add news endpoint with 30-min RSS cache"
```

---

### Task 13: News Frontend Page

**Files:**
- Create: `frontend/app/app/news/page.tsx`

- [ ] **Step 1: Create news page**

`frontend/app/app/news/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

async function fetchNews(token: string) {
  try {
    const res = await fetch(`${API}/api/news`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.articles ?? [];
  } catch {
    return [];
  }
}

export default async function NewsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? "";
  const articles = await fetchNews(token);

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "#f4f6f9" }}>
      <div className="px-7" style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", paddingTop: 18, paddingBottom: 18 }}>
        <h1 className="font-bold" style={{ fontSize: 20, color: "#111827" }}>Notícias</h1>
        <p style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>
          Açúcar NY e câmbio USD/BRL · Atualizado a cada 30 minutos
        </p>
      </div>

      <div className="px-7 py-6">
        {articles.length === 0 ? (
          <p style={{ color: "#6b7280", fontSize: 14 }}>Não foi possível carregar as notícias.</p>
        ) : (
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
            {articles.map((a: any, i: number) => (
              <a
                key={i}
                href={a.link}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-[10px] p-4 transition-all hover:border-blue-400"
                style={{ background: "#fff", border: "1px solid #e5e7eb", textDecoration: "none" }}
              >
                <p style={{ fontSize: 13, fontWeight: 600, color: "#111827", lineHeight: 1.4 }}>
                  {a.title}
                </p>
                <div className="flex items-center gap-3 mt-2">
                  <span style={{ fontSize: 11, color: "#6b7280" }}>{a.source}</span>
                  <span style={{ fontSize: 11, color: "#9ca3af" }}>{a.published}</span>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/app/app/news/page.tsx
git commit -m "feat(frontend): add news page with Google News RSS feed"
```

---

### Task 14: Volatility Backend Endpoint

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Add volatility endpoint to main.py**

Append to `backend/main.py`:
```python
# ── Volatility ─────────────────────────────────────────────────────────────────

@app.get("/api/volatility/{ticker}")
async def get_volatility(
    ticker: str,
    start: date_type,
    end: date_type,
    user: Annotated[dict, Depends(get_current_user)],
):
    """Rolling volatility (21d, 63d, 252d) annualized, plus summary stats."""
    rows = get_prices(ticker.upper(), start, end)
    if len(rows) < 30:
        raise HTTPException(status_code=400, detail="Dados insuficientes (mínimo 30 dias).")

    closes = np.array([r["close"] for r in rows if r["close"] is not None], dtype=float)
    dates = [r["date"] for r in rows if r["close"] is not None]
    log_returns = np.diff(np.log(closes))

    windows = {"vol_21": 21, "vol_63": 63, "vol_252": 252}
    series = []
    for i in range(len(log_returns)):
        entry: dict = {"date": str(dates[i + 1])}
        for key, w in windows.items():
            if i >= w - 1:
                window_ret = log_returns[i - w + 1: i + 1]
                entry[key] = round(float(np.std(window_ret, ddof=1) * np.sqrt(252)), 6)
            else:
                entry[key] = None
        series.append(entry)

    stats: dict = {}
    for key in windows:
        vals = [e[key] for e in series if e[key] is not None]
        if vals:
            stats[key] = {
                "mean": round(float(np.mean(vals)), 6),
                "max": round(float(np.max(vals)), 6),
                "min": round(float(np.min(vals)), 6),
                "current": vals[-1],
            }
        else:
            stats[key] = {"mean": None, "max": None, "min": None, "current": None}

    # Cone: current price ± N*sigma projected forward 30 days
    current_price = float(closes[-1])
    current_vol = stats["vol_21"]["current"] or stats["vol_63"]["current"] or 0.0
    daily_vol = current_vol / np.sqrt(252)
    cone = [
        {
            "day": d,
            "upper": round(current_price * np.exp(daily_vol * np.sqrt(d) * 1.645), 4),
            "lower": round(current_price * np.exp(-daily_vol * np.sqrt(d) * 1.645), 4),
            "center": round(current_price, 4),
        }
        for d in range(1, 31)
    ]

    return {
        "ticker": ticker.upper(),
        "series": series,
        "stats": stats,
        "cone": cone,
        "current_price": current_price,
    }
```

- [ ] **Step 2: Restart uvicorn and test**

```bash
pkill -f uvicorn
cd ~/impacto-v2/backend && source ~/.bashrc
nohup python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 > ~/uvicorn.log 2>&1 &
sleep 2
curl "http://localhost:8000/api/volatility/SB%3DF?start=2023-01-01&end=2024-12-31" \
  -H "Authorization: Bearer $TOKEN"
```

Expected: JSON with `series`, `stats`, `cone`, `current_price`.

- [ ] **Step 3: Commit**

```bash
git add backend/main.py
git commit -m "feat(backend): add rolling volatility endpoint with cone projection"
```

---

### Task 15: Volatility Frontend Page

**Files:**
- Create: `frontend/app/app/volatility/page.tsx`

- [ ] **Step 1: Create volatility page**

`frontend/app/app/volatility/page.tsx`:
```tsx
"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

async function getAccessToken(): Promise<string | null> {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export default function VolatilityPage() {
  const [ticker, setTicker] = useState("SB=F");
  const [start, setStart] = useState(
    new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [end, setEnd] = useState(new Date().toISOString().slice(0, 10));
  const [result, setResult] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError(null);
    try {
      const token = await getAccessToken();
      const res = await fetch(
        `${API}/api/volatility/${encodeURIComponent(ticker)}?start=${start}&end=${end}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) { const err = await res.json(); throw new Error(err.detail ?? "Erro"); }
      setResult(await res.json());
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }

  const seriesFiltered = result?.series?.filter((s: any) => s.vol_21 !== null) ?? [];

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "#f4f6f9" }}>
      <div className="px-7" style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", paddingTop: 18, paddingBottom: 18 }}>
        <h1 className="font-bold" style={{ fontSize: 20, color: "#111827" }}>Volatilidade</h1>
        <p style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>Volatilidade histórica rolante e cone de projeção</p>
      </div>

      <div className="px-7 py-6 space-y-6">
        <Card style={{ background: "#fff", border: "1px solid #e5e7eb" }}>
          <CardContent className="pt-5">
            <form onSubmit={handleSubmit} className="flex flex-wrap gap-4 items-end">
              <div className="space-y-1.5">
                <Label>Ativo</Label>
                <Select value={ticker} onValueChange={setTicker}>
                  <SelectTrigger style={{ width: 160 }}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SB=F">Açúcar NY (SB=F)</SelectItem>
                    <SelectItem value="USDBRL=X">Dólar BRL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Início</Label>
                <Input type="date" value={start} onChange={e => setStart(e.target.value)} style={{ width: 140 }} />
              </div>
              <div className="space-y-1.5">
                <Label>Fim</Label>
                <Input type="date" value={end} onChange={e => setEnd(e.target.value)} style={{ width: 140 }} />
              </div>
              <Button type="submit" disabled={loading}>{loading ? "Calculando..." : "Calcular"}</Button>
            </form>
            {error && <p style={{ color: "#dc2626", fontSize: 13, marginTop: 12 }}>{error}</p>}
          </CardContent>
        </Card>

        {result && (
          <>
            {/* Stats table */}
            <Card style={{ background: "#fff", border: "1px solid #e5e7eb" }}>
              <CardHeader><CardTitle style={{ fontSize: 14, color: "#374151" }}>Estatísticas por janela (volatilidade anualizada)</CardTitle></CardHeader>
              <CardContent>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f9fafb" }}>
                      {["Janela", "Atual", "Média", "Máx", "Mín"].map(h => (
                        <th key={h} style={{ padding: "8px 12px", border: "1px solid #e5e7eb", textAlign: "left", color: "#374151", fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: "21 dias", key: "vol_21" },
                      { label: "63 dias", key: "vol_63" },
                      { label: "252 dias", key: "vol_252" },
                    ].map(({ label, key }) => {
                      const s = result.stats[key];
                      const fmt = (v: number | null) => v !== null ? `${(v * 100).toFixed(2)}%` : "—";
                      return (
                        <tr key={key}>
                          <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb", fontWeight: 600 }}>{label}</td>
                          <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb", fontVariantNumeric: "tabular-nums" }}>{fmt(s.current)}</td>
                          <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb", fontVariantNumeric: "tabular-nums" }}>{fmt(s.mean)}</td>
                          <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb", fontVariantNumeric: "tabular-nums", color: "#dc2626" }}>{fmt(s.max)}</td>
                          <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb", fontVariantNumeric: "tabular-nums", color: "#16a34a" }}>{fmt(s.min)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {/* Rolling volatility chart */}
            <Card style={{ background: "#fff", border: "1px solid #e5e7eb" }}>
              <CardHeader><CardTitle style={{ fontSize: 14, color: "#374151" }}>Volatilidade rolante anualizada</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={seriesFiltered} margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={Math.floor(seriesFiltered.length / 8)} />
                    <YAxis tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => `${(v * 100).toFixed(2)}%`} />
                    <Legend />
                    <Line type="monotone" dataKey="vol_21" stroke="#2563eb" dot={false} strokeWidth={1.5} name="21 dias" />
                    <Line type="monotone" dataKey="vol_63" stroke="#d97706" dot={false} strokeWidth={1.5} name="63 dias" />
                    <Line type="monotone" dataKey="vol_252" stroke="#dc2626" dot={false} strokeWidth={1.5} name="252 dias" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Volatility cone */}
            <Card style={{ background: "#fff", border: "1px solid #e5e7eb" }}>
              <CardHeader><CardTitle style={{ fontSize: 14, color: "#374151" }}>Cone de volatilidade (30 dias, IC 90%) — preço atual: {result.current_price.toFixed(2)}</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={result.cone} margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} label={{ value: "Dias", position: "insideBottom", offset: -2, fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
                    <Tooltip />
                    <Area type="monotone" dataKey="upper" stroke="#2563eb" fill="#dbeafe" strokeWidth={1.5} name="Limite superior" />
                    <Area type="monotone" dataKey="lower" stroke="#2563eb" fill="#fff" strokeWidth={1.5} name="Limite inferior" />
                    <Line type="monotone" dataKey="center" stroke="#374151" strokeDasharray="4 2" dot={false} name="Preço atual" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/app/app/volatility/page.tsx
git commit -m "feat(frontend): add volatility page with rolling chart and cone"
```

---

### Task 16: ToolGrid Update + Admin Config UI

**Files:**
- Modify: `frontend/components/dashboard/ToolGrid.tsx`
- Modify: `frontend/app/app/admin/page.tsx`

- [ ] **Step 1: Update ToolGrid with all pages**

`frontend/components/dashboard/ToolGrid.tsx`:
```tsx
"use client";

import Link from "next/link";

const TOOLS = [
  { href: "/app/simulation", label: "Monte Carlo", desc: "Simulação de preços com fan chart P5–P95" },
  { href: "/app/options", label: "Payoff Opções", desc: "Estratégias multi-perna com gráfico de payoff" },
  { href: "/app/pricing", label: "Precificação", desc: "Black-Scholes e MC para calls europeias" },
  { href: "/app/var", label: "VaR", desc: "Value at Risk histórico e paramétrico" },
  { href: "/app/breakeven", label: "Breakeven", desc: "Ponto de equilíbrio por cenário de câmbio" },
  { href: "/app/arima", label: "ARIMA", desc: "Forecast de preços com intervalo de confiança" },
  { href: "/app/stress", label: "Stress Test", desc: "Impacto de cenários históricos e manuais" },
  { href: "/app/news", label: "Notícias", desc: "Feed de notícias de açúcar e câmbio" },
  { href: "/app/volatility", label: "Volatilidade", desc: "Volatilidade histórica rolante e cone" },
  { href: "/app/focus", label: "Focus BCB", desc: "Expectativas IPCA, Câmbio, Selic e PIB" },
  { href: "/app/params", label: "Parâmetros", desc: "Configurar parâmetros de simulação por ativo" },
  { href: "/app/market", label: "Mercado", desc: "Histórico de preços por ticker" },
];

export function ToolGrid() {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
      {TOOLS.map(({ href, label, desc }) => (
        <Link
          key={href}
          href={href}
          className="group block rounded-[10px] p-[18px] transition-all"
          style={{ background: "#fff", border: "1px solid #e5e7eb" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "#3b82f6";
            (e.currentTarget as HTMLElement).style.background = "#eff6ff";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "#e5e7eb";
            (e.currentTarget as HTMLElement).style.background = "#fff";
          }}
        >
          <p className="font-bold mb-1" style={{ fontSize: 13, color: "#111827" }}>{label}</p>
          <p className="leading-snug" style={{ fontSize: 11, color: "#9ca3af" }}>{desc}</p>
          <p className="mt-2.5 font-semibold" style={{ fontSize: 11, color: "#3b82f6" }}>Acessar →</p>
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Read current admin page**

Read `frontend/app/app/admin/page.tsx` to understand its current structure before editing.

- [ ] **Step 3: Add admin config section to admin page**

Read the file first, then append a config section. Add the following imports at top:

```tsx
// Add these imports at top of admin/page.tsx
import { useState } from "react"; // already there if it's a client component
```

If the admin page is a Server Component, convert it to `"use client"` or create a separate `AdminConfigEditor` client component at `frontend/components/admin/AdminConfigEditor.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

async function getAccessToken(): Promise<string | null> {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export function AdminConfigEditor() {
  const [configs, setConfigs] = useState<any[]>([]);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const token = await getAccessToken();
      const res = await fetch(`${API}/api/admin/config`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setConfigs(data.config);
        const vals: Record<string, string> = {};
        data.config.forEach((c: any) => { vals[c.key] = c.value; });
        setEditValues(vals);
      }
    }
    load();
  }, []);

  async function save(key: string, description: string) {
    setSaving(key); setMessage(null);
    const token = await getAccessToken();
    const res = await fetch(`${API}/api/admin/config/${key}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ value: editValues[key], description }),
    });
    setSaving(null);
    setMessage(res.ok ? `${key} salvo.` : "Erro ao salvar.");
  }

  return (
    <Card style={{ background: "#fff", border: "1px solid #e5e7eb" }}>
      <CardHeader>
        <CardTitle style={{ fontSize: 14, color: "#374151" }}>Configurações do Sistema</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {configs.map((c) => (
          <div key={c.key} className="flex items-end gap-3">
            <div className="flex-1 space-y-1">
              <p style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{c.key}</p>
              {c.description && <p style={{ fontSize: 11, color: "#9ca3af" }}>{c.description}</p>}
              <Input
                value={editValues[c.key] ?? ""}
                onChange={e => setEditValues(prev => ({ ...prev, [c.key]: e.target.value }))}
              />
            </div>
            <Button
              size="sm"
              disabled={saving === c.key}
              onClick={() => save(c.key, c.description)}
            >
              {saving === c.key ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        ))}
        {message && <p style={{ fontSize: 13, color: "#15803d" }}>{message}</p>}
      </CardContent>
    </Card>
  );
}
```

Then import and add `<AdminConfigEditor />` to the admin page.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/dashboard/ToolGrid.tsx \
        frontend/app/app/admin/page.tsx \
        frontend/components/admin/AdminConfigEditor.tsx
git commit -m "feat(frontend): update ToolGrid with all pages and add admin config UI"
```

---

### Task 17: Final Build and Deploy

- [ ] **Step 1: Build locally**

```bash
cd "C:\Users\netin\OneDrive\Documentos\Code\impacto\frontend"
rm -rf .next
npm run build
```

Expected: no TypeScript errors, build succeeds.

- [ ] **Step 2: Deploy to Vercel**

```bash
vercel --prod
```

- [ ] **Step 3: Manual test checklist**

- [ ] `/app/focus` — shows 4 metric cards with BCB data
- [ ] `/app/pricing` — redirects to `/app/options`
- [ ] `/app/var` — form → histogram + comparison table
- [ ] `/app/breakeven` — 3 tabs all calculate correctly
- [ ] `/app/arima` — chart shows historical + forecast + CI band
- [ ] `/app/stress` — historical scenarios and manual sliders work
- [ ] `/app/news` — shows news cards with links
- [ ] `/app/volatility` — rolling chart + cone + stats table
- [ ] `/app/dashboard` — ToolGrid shows all 12 tools
- [ ] `/app/admin` — admin config editor shows and saves `breakeven_fator_conversao`
