# Backtest do câmbio (USD/BRL)

- Dados: `USDBRL=X` (yfinance), limpos: 5148 fechamentos, de 2007-01-01 a 2026-11-18.
- Origens: 203 (a cada 21 dias úteis, de 2010-02-01 a 2026-11-13), janela de 756 preços, 10000 caminhos.
- Selic (SGS 432) disponível: True. Fed funds (FRED DFF) disponível: True. Origens sem M1f: 0.
- CRPS em log-retorno (×100 = %). Skill = 1 − CRPS_modelo / CRPS_M0 (positivo é melhor que M0).
- Kupiec: p-valor; rejeição a 5% se p<0,05. Gate em h ∈ {5, 21}.
- Limitação: origens em h=63 e 126 se sobrepõem; testes de cobertura desses horizontes são informativos.


### Horizonte 5 dias úteis

| Modelo | CRPS (%) | Skill vs M0 | Cobertura 80% (p) | 90% (p) | 95% (p) | Pinball p5/p50/p95 (%) | Brier | Skill Brier vs M0 |
|---|---|---|---|---|---|---|---|---|
| M0 | 1.202 | +0.000 | 86.7% (p=0.01) | 93.1% (p=0.12) | 95.6% (p=0.71) | 0.245/0.806/0.275 | 0.0200 | não avaliado (h<21) |
| M1 | 1.172 | +0.025 | 81.3% (p=0.65) | 92.1% (p=0.30) | 95.1% (p=0.96) | 0.207/0.808/0.279 | 0.0193 | não avaliado (h<21) |
| M1f | 1.168 | +0.028 | 80.3% (p=0.92) | 92.1% (p=0.30) | 95.1% (p=0.96) | 0.203/0.803/0.280 | 0.0193 | não avaliado (h<21) |

### Horizonte 21 dias úteis

| Modelo | CRPS (%) | Skill vs M0 | Cobertura 80% (p) | 90% (p) | 95% (p) | Pinball p5/p50/p95 (%) | Brier | Skill Brier vs M0 |
|---|---|---|---|---|---|---|---|---|
| M0 | 2.404 | +0.000 | 86.7% (p=0.01) | 92.6% (p=0.20) | 96.1% (p=0.47) | 0.481/1.627/0.525 | 0.1010 | +0.000 |
| M1 | 2.374 | +0.013 | 79.8% (p=0.94) | 91.1% (p=0.58) | 95.6% (p=0.71) | 0.435/1.628/0.518 | 0.0957 | +0.053 |
| M1f | 2.364 | +0.017 | 80.3% (p=0.92) | 91.6% (p=0.43) | 94.6% (p=0.79) | 0.432/1.628/0.518 | 0.0965 | +0.045 |

### Horizonte 63 dias úteis

| Modelo | CRPS (%) | Skill vs M0 | Cobertura 80% (p) | 90% (p) | 95% (p) | Pinball p5/p50/p95 (%) | Brier | Skill Brier vs M0 |
|---|---|---|---|---|---|---|---|---|
| M0 | 4.073 | +0.000 | 88.7% (p=0.00) | 93.1% (p=0.12) | 96.1% (p=0.47) | 0.829/2.692/0.972 | 0.1705 | +0.000 |
| M1 | 4.041 | +0.008 | 79.8% (p=0.94) | 88.7% (p=0.54) | 94.1% (p=0.56) | 0.734/2.695/1.081 | 0.1697 | +0.004 |
| M1f | 4.041 | +0.008 | 78.8% (p=0.68) | 89.7% (p=0.87) | 93.6% (p=0.38) | 0.704/2.750/1.053 | 0.1668 | +0.022 |

_Cobertura em h=63 é informativa: N efetivo ≈ 68 (overlap de janelas). Fora do gate._

### Horizonte 126 dias úteis

| Modelo | CRPS (%) | Skill vs M0 | Cobertura 80% (p) | 90% (p) | 95% (p) | Pinball p5/p50/p95 (%) | Brier | Skill Brier vs M0 |
|---|---|---|---|---|---|---|---|---|
| M0 | 6.024 | +0.000 | 84.7% (p=0.08) | 90.1% (p=0.94) | 93.6% (p=0.38) | 1.217/3.933/1.455 | 0.2085 | +0.000 |
| M1 | 5.985 | +0.007 | 76.4% (p=0.20) | 83.3% (p=0.00) | 90.1% (p=0.00) | 1.041/3.950/1.682 | 0.2113 | -0.014 |
| M1f | 5.957 | +0.011 | 73.4% (p=0.02) | 87.2% (p=0.20) | 93.6% (p=0.38) | 0.952/4.144/1.475 | 0.2126 | -0.020 |

_Cobertura em h=126 é informativa: N efetivo ≈ 34 (overlap de janelas). Fora do gate._

## Decisão de produção

**Escolha pela regra:** M1 (EWMA + FHS, drift zero): CRPS do M1 ≤ CRPS do M0 (skill ≥ 0) em h=5 e 21 e cobertura aprovada.

Regra aplicada (da spec): (1) M1 entra se skill vs M0 ≥ 0 em h=5 e 21 e Kupiec não rejeita a 5%; (2) M1f substitui M1 só com CRPS menor e Diebold-Mariano (HAC Newey-West) p<0,05; (3) senão, M0 com aviso.

Diebold-Mariano (M1f − M1, CRPS): h=5: p=0.520 (média da diferença -0.0043%), h=21: p=0.728 (média da diferença -0.0102%), h=63: p=1.000 (média da diferença -0.0001%), h=126: p=0.944 (média da diferença -0.0271%)

**Limitação:** o M1 fica estreito no horizonte longo: em h=126 cobre 83% (nominal 90%) e 90% (nominal 95%). A API serve até 262 dias úteis, e só foi testado até 126. Bandas de seis meses ou mais devem ser lidas como indicativas. Os p-valores de h=63 e 126 usam N=origens, não o N efetivo, e superestimam a significância.
