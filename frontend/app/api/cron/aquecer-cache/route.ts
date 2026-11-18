import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

// Disparada pelo Vercel Cron (vercel.json), que envia Authorization: Bearer <CRON_SECRET>.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function iguais(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const jobsSecret = process.env.JOBS_SECRET;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!cronSecret || !jobsSecret || !apiUrl) {
    return NextResponse.json({ erro: "Configuração do job incompleta" }, { status: 500 });
  }

  const autorizacao = req.headers.get("authorization") ?? "";
  if (!iguais(autorizacao, `Bearer ${cronSecret}`)) {
    return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  }

  try {
    const res = await fetch(`${apiUrl}/api/jobs/aquecer-cache`, {
      method: "POST",
      headers: { "X-Job-Secret": jobsSecret },
      signal: AbortSignal.timeout(55_000),
    });
    const corpo = await res.text();
    return new NextResponse(corpo, {
      status: res.status,
      headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
    });
  } catch {
    return NextResponse.json({ erro: "Backend indisponível" }, { status: 502 });
  }
}
