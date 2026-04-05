const BOM = "\uFEFF";

/** Format a JS Date or ISO string as DD/MM/YYYY */
export function formatBrDate(input: Date | string): string {
  const date = typeof input === "string" ? new Date(input) : input;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/** Format a number with comma decimal separator (Brazilian locale) */
export function formatBrNumber(value: number, decimals = 4): string {
  return value.toFixed(decimals).replace(".", ",");
}

/** Build ISO date suffix for filenames: YYYY-MM-DD */
export function isoToday(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Build a semicolon-delimited UTF-8 BOM CSV and trigger browser download.
 * rows[0] is the header row; all values are pre-stringified.
 * Rows joined with \r\n (Windows line endings for Excel compatibility).
 */
export function downloadCsv(rows: string[][], filename: string): void {
  const csv = BOM + rows.map((r) => r.join(";")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Trigger browser print dialog */
export function printPage(): void {
  window.print();
}
