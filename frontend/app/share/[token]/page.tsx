import { notFound } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

interface ShareData {
  fixacoes: Array<{
    ticker: string;
    volume: number;
    preco: number;
    data_fixacao: string;
    label: string | null;
  }>;
  preco_atual: number | null;
  volume_total?: number;
  preco_medio?: number;
  pl_unitario?: number;
  generated_at: string;
}

interface ShareResponse {
  type: string;
  expires_at: string;
  data: ShareData;
}

async function fetchShare(token: string): Promise<ShareResponse | null> {
  try {
    const res = await fetch(`${API}/api/share/${encodeURIComponent(token)}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function fmtNum(v: number | null | undefined, dec = 2) {
  if (v == null) return "—";
  return v.toFixed(dec).replace(".", ",");
}

export default async function SharePage({ params }: { params: { token: string } }) {
  const share = await fetchShare(params.token);
  if (!share) notFound();

  const { data, expires_at } = share;
  const sugar = data.fixacoes?.filter((f) => f.ticker === "SB=F") ?? [];
  const fx = data.fixacoes?.filter((f) => f.ticker !== "SB=F") ?? [];
  const expiresDate = new Date(expires_at).toLocaleDateString("pt-BR");
  const generatedAt = new Date(data.generated_at).toLocaleString("pt-BR");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
              <rect width="26" height="26" rx="7" fill="#16a34a"/>
              <line x1="13" y1="22" x2="13" y2="6" stroke="#bbf7d0" strokeWidth="2.2" strokeLinecap="round"/>
              <circle cx="13" cy="18" r="1.5" fill="#4ade80"/>
              <circle cx="13" cy="13" r="1.5" fill="#4ade80"/>
              <circle cx="13" cy="8" r="1.5" fill="#4ade80"/>
              <path d="M13 18 Q18 15 17 10" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
            </svg>
            <span style={{ fontWeight: 800, fontSize: 16, color: "#111827" }}>Sugarcane</span>
          </div>
          <span className="text-xs text-gray-400">Visualização pública · expira em {expiresDate}</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Posição de Hedge</h1>
          <p className="text-sm text-gray-400 mt-1">Gerado em {generatedAt}</p>
        </div>

        {/* Summary metrics */}
        {data.preco_medio != null && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Fixações", value: String(data.fixacoes?.length ?? 0) },
              { label: "Volume total fixado", value: data.volume_total != null ? fmtNum(data.volume_total, 0) + " unid." : "—" },
              { label: "Preço médio fixado (¢/lb)", value: fmtNum(data.preco_medio, 4) },
              {
                label: "P&L por unidade (¢/lb)",
                value: data.pl_unitario != null
                  ? `${data.pl_unitario >= 0 ? "+" : ""}${fmtNum(data.pl_unitario, 4)}`
                  : "—",
                color: data.pl_unitario != null
                  ? data.pl_unitario >= 0 ? "#16a34a" : "#dc2626"
                  : undefined,
              },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white rounded-lg border border-gray-200 p-4">
                <p className="text-xs text-gray-500 mb-1">{label}</p>
                <p className="text-xl font-bold" style={{ color }}>{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Açúcar NY fixações */}
        {sugar.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-3">
              Açúcar NY (SB=F)
            </h2>
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b bg-gray-50 text-gray-500">
                    <th className="text-left px-4 py-2.5 font-medium">Data</th>
                    <th className="text-right px-4 py-2.5 font-medium">Volume</th>
                    <th className="text-right px-4 py-2.5 font-medium">Preço (¢/lb)</th>
                    <th className="text-left px-4 py-2.5 font-medium">Label</th>
                  </tr>
                </thead>
                <tbody>
                  {sugar.map((f, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2.5 font-mono text-xs">
                        {new Date(f.data_fixacao + "T12:00:00").toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-2.5 text-right">{fmtNum(f.volume, 0)}</td>
                      <td className="px-4 py-2.5 text-right">{fmtNum(f.preco, 4)}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-400">{f.label ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* USD/BRL fixações */}
        {fx.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-3">
              USD/BRL
            </h2>
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b bg-gray-50 text-gray-500">
                    <th className="text-left px-4 py-2.5 font-medium">Data</th>
                    <th className="text-right px-4 py-2.5 font-medium">Volume</th>
                    <th className="text-right px-4 py-2.5 font-medium">Preço (R$/USD)</th>
                    <th className="text-left px-4 py-2.5 font-medium">Label</th>
                  </tr>
                </thead>
                <tbody>
                  {fx.map((f, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2.5 font-mono text-xs">
                        {new Date(f.data_fixacao + "T12:00:00").toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-2.5 text-right">{fmtNum(f.volume, 0)}</td>
                      <td className="px-4 py-2.5 text-right">{fmtNum(f.preco, 4)}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-400">{f.label ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {data.fixacoes?.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">Nenhuma fixação registrada nesta posição.</p>
        )}

        <footer className="text-xs text-gray-400 text-center pt-4 border-t border-gray-200">
          Este relatório é gerado automaticamente pela plataforma Sugarcane. Não constitui recomendação de investimento.
        </footer>
      </main>
    </div>
  );
}
