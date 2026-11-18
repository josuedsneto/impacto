import { NextResponse } from "next/server";
import { cronAutorizado } from "@/lib/cron";
import { chamarJob } from "@/lib/job";

// A Vercel chama por GET com Authorization: Bearer CRON_SECRET. Plano Hobby: 1 execução por dia.
export const maxDuration = 60;

export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return NextResponse.json({ detail: "CRON_SECRET não configurado." }, { status: 503 });
  if (!cronAutorizado(request.headers.get("authorization"), segredo)) {
    return NextResponse.json({ detail: "Não autorizado." }, { status: 401 });
  }
  const tipos = new URL(request.url).searchParams.get("tipos");
  return chamarJob(`/api/jobs/alertas${tipos ? `?tipos=${encodeURIComponent(tipos)}` : ""}`);
}
