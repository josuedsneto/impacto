# Sugarcane — Análise de Mercado e Risco

Plataforma interna para gestão de risco na indústria açucareira: preços de açúcar e câmbio, simulações, opções e risco operacional da usina.

## Ferramentas

**Mercado**
- Mercado e sinais: preços, indicadores técnicos e sinais de entrada e saída
- Preços diários: série de preços de qualquer ativo
- Metas: valor de mercado do açúcar em R$/t contra a sua meta
- Opções: resultado de estratégias no vencimento e preço justo de uma call

**Simulação**
- Monte Carlo: faixa de preços futuros em milhares de cenários
- Simulação com saltos: caminho de preço com choques bruscos ocasionais
- Previsão de preço (ARIMA): projeção estatística com intervalo de confiança
- Volatilidade: quanto o preço oscilou em 30 dias, 90 dias e 1 ano

**Risco**
- Perda máxima (VaR): maior queda esperada em 1 dia para um nível de confiança
- Breakeven do açúcar: preço em R$/saca
- Teste de estresse: piores quedas da história
- Risco do EBITDA: distribuição de faturamento, custo e EBITDA da safra
- Breakeven da safra: valor de cada variável em que o EBITDA zera

**Análise**
- Notícias, Boletim Focus, Modelo do dólar, Modelo do açúcar, ATR da usina

**Conta**
- Parâmetros e Glossário

## Tecnologia

Next.js + FastAPI + Supabase. Instruções para rodar e publicar estão em [CLAUDE.md](CLAUDE.md).

## Colaboradores

Gabriel Canuto de Alencar

## Licença

MIT.
