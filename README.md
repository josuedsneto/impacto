# Sugarcane — Análise de Mercado e Risco

Plataforma interna para gestão de risco na indústria açucareira: preços de açúcar e câmbio, simulações, opções e risco operacional da usina.

## Ferramentas

**Fixações**
- Mercado: preços, indicadores técnicos e sinais de entrada
- Análise Técnica: dados de mercado por ativo
- Metas: marcação a mercado contra a meta em R$/t
- Opções: payoff de estratégias, Black-Scholes e Monte Carlo

**Simulação**
- Monte Carlo: faixa de preços futuros (P5 a P95)
- Jump Diffusion: simulação com saltos de preço
- ARIMA: previsão de preço com intervalo de confiança
- Volatilidade: volatilidade realizada de 30 dias, 90 dias e 1 ano

**Risco**
- VaR: perda máxima esperada por nível de confiança
- Breakeven: preço de equilíbrio em R$/saca
- Stress Test: piores quedas históricas
- Risco (EBITDA): distribuição de faturamento, custo e EBITDA
- Cenários: breakeven por variável operacional

**Análise**
- Notícias, Boletim Focus, Regressão Dólar, Regressão Açúcar, ATR

## Tecnologia

Next.js + FastAPI + Supabase. Instruções para rodar e publicar estão em [CLAUDE.md](CLAUDE.md).

## Colaboradores

Gabriel Canuto de Alencar

## Licença

MIT.
