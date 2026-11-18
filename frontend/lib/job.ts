// Chamada do backend pelos jobs do cron (DEC-09 no backend: X-Job-Secret). Só roda no servidor.
import { NextResponse } from "next/server";

export async function chamarJob(path: string): Promise<NextResponse> {
  const base = process.env.NEXT_PUBLIC_API_URL;
  const segredo = process.env.JOBS_SECRET;
  if (!base || !segredo) {
    return NextResponse.json({ detail: "Job não configurado no servidor." }, { status: 503 });
  }
  try {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "X-Job-Secret": segredo },
      signal: AbortSignal.timeout(55_000),
    });
    const corpo = await res.json().catch(() => ({ detail: "Resposta inválida do backend." }));
    return NextResponse.json(corpo, { status: res.status });
  } catch {
    return NextResponse.json({ detail: "Backend indisponível para o job." }, { status: 502 });
  }
}
