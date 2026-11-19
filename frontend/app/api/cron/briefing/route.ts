import { NextResponse } from "next/server";
import { cronAutorizado } from "@/lib/cron";
import { chamarJob } from "@/lib/job";

// Briefing diário (BRF-02). Mesmo padrão de cron/alertas. Plano Hobby: execução entre 10:00 e 10:59 UTC.
export const maxDuration = 60;

export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return NextResponse.json({ detail: "CRON_SECRET não configurado." }, { status: 503 });
  if (!cronAutorizado(request.headers.get("authorization"), segredo)) {
    return NextResponse.json({ detail: "Não autorizado." }, { status: 401 });
  }
  return chamarJob("/api/jobs/briefing");
}
