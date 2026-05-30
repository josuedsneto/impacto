# Dados

## Onde os dados vivem

A aplicação **não lê arquivos de dados versionados**. Os dados de mercado são
obtidos em tempo real e cacheados no Postgres do Supabase:

- **Preços de mercado** → `backend/market_cache.py` busca via `yfinance`
  (estratégia cache-aside) e persiste nas tabelas `market_prices` /
  `market_coverage`.
- **Parâmetros, simulações, fixações, ATR, etc.** → tabelas do Supabase
  (ver `supabase/migrations/`).

## Planilhas/CSVs na raiz do repositório

Arquivos `*.csv` / `*.xls` / `*.xlsx` na raiz (ex.: `SBV24.csv`,
`dadosReg.xls`, `df_final.xlsx`, `Historico Impurezas.xlsx`) são **datasets
históricos da era Streamlit** e **não são usados pela stack ativa**.

- Estão **fora do versionamento** (`.gitignore` cobre `*.csv` / `*.xls*`) para
  não inchar o repositório nem vazar dados.
- Continuam em disco localmente; se precisar compartilhá-los, use um bucket
  (Supabase Storage) ou um drive interno — **não os recommite no Git**.
- Para reproduzir análises antigas, o app Streamlit original está arquivado na
  branch `legacy/streamlit`.

## Regra

Não versione dados. Código e migrations no Git; dados em storage/banco.
