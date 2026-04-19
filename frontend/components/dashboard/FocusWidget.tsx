interface FocusEntry {
  value: number | null;
  delta: number | null;
}

interface FocusData {
  ipca: FocusEntry;
  cambio: FocusEntry;
  selic: FocusEntry;
  pib: FocusEntry;
  ano_referencia: string;
}

interface FocusWidgetProps {
  data: FocusData | null;
}

const ROWS = [
  { key: "ipca" as const, label: "IPCA", unit: "%" },
  { key: "selic" as const, label: "SELIC (fim de ano)", unit: "%" },
  { key: "cambio" as const, label: "USD / BRL", unit: "" },
  { key: "pib" as const, label: "PIB", unit: "%" },
];

function DeltaTag({ delta, invertSign = false }: { delta: number | null; invertSign?: boolean }) {
  if (delta === null) return <span style={{ fontSize: 11, color: "#9ca3af" }}>—</span>;
  // For PIB: higher is good (green). For IPCA/Câmbio: higher is bad (red). invertSign flips the color.
  const positive = invertSign ? delta > 0 : delta < 0;
  const color = delta === 0 ? "#6b7280" : positive ? "#16a34a" : "#dc2626";
  const sign = delta > 0 ? "▲" : delta < 0 ? "▼" : "—";
  return (
    <span className="font-semibold" style={{ fontSize: 11, color }}>
      {sign} ante {Math.abs(delta).toFixed(2)}
    </span>
  );
}

export function FocusWidget({ data }: FocusWidgetProps) {
  const year = data?.ano_referencia ?? new Date().getFullYear().toString();

  return (
    <div
      className="rounded-[10px] p-5"
      style={{ background: "#fff", border: "1px solid #e5e7eb" }}
    >
      <p
        className="font-bold mb-0.5"
        style={{ fontSize: 13, color: "#111827" }}
      >
        Relatório Focus · BCB
      </p>
      <p
        className="mb-3 pb-3"
        style={{
          fontSize: 11,
          color: "#9ca3af",
          borderBottom: "1px solid #f3f4f6",
        }}
      >
        Projeções para {year}
      </p>

      {!data && (
        <p style={{ fontSize: 12, color: "#9ca3af" }}>
          Dados indisponíveis no momento.
        </p>
      )}

      {data &&
        ROWS.map(({ key, label, unit }, i) => {
          const entry = data[key];
          const isLast = i === ROWS.length - 1;
          return (
            <div
              key={key}
              className="flex items-center justify-between"
              style={{
                paddingTop: 10,
                paddingBottom: 10,
                borderBottom: isLast ? "none" : "1px solid #f9fafb",
              }}
            >
              <div>
                <p style={{ fontSize: 13, color: "#374151" }}>{label}</p>
                <p style={{ fontSize: 11, color: "#9ca3af" }}>Projeção {year}</p>
              </div>
              <div className="text-right">
                <p
                  className="font-bold"
                  style={{
                    fontSize: 14,
                    color: "#111827",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {entry.value !== null
                    ? `${entry.value.toFixed(2)}${unit}`
                    : "—"}
                </p>
                <DeltaTag
                  delta={entry.delta}
                  invertSign={key === "pib"}
                />
              </div>
            </div>
          );
        })}
    </div>
  );
}
