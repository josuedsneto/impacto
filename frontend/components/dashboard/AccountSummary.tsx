interface SimulationRow {
  id: string;
  ticker: string;
  label: string | null;
  preco_inicial: number;
  dias_simulados: number;
  p5: number;
  p50: number;
  p95: number;
  created_at: string;
}

interface AccountSummaryProps {
  lastSim: SimulationRow | null;
  simCountMonth: number;
}

export function AccountSummary({ lastSim, simCountMonth }: AccountSummaryProps) {
  const rows = [
    {
      label: "Última simulação MC",
      value: lastSim
        ? `${lastSim.ticker} · P50: ${lastSim.p50.toFixed(2)}`
        : "Nenhuma",
      sub: lastSim
        ? new Date(lastSim.created_at).toLocaleString("pt-BR", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })
        : null,
    },
    {
      label: "P5 / P95 (última sim.)",
      value: lastSim
        ? `${lastSim.p5.toFixed(2)} — ${lastSim.p95.toFixed(2)}`
        : "—",
      sub: lastSim ? `${lastSim.dias_simulados} dias simulados` : null,
    },
    {
      label: "Preço inicial (última sim.)",
      value: lastSim ? lastSim.preco_inicial.toFixed(2) : "—",
      sub: null,
    },
    {
      label: "Simulações este mês",
      value: simCountMonth.toString(),
      sub: null,
    },
  ];

  return (
    <div
      className="rounded-[10px] p-5"
      style={{ background: "#fff", border: "1px solid #e5e7eb" }}
    >
      <p
        className="font-bold mb-3 pb-3"
        style={{
          fontSize: 13,
          color: "#111827",
          borderBottom: "1px solid #f3f4f6",
        }}
      >
        Resumo da Conta
      </p>

      {rows.map(({ label, value, sub }, i) => (
        <div
          key={label}
          className="flex items-center justify-between"
          style={{
            paddingTop: 10,
            paddingBottom: 10,
            borderBottom: i < rows.length - 1 ? "1px solid #f9fafb" : "none",
          }}
        >
          <p style={{ fontSize: 13, color: "#6b7280" }}>{label}</p>
          <div className="text-right">
            <p
              className="font-bold"
              style={{
                fontSize: 14,
                color: "#111827",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {value}
            </p>
            {sub && (
              <p style={{ fontSize: 11, color: "#9ca3af" }}>{sub}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
