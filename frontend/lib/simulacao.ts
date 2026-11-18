// Faixas de cenários aceitas pela API. Mantenha em sincronia com backend/main.py:
// SimulationRequest (simulação) e MCPriceRequest (opções).

/** Simulação de preços (POST /api/simulations): memória limitada por blocos no backend. */
export const LIMITE_CENARIOS_SIMULACAO = { min: 100, max: 50_000 } as const;

/** Preço de opção por Monte Carlo (POST /api/options/mc-price): só guarda S_T, por isso aceita mais. */
export const LIMITE_CENARIOS_OPCOES = { min: 100, max: 100_000 } as const;
