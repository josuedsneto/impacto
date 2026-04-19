# Phase 20: ATR — Açúcar Total Recuperável - Context

**Gathered:** 2026-04-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Nova feature completa: simulação de ATR (Açúcar Total Recuperável, kg/tc) em função de Chuva e Impureza da cana, com histórico por usina persistido no Supabase, endpoint de regressão FastAPI e página Next.js.

**Plataforma:** Next.js (frontend/) + FastAPI (backend/). Nenhuma referência ao Streamlit.

</domain>

<decisions>
## Implementation Decisions

### Modelo de regressão
- Base: Fórmula padrão do setor (Consecana/Unica) — não um modelo treinado do zero
- Inputs do modelo: apenas Chuva (mm) e Impureza (%) — dois variáveis somente
- Calibração: começa com defaults do setor; recalibra automaticamente se o usuário tiver histórico suficiente
- Output do endpoint FastAPI: ATR previsto + intervalo de confiança (min/esperado/max)

### Estrutura por usina
- Lista de usinas: fixa, definida pelo admin (não criada livremente por usuários)
- Associação: admin associa cada usuário à(s) sua(s) usina(s) — via painel admin existente
- Isolamento: cada usuário tem suas próprias simulações (privadas por default)
- Compartilhamento: parâmetros de calibração são compartilhados dentro da usina; usuário pode opcionalmente "publicar" uma simulação para ser visível a todos da mesma usina
- Escala: poucas usinas por usuário (1–10)
- Identificador: apenas nome (sem campos extras como localização ou estado)

### Fluxo de simulação
- Input: ponto único — um valor de Chuva + um valor de Impureza
- Output visual: ATR previsto + intervalo de confiança (min/esperado/max) — sem gráfico de sensibilidade
- Projeção: usuário pode inserir volume de moagem (ton/safra ou ton/dia) para obter produção total de açúcar estimada
- Execução: sempre via endpoint FastAPI; frontend Next.js consome a API

### Histórico e persistência
- Salvamento: automático ao clicar "Simular" — toda simulação é persistida
- Campos salvos por simulação: Chuva, Impureza, ATR_min, ATR_esperado, ATR_max, producao_total, user_id, usina_id, timestamp
- Visualização: tabela de simulações + gráfico de linha de tendência de ATR ao longo do tempo
- Simulações publicadas: badge "Compartilhado" nas linhas da tabela (mesma tabela, filtrável) — Claude decide UI exata

### Claude's Discretion
- Algoritmo exato de calibração com histórico (quando recalibrar, threshold mínimo de pontos)
- Schema exato da tabela Supabase (nomes de colunas, índices)
- Design de componentes Next.js (layout interno, spacing)
- Como o admin gerencia a lista de usinas — pode reutilizar painel admin existente ou adicionar seção simples

</decisions>

<specifics>
## Specific Ideas

- "Não considere o Streamlit para nada — estamos implementando nas pastas backend/ e frontend/ da nova versão"
- Usuários da mesma usina podem ver dados compartilhados, mas cada usuário tem sua área de trabalho e dados isolados
- O default é que os parâmetros de calibração sejam compartilhados dentro da usina, mas cada usuário tem suas próprias simulações

</specifics>

<deferred>
## Deferred Ideas

Nenhuma ideia fora do escopo foi mencionada durante a discussão.

</deferred>

---

*Phase: 20-atr-acucar-total-recuperavel*
*Context gathered: 2026-04-08*
