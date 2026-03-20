-- tickers_catalog is readable by all authenticated users (via RLS in migration 7).
-- Write access is enforced in FastAPI (admin only) — not via RLS, to keep policies simple.
CREATE TABLE IF NOT EXISTS public.tickers_catalog (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker          TEXT NOT NULL,
  nome            TEXT NOT NULL,
  tipo            TEXT NOT NULL CHECK (tipo IN ('commodity', 'fx', 'acao', 'indice')),
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  backfill_status TEXT NOT NULL DEFAULT 'pending' CHECK (backfill_status IN ('pending', 'done', 'failed')),
  ativo           BOOLEAN NOT NULL DEFAULT true,
  adicionado_por  UUID REFERENCES auth.users,
  review_note     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tickers_catalog_ticker_key UNIQUE (ticker)
);
