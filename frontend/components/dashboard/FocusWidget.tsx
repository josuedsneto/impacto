import { formatFX, formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

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

const ROWS = [
  { key: "ipca" as const, label: "IPCA", tipo: "pct" },
  { key: "selic" as const, label: "Selic (fim de ano)", tipo: "pct" },
  { key: "cambio" as const, label: "Dólar (USD/BRL)", tipo: "fx" },
  { key: "pib" as const, label: "PIB", tipo: "pct" },
];

function DeltaTag({ delta, altaEBoa }: { delta: number | null; altaEBoa: boolean }) {
  if (delta === null || delta === 0) return <span className="text-[11px] text-muted-foreground">sem mudança</span>;
  // PIB: alta é boa (verde). IPCA, Selic e câmbio: alta é ruim (vermelho).
  const bom = altaEBoa ? delta > 0 : delta < 0;
  return (
    <span className={cn("text-[11px] font-semibold", bom ? "text-positive" : "text-negative")}>
      {delta > 0 ? "▲" : "▼"} {formatNumber(Math.abs(delta), 2)} em 7 dias
    </span>
  );
}

export function FocusWidget({ data }: { data: FocusData | null }) {
  const year = data?.ano_referencia ?? new Date().getFullYear().toString();

  return (
    <div className="rounded-xl border border-border bg-card p-5 text-card-foreground">
      <p className="mb-0.5 text-[13px] font-bold">Boletim Focus · BCB</p>
      <p className="mb-3 border-b border-border pb-3 text-[11px] text-muted-foreground">
        Mediana das projeções do mercado para {year}
      </p>

      {!data && <p className="text-xs text-muted-foreground">Dados indisponíveis no momento.</p>}

      {data &&
        ROWS.map(({ key, label, tipo }) => {
          const entry = data[key];
          return (
            <div key={key} className="flex items-center justify-between border-b border-border py-2.5 last:border-0">
              <p className="text-[13px] text-foreground">{label}</p>
              <div className="text-right">
                <p className="text-sm font-bold tabular-nums">
                  {tipo === "fx" ? formatFX(entry.value) : formatPercent(entry.value == null ? null : entry.value / 100)}
                </p>
                <DeltaTag delta={entry.delta} altaEBoa={key === "pib"} />
              </div>
            </div>
          );
        })}
    </div>
  );
}
