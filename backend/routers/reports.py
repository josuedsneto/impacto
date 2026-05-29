"""
PDF report generation — GET /api/reports/posicao
Assembles hedge position + VaR + breakeven + last MC sim and returns a PDF.
Requires Pro plan.
"""
import io
import logging
import os
from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from db import get_supabase

from auth import get_current_user
from market_cache import get_prices
from routers.shared import limiter

logger = logging.getLogger(__name__)
router = APIRouter()


def _db():
    return get_supabase()


def _require_pro(user_id: str):
    row = _db().table("subscriptions").select("plan").eq("user_id", user_id).maybe_single().execute()
    plan = row.data["plan"] if row.data else "free"
    if plan not in ("pro", "enterprise"):
        raise HTTPException(status_code=403, detail="Relatórios PDF disponíveis no plano Profissional ou superior.")


def _get_price(ticker: str) -> float | None:
    today = date.today()
    rows = get_prices(ticker, today - timedelta(days=7), today)
    return float(rows[-1]["close"]) if rows else None


def _build_pdf(data: dict) -> bytes:
    """Build the PDF using reportlab. Returns raw bytes."""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=2*cm, rightMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm)
    styles = getSampleStyleSheet()

    GREEN = colors.HexColor("#16a34a")
    DARK  = colors.HexColor("#111827")
    GRAY  = colors.HexColor("#6b7280")
    LIGHT = colors.HexColor("#f3f4f6")

    title_style  = ParagraphStyle("title",  parent=styles["Normal"], fontSize=20, textColor=DARK,  fontName="Helvetica-Bold", spaceAfter=4)
    sub_style    = ParagraphStyle("sub",    parent=styles["Normal"], fontSize=10, textColor=GRAY,  spaceAfter=2)
    section_style= ParagraphStyle("section",parent=styles["Normal"], fontSize=11, textColor=GREEN, fontName="Helvetica-Bold", spaceBefore=14, spaceAfter=6)
    body_style   = ParagraphStyle("body",   parent=styles["Normal"], fontSize=9,  textColor=DARK)

    story = []

    # Header
    story.append(Paragraph("Sugarcane — Relatório de Posição", title_style))
    story.append(Paragraph(f"Gerado em {date.today().strftime('%d/%m/%Y')}", sub_style))
    story.append(HRFlowable(width="100%", thickness=1, color=GREEN, spaceAfter=12))

    def metric_table(rows_data):
        t = Table(rows_data, colWidths=[8*cm, 8*cm])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0,0),(-1,0), GREEN),
            ("TEXTCOLOR",  (0,0),(-1,0), colors.white),
            ("FONTNAME",   (0,0),(-1,0), "Helvetica-Bold"),
            ("FONTSIZE",   (0,0),(-1,-1), 9),
            ("ROWBACKGROUNDS", (0,1),(-1,-1), [LIGHT, colors.white]),
            ("GRID",       (0,0),(-1,-1), 0.25, colors.HexColor("#e5e7eb")),
            ("LEFTPADDING",(0,0),(-1,-1), 8),
            ("RIGHTPADDING",(0,0),(-1,-1), 8),
            ("TOPPADDING", (0,0),(-1,-1), 5),
            ("BOTTOMPADDING",(0,0),(-1,-1), 5),
        ]))
        return t

    # ── Posição de Hedge ──
    pos = data.get("posicao", {})
    story.append(Paragraph("Posição de Hedge — Açúcar NY (SB=F)", section_style))
    story.append(metric_table([
        ["Métrica", "Valor"],
        ["Fixações registradas", str(pos.get("n_fixacoes", 0))],
        ["Volume total fixado", f"{pos.get('volume_total', 0):,.0f} sacas"],
        ["Preço médio fixado", f"{pos.get('preco_medio', 0):.4f} ¢/lb" if pos.get("preco_medio") else "—"],
        ["Preço atual de mercado", f"{pos.get('preco_atual', 0):.4f} ¢/lb" if pos.get("preco_atual") else "—"],
        ["Cobertura", f"{pos.get('coverage_pct', 0):.1f}%" if pos.get("coverage_pct") else "—"],
        ["P&L por unidade", f"{(pos.get('preco_medio',0) or 0) - (pos.get('preco_atual',0) or 0):+.4f} ¢/lb"],
    ]))

    # ── VaR ──
    var_s = data.get("var_sugar", {})
    var_f = data.get("var_fx", {})
    if var_s or var_f:
        story.append(Paragraph("Value at Risk — 95% Confiança", section_style))
        rows = [["Ativo", "VaR Histórico", "VaR Paramétrico"]]
        if var_s:
            rows.append(["Açúcar NY (SB=F)", f"{var_s.get('var_historico_abs',0):.4f} ({var_s.get('var_historico_pct',0)*100:.2f}%)", f"{var_s.get('var_parametrico_abs',0):.4f}"])
        if var_f:
            rows.append(["USD/BRL", f"{var_f.get('var_historico_abs',0):.4f} ({var_f.get('var_historico_pct',0)*100:.2f}%)", f"{var_f.get('var_parametrico_abs',0):.4f}"])
        t = Table(rows, colWidths=[5*cm, 5.5*cm, 5.5*cm])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0,0),(-1,0), GREEN), ("TEXTCOLOR",(0,0),(-1,0), colors.white),
            ("FONTNAME",(0,0),(-1,0),"Helvetica-Bold"), ("FONTSIZE",(0,0),(-1,-1),9),
            ("ROWBACKGROUNDS",(0,1),(-1,-1),[LIGHT, colors.white]),
            ("GRID",(0,0),(-1,-1),0.25,colors.HexColor("#e5e7eb")),
            ("LEFTPADDING",(0,0),(-1,-1),8),("TOPPADDING",(0,0),(-1,-1),5),("BOTTOMPADDING",(0,0),(-1,-1),5),
        ]))
        story.append(t)

    # ── Last MC Simulation ──
    mc = data.get("last_sim")
    if mc:
        story.append(Paragraph("Última Simulação Monte Carlo", section_style))
        story.append(metric_table([
            ["Parâmetro", "Valor"],
            ["Ativo", mc.get("ticker", "—")],
            ["Preço inicial", f"{mc.get('preco_inicial',0):.4f}"],
            ["Horizonte (dias úteis)", str(mc.get("dias_simulados", "—"))],
            ["P5 (pessimista)", f"{mc.get('p5',0):.4f}" if mc.get("p5") else "—"],
            ["P50 (mediana)", f"{mc.get('p50',0):.4f}" if mc.get("p50") else "—"],
            ["P95 (otimista)", f"{mc.get('p95',0):.4f}" if mc.get("p95") else "—"],
        ]))

    # Footer
    story.append(Spacer(1, 20))
    story.append(HRFlowable(width="100%", thickness=0.5, color=GRAY))
    story.append(Paragraph("Este relatório é gerado automaticamente pela plataforma Sugarcane. Não constitui recomendação de investimento.", body_style))

    doc.build(story)
    return buf.getvalue()


@router.get("/api/reports/posicao")
@limiter.limit("10/minute")
async def report_posicao(
    request: Request,
    user: Annotated[dict, Depends(get_current_user)],
):
    """Generate and return a PDF report of the user's hedge position."""
    _require_pro(user["id"])

    db = _db()

    # Cobertura summary
    fixacoes = (
        db.table("fixacoes_cobertura")
        .select("volume,preco")
        .eq("user_id", user["id"])
        .eq("ticker", "SB=F")
        .execute()
    ).data
    preco_atual = _get_price("SB=F")
    posicao: dict = {"n_fixacoes": len(fixacoes), "preco_atual": preco_atual}
    if fixacoes:
        vol_total = sum(r["volume"] for r in fixacoes)
        preco_medio = sum(r["volume"] * r["preco"] for r in fixacoes) / vol_total
        posicao.update({"volume_total": vol_total, "preco_medio": round(preco_medio, 4), "coverage_pct": None})

    # Last MC simulation
    sim_row = (
        db.table("simulations")
        .select("ticker,preco_inicial,dias_simulados,p5,p50,p95,created_at")
        .eq("user_id", user["id"])
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    ).data
    last_sim = sim_row[0] if sim_row else None

    # Build PDF
    try:
        pdf_bytes = _build_pdf({"posicao": posicao, "last_sim": last_sim})
    except ImportError:
        raise HTTPException(status_code=500, detail="reportlab não instalado no servidor.")

    filename = f"relatorio_posicao_{date.today().isoformat()}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
